import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { canTransitionPayment, paymentCallbackKey, paymentTransitionMatrix } from "../lib/payment-state.js";

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), "utf8");

function functionBody(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }
  return "";
}

test("platform admin authority is not granted by business/support wildcards", () => {
  const rules = read("firestore.rules");
  const body = functionBody(rules, "platformAdmin");
  assert.doesNotMatch(body, /businesses\.\*/);
  assert.doesNotMatch(body, /support\.\*/);
  assert.match(body, /admin\.\*/);
});

test("membership, invitation, audit, and order-event trusted writes are server-only", () => {
  const rules = read("firestore.rules");
  assert.match(rules, /match \/memberships\/\{membershipId\}[\s\S]*?allow create, update, delete: if false;/);
  assert.match(rules, /match \/businessInvitations\/\{invitationId\}[\s\S]*?allow create, update, delete: if false;/);
  assert.match(rules, /match \/auditLogs\/\{logId\}[\s\S]*?allow create, update, delete: if false;/);
  assert.match(rules, /match \/orderEvents\/\{eventId\}[\s\S]*?allow create, update, delete: if false;/);
});

test("business scope requires active membership and explicit business scope", () => {
  const rules = read("firestore.rules");
  const active = functionBody(rules, "membershipActive");
  const scope = functionBody(rules, "businessScope");
  assert.match(active, /status == "active"/);
  assert.match(active, /expiresAt/);
  assert.match(scope, /businessIds/);
  assert.match(scope, /businessId/);
});

test("branch-scoped order access is enforced in Firestore rules", () => {
  const rules = read("firestore.rules");
  const body = functionBody(rules, "canReadOrder");
  assert.match(body, /branchScope\(businessId, branchId\)/);
  assert.match(rules, /resource\.data\.branchId/);
});

test("storage business access requires active, non-expired scoped membership", () => {
  const rules = read("storage.rules");
  const body = functionBody(rules, "activeBusinessAccess");
  assert.match(body, /status == "active"/);
  assert.match(body, /expiresAt/);
  assert.match(body, /businessIds/);
});

test("public marketplace visibility is enforced by rate-limited server routes without composite-index dependencies", () => {
  const services = read("lib/firebase-services.js");
  const marketplaceRoute = read("app/api/public/marketplace/route.js");
  const businessRoute = read("app/api/public/marketplace/business/route.js");
  const marketplaceApp = read("components/marketplace-app.js");

  assert.match(services, /api\/public\/marketplace/);
  assert.match(services, /loadPublicMarketplaceBusiness/);
  assert.match(marketplaceRoute, /enforceRateLimit/);
  assert.match(marketplaceRoute, /where\("public",\s*"==",\s*true\)/);
  assert.match(marketplaceRoute, /isLive/);
  assert.doesNotMatch(marketplaceRoute, /orderBy\(/);
  assert.match(businessRoute, /enforceRateLimit/);
  assert.match(businessRoute, /where\("businessId",\s*"==",\s*businessId\)/);
  assert.match(businessRoute, /doc\.data\(\)\?\.public === true/);
  assert.match(businessRoute, /doc\.data\(\)\?\.published === true/);
  assert.match(businessRoute, /doc\.data\(\)\?\.active !== false/);
  assert.doesNotMatch(businessRoute, /orderBy\(/);
  assert.match(marketplaceApp, /loadPublicMarketplaceBusiness/);
});

test("public waitlist and partnership writes are server controlled and rate limited", () => {
  const rules = read("firestore.rules");
  assert.match(rules, /match \/waitlistEntries\/\{entryId\}[\s\S]*?allow create, update: if false;/);
  assert.match(rules, /match \/partnershipLeads\/\{leadId\}[\s\S]*?allow create: if false;/);
  assert.match(read("app/api/public/waitlist/route.js"), /enforceRateLimit/);
  assert.match(read("app/api/public/partnership/route.js"), /enforceRateLimit/);
});

test("invite acceptance rejects legacy mutable grants and revalidates issuer authority", () => {
  const route = read("app/api/business-invitations/accept/route.js");
  assert.match(route, /serverIssued/);
  assert.match(route, /grantVersion/);
  assert.match(route, /issuedBy/);
  assert.match(route, /requireBusinessPermission/);
  assert.match(route, /runTransaction/);
});

test("generic reservation release endpoint is retired and customer cancellation is fixed-purpose", () => {
  assert.match(read("app/api/orders/release/route.js"), /status:\s*410/);
  const cancel = read("app/api/orders/cancel/route.js");
  assert.match(cancel, /reason:\s*"customer_cancelled"/);
  assert.doesNotMatch(cancel, /body\.status/);
  assert.match(cancel, /cancellationCutoffMinutes/);
});

test("paid payment state cannot regress to failed, expired, or cancelled", () => {
  assert.equal(canTransitionPayment("paid", "failed"), false);
  assert.equal(canTransitionPayment("paid", "expired"), false);
  assert.equal(canTransitionPayment("paid", "cancelled"), false);
  assert.equal(canTransitionPayment("paid", "refund_pending"), true);
  assert.deepEqual(paymentTransitionMatrix().paid, ["refund_pending"]);
});

test("payment callback key is stable for replay detection", () => {
  const a = paymentCallbackKey({ reference: "A", providerReference: "P", providerStatus: "paid", amount: 21 });
  const b = paymentCallbackKey({ reference: "A", providerReference: "P", providerStatus: "PAID", amount: 21.0 });
  const c = paymentCallbackKey({ reference: "A", providerReference: "P", providerStatus: "failed", amount: 21 });
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("Paynow charge is derived from immutable stored order total", () => {
  const source = read("lib/paynow-server.js");
  assert.match(source, /order\.totals\?\.total \?\? order\.total/);
  assert.match(source, /return \[\{ name: `Spotly order/);
  assert.doesNotMatch(source, /order\.items\.map/);
});

test("payment initiation uses a server lock and callback processing uses a ledger", () => {
  const initiation = read("app/api/payments/paynow/initiate/route.js");
  const processor = read("lib/payment-processor-server.js");
  assert.match(initiation, /paymentInitiationLocks/);
  assert.match(initiation, /livePending/);
  assert.match(processor, /paymentCallbacks/);
  assert.match(processor, /callbackSnapshot\.exists/);
  assert.match(processor, /canTransitionPayment/);
});

test("manual refund workflow cannot begin from an unpaid order and records provider reference on completion", () => {
  const route = read("app/api/admin/refunds/route.js");
  assert.match(route, /order\.paymentStatus !== "paid"/);
  assert.match(route, /providerReference: body\.providerReference/);
  assert.match(route, /refund_pending/);
});

test("health endpoint uses centralized build metadata", () => {
  const route = read("app/api/health/route.js");
  assert.match(route, /BUILD_INFO/);
  assert.doesNotMatch(route, /version:\s*"1\.0\.0"/);
});

test("privileged user access and payout mutations are server controlled", () => {
  const rules = read("firestore.rules");
  assert.match(rules, /match \/users\/\{uid\}[\s\S]*?allow update: if self\(uid\)[\s\S]*?allow delete: if superAdmin\(\);/);
  assert.match(rules, /match \/payouts\/\{payoutId\}[\s\S]*?allow create, update: if false;/);
  assert.match(read("lib/firebase-services.js"), /api\/admin\/user-access/);
  assert.match(read("lib/business-services.js"), /api\/payouts/);
});

test("support trusted writes are rate-limited server operations", () => {
  const rules = read("firestore.rules");
  assert.match(rules, /match \/supportConversations\/\{conversationId\}[\s\S]*?allow create: if false;[\s\S]*?allow update: if false;/);
  assert.match(rules, /match \/supportMessages\/\{messageId\}[\s\S]*?allow create, update, delete: if false;/);
  const route = read("app/api/support/conversations/route.js");
  assert.match(route, /enforceRateLimit/);
  assert.match(route, /support-create/);
  assert.match(route, /support-message/);
});

test("business team reads and grants are mediated by the scoped server route", () => {
  const rules = read("firestore.rules");
  assert.match(rules, /match \/memberships\/\{membershipId\}[\s\S]*?allow read: if signedIn\(\) && \(resource\.data\.userId == request\.auth\.uid \|\| platformAdmin\(\)\)/);
  const route = read("app/api/business-team/route.js");
  assert.match(route, /export async function GET/);
  assert.match(route, /requireBusinessPermission/);
  assert.match(route, /actorBranches/);
});

test("App Check can be enforced for authenticated and public API traffic", () => {
  const admin = read("lib/firebase-admin.js");
  const client = read("lib/api-client.js");
  assert.match(admin, /SPOTLY_ENFORCE_APP_CHECK/);
  assert.match(admin, /verifyAppCheckRequest/);
  assert.match(client, /X-Firebase-AppCheck/);
  assert.match(read("app/api/public/waitlist/route.js"), /verifyAppCheckRequest/);
  assert.match(read("app/api/public/partnership/route.js"), /verifyAppCheckRequest/);
});

test("pilot refund workflow rejects partial-refund ambiguity", () => {
  const route = read("app/api/admin/refunds/route.js");
  assert.match(route, /Partial refunds are not enabled in the controlled pilot/);
});

test("admin launch-readiness checks distinguish configuration from verification", () => {
  const route = read("app/api/admin/launch-readiness/route.js");
  assert.match(route, /needs_verification/);
  assert.match(route, /SPOTLY_RULES_VERIFIED_AT/);
  assert.match(route, /SPOTLY_BACKUP_VERIFIED_AT/);
  assert.match(route, /SPOTLY_ENFORCE_APP_CHECK/);
});

test("Admin launch readiness actively checks the production-safe marketplace directory", () => {
  const route = read("app/api/admin/launch-readiness/route.js");
  assert.match(route, /marketplace-directory/);
  assert.match(route, /where\("public", "==", true\)/);
  assert.match(route, /liveMarketplaceBusiness/);
});

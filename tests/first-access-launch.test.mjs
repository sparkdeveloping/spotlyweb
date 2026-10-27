import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { campaignLink, classifyChannel, normalizeAttribution, FIRST_ACCESS_INTERESTS } from "../lib/first-access.js";

const read = (p) => readFileSync(join(process.cwd(), p), "utf8");
test("acquisition sources are inferred from explicit UTMs or referrer host", () => {
  assert.equal(classifyChannel({ utm_source: "whatsapp" }), "whatsapp");
  assert.equal(classifyChannel({ referrer: "https://www.instagram.com/reels" }), "instagram");
  assert.equal(classifyChannel({ via: "random-referral" }), "referral");
  assert.equal(classifyChannel({}), "direct");
});
test("campaign links persist UTM labels without changing the target origin", () => {
  const link = new URL(campaignLink({ source: "whatsapp", campaign: "october-launch", content: "agency-a" }));
  assert.equal(link.hostname, "spotlyafrica.com");
  assert.equal(link.searchParams.get("utm_source"), "whatsapp");
  assert.equal(link.searchParams.get("utm_campaign"), "october-launch");
  assert.equal(link.searchParams.get("utm_content"), "agency-a");
});
test("raw referring URLs cannot store private query tokens", () => {
  const result = normalizeAttribution({ referrer: "https://facebook.com/click?oauth_token=secret&email=user@example.com" });
  assert.equal(result.referrer, "https://facebook.com");
  assert.ok(!JSON.stringify(result).includes("secret"));
});
test("launch uses current Spotly product names and hides countdown by default", () => {
  assert.ok(["bite", "shopper", "live"].every((value) => FIRST_ACCESS_INTERESTS.some(([id]) => id === value)));
  assert.match(read("lib/platform-defaults.js"), /countdownVisible: false/);
  assert.match(read("components/first-access-landing.js"), /countdownVisible === true/);
});
test("first access creation requires a linked authenticated Firebase identity", () => {
  const route = read("app/api/public/waitlist/route.js");
  assert.match(route, /source === "first_access" && !actor/);
  assert.match(route, /accountUid && \(!actor \|\| old.accountUid !== actor.uid\)/);
  assert.match(route, /randomBytes\(7\)/);
  assert.match(route, /marketingOptIn/);
});
test("agency roles are scoped to launch and optional business reading, not finance or beta", () => {
  const roles = read("data/production-seed.js");
  assert.match(roles, /agency_launch_manager/);
  assert.match(roles, /agency_outreach_coordinator/);
  assert.match(roles, /agency_business_onboarding/);
  assert.match(read("app/api/admin/first-access/beta/route.js"), /requirePlatformPermission\(actor, "launch.beta"\)/);
  assert.match(read("app/api/admin/first-access/route.js"), /requirePlatformPermission\(actor, "launch.read"\)/);
  assert.match(read("app/api/admin/first-access/route.js"), /requirePlatformPermission\(actor, "launch.export"\)/);
});
test("new commercial orders use trusted server launch gating", () => {
  for (const file of ["app/api/orders/create/route.js", "app/api/customer/rides/route.js", "app/api/customer/parcels/route.js", "app/api/customer/assist-bookings/route.js", "app/api/customer/independent-shopping/requests/route.js", "app/api/customer/transactions/create/route.js"]) {
    assert.match(read(file), /requireCustomerLaunchAccess\(user, getAdminServices\(\).db\)/, file);
  }
});
test("marketing counters and contact activity are server-only", () => {
  const rules = read("firestore.rules");
  assert.match(rules, /match \/firstAccessMetrics\/\{id\} \{ allow read, write: if false; \}/);
  assert.match(rules, /match \/firstAccessTouchpoints\/\{id\} \{ allow read, write: if false; \}/);
});

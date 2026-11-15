import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { routeHarness } from "./helpers/route-harness.mjs";

const root = process.cwd();
const source = file => readFileSync(resolve(root, file), "utf8");
const api = (body) => new Request("https://tickets.spotlyafrica.com/api/support/conversations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const safeText = (value, limit = 500) => String(value || "").trim().slice(0, limit);

function supportHarness({ anonymous = false, appCheckReject = false } = {}) {
  let authenticatedUid = "guest-1";
  const checks = { quotas: 0, appCheck: 0 };
  const h = routeHarness(root, {
    "@/lib/firebase-admin": {
      authenticateRequest: async () => ({ uid: authenticatedUid, email: null, name: "", profile: { roles: [] }, ...(anonymous ? { firebase: { sign_in_provider: "anonymous" } } : {}) }),
      verifyAppCheckRequest: async (_request, opts) => { checks.appCheck++; assert.equal(opts.required, true); if (appCheckReject) throw Object.assign(new Error("App Check is required"), { status: 401 }); },
      getAdminServices: () => ({ db: h.db, messaging: {}, auth: {} }),
      apiError: error => Response.json({ ok: false, error: error.message }, { status: error.status || 500 })
    },
    "@/lib/rate-limit-server": { enforceRateLimit: async () => { checks.quotas++; } },
    "@/lib/access-control-server": {
      hasPlatformPermission: () => false, isPlatformAdmin: () => false,
      requireBusinessPermission: async () => { throw Object.assign(new Error("No business access"), { status: 403 }); }
    },
    "@/lib/server-helpers": { safeText },
    "@/lib/notification-server": { notifyRoleAudience: async () => {}, notifyUser: async () => {} }
  });
  return { h, route: h.load("app/api/support/conversations/route.js"), as: uid => { authenticatedUid = uid; }, checks };
}

test("LX2: dedicated host rewrites to /tickets without disturbing other workspace routes", () => {
  const proxy = source("proxy.js");
  assert.match(proxy, /host === "tickets\.spotlyafrica\.com"/);
  assert.match(proxy, /url\.pathname = "\/tickets"/);
  assert.match(proxy, /matchesPrefix\(pathname, ORIGIN_LOCAL_PREFIXES\)/);
  assert.match(proxy, /host, "\/"/);
  assert.match(source("app/tickets/page.js"), /robots: \{ index: false/);
  assert.match(source("components/tickets-app.js"), /ensureAnonymousSession/);
  assert.match(source("components/tickets-app.js"), /metadataOnly=1/);
});

test("LX2: guest support requests are restricted to the Firebase session that created them", async () => {
  const { h, route, as } = supportHarness();
  h.records.set("clientIncidents/SI-123456789ABC", { platform: "web", screen: "/ride", status: "open" });
  const response = await route.POST(api({
    action: "create", name: "Guest", email: "guest@example.com", audience: "public",
    subject: "My ride did not load", category: "ride", message: "Map failed at pickup",
    incidentReference: "SI-123456789ABC"
  }));
  assert.equal(response.status, 200);
  const { conversationId } = await response.json();
  assert.equal(h.records.get(`supportConversations/${conversationId}`).requesterId, "guest-1");
  assert.equal(h.records.get("clientIncidents/SI-123456789ABC").linkedConversationId, conversationId);
  as("other-person");
  const unauthorized = await route.GET(new Request(`https://tickets.spotlyafrica.com/api/support/conversations?conversationId=${conversationId}&metadataOnly=1`));
  assert.equal(unauthorized.status, 403);
  as("guest-1");
  const permitted = await route.GET(new Request(`https://tickets.spotlyafrica.com/api/support/conversations?conversationId=${conversationId}&metadataOnly=1`));
  assert.equal(permitted.status, 200);
  const payload = await permitted.json();
  assert.equal(payload.conversation.id, conversationId);
  assert.equal(payload.messages, undefined);
  assert.equal(payload.conversation.callbackStatus, null);
  assert.equal(JSON.stringify(payload).includes("guest@example.com"), false);
});

test("LX2: callback requires explicit consent and ownership, and never exposes the phone in public record", async () => {
  const { h, route, as } = supportHarness();
  h.records.set("supportConversations/case-one", { requesterId: "guest-1", audience: "public", status: "open" });
  const noConsent = await route.POST(api({ action: "request_callback", conversationId: "case-one", phone: "+265 991 000 111", consent: false }));
  assert.notEqual(noConsent.status, 200);
  as("other-person");
  const other = await route.POST(api({ action: "request_callback", conversationId: "case-one", phone: "+265 991 000 111", consent: true }));
  assert.equal(other.status, 403);
  as("guest-1");
  const yes = await route.POST(api({ action: "request_callback", conversationId: "case-one", phone: "+265 991 000 111", consent: true }));
  assert.equal(yes.status, 200);
  const raw = h.records.get("supportConversations/case-one");
  assert.equal(raw.callbackRequest.phone, "+265 991 000 111");
  assert.equal(raw.callbackRequest.consentedBy, "guest-1");
  assert.equal(raw.status, "waiting_for_spotly");
  const result = await route.GET(new Request("https://tickets.spotlyafrica.com/api/support/conversations?conversationId=case-one&metadataOnly=1"));
  assert.equal((await result.json()).conversation.callbackStatus, "requested");
  assert.equal(JSON.stringify(await (await route.GET(new Request("https://tickets.spotlyafrica.com/api/support/conversations?conversationId=case-one&metadataOnly=1"))).json()).includes("+265"), false);
});

test("LX2: incident-to-case escalation is staff-only, private and idempotent", async () => {
  let permitted = false;
  const h = routeHarness(root, {
    "@/lib/firebase-admin": {
      authenticateRequest: async () => ({ uid: "staff-1", profile: { roles: permitted ? ["support_manager"] : ["customer"] } }),
      getAdminServices: () => ({ db: h.db }),
      apiError: error => Response.json({ ok: false, error: error.message }, { status: error.status || 500 })
    },
    "@/lib/access-control-server": { requirePlatformPermission: (user) => {
      if (!user.profile.roles.includes("support_manager")) throw Object.assign(new Error("Unauthorized"), { status: 403 });
    } }
  });
  const route = h.load("app/api/admin/client-incidents/escalate/route.js");
  const request = () => new Request("https://admin.spotlyafrica.com/api/admin/client-incidents/escalate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ incidentId: "SI-123456789ABC" }) });
  h.records.set("clientIncidents/SI-123456789ABC", { screen: "/ride", platform: "web", status: "open", severity: "high" });
  assert.equal((await route.POST(request())).status, 403);
  assert.equal([...h.records.keys()].filter(key => key.startsWith("supportConversations/")).length, 0);
  permitted = true;
  const created = await route.POST(request());
  assert.equal(created.status, 200);
  const { conversationId } = await created.json();
  assert.equal(h.records.get(`supportConversations/${conversationId}`).internalOnly, true);
  assert.equal(h.records.get(`supportConversations/${conversationId}`).requesterId, null);
  const msg = [...h.records.entries()].filter(([key]) => key.startsWith("supportMessages/"))[0][1];
  assert.equal(msg.internal, true);
  assert.equal((await (await route.POST(request())).json()).conversationId, conversationId);
  assert.equal([...h.records.keys()].filter(key => key.startsWith("supportConversations/")).length, 1);
});

test("LX2: call review and incident detail are restricted to support responders", () => {
  assert.match(source("app/api/support/conversations/route.js"), /body\.action === "callback_review"/);
  assert.match(source("app/api/support/conversations/route.js"), /!access\.support \|\| !supportResponder\(user\)/);
  assert.match(source("app/api/admin/support/context/route.js"), /callbackRequest: conversation\.callbackRequest/);
  assert.match(source("components/admin-client-incidents.js"), /Create support case/);
  assert.match(source("components/admin-support-console.js"), /Callback requested/);
  assert.match(source("firestore.rules"), /match \/supportConversations\/\{conversationId\}/);
  assert.match(source("firestore.rules"), /allow create: if false/);
  assert.match(source("firestore.rules"), /allow update: if false/);
});

test("LX2: the native apps retain their existing support and offer a web option", () => {
  for (const file of [
    "../../driver/spotlydriver/spotlydriver/Features/Support/SupportViews.swift",
    "../../customer/spotly/spotly/Features/Production/ProfileSupportNotifications.swift",
    "../../business/spotlybusiness/spotlybusiness/Features/Profile/SupportView.swift"
  ]) {
    assert.match(source(file), /https:\/\/spotlyafrica\.com\/support/);
  }
});

test("LX2: optional guest App Check can fail closed before creating any support case", async () => {
  const old = process.env.SPOTLY_SUPPORT_ANONYMOUS_APP_CHECK_REQUIRED;
  process.env.SPOTLY_SUPPORT_ANONYMOUS_APP_CHECK_REQUIRED = "true";
  try {
    const { h, route, checks } = supportHarness({ anonymous: true, appCheckReject: true });
    const result = await route.POST(api({ action: "create", name: "Guest", email: "guest@example.com", audience: "public", subject: "Cannot find my order", message: "My list does not load." }));
    assert.equal(result.status, 401);
    assert.equal(checks.appCheck, 1);
    assert.equal([...h.records.keys()].filter(key => key.startsWith("supportConversations/")).length, 0);
  } finally {
    if (old === undefined) delete process.env.SPOTLY_SUPPORT_ANONYMOUS_APP_CHECK_REQUIRED;
    else process.env.SPOTLY_SUPPORT_ANONYMOUS_APP_CHECK_REQUIRED = old;
  }
});

test("LX2: portal activation is gated until DNS and auth are validated", () => {
  assert.match(source(".env.example"), /NEXT_PUBLIC_SPOTLY_TICKETS_ENABLED=false/);
  assert.match(source("app/error.js"), /NEXT_PUBLIC_SPOTLY_TICKETS_ENABLED/);
  assert.match(source("app/global-error.js"), /NEXT_PUBLIC_SPOTLY_TICKETS_ENABLED/);
  assert.match(source("components/support-app.js"), /NEXT_PUBLIC_SPOTLY_TICKETS_ENABLED/);
});

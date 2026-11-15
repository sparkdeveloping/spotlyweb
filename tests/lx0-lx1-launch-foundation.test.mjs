import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { routeHarness } from "./helpers/route-harness.mjs";
import { normalizeClientIncident, safeIncidentScreen } from "../lib/incident-policy.mjs";

const root = process.cwd();
const source = (name) => readFileSync(resolve(root, name), "utf8");

function withEnabled(value, fn) {
  const previous = process.env.SPOTLY_INCIDENT_INGEST_ENABLED;
  if (value === undefined) delete process.env.SPOTLY_INCIDENT_INGEST_ENABLED;
  else process.env.SPOTLY_INCIDENT_INGEST_ENABLED = value;
  return Promise.resolve().then(fn).finally(() => {
    if (previous === undefined) delete process.env.SPOTLY_INCIDENT_INGEST_ENABLED;
    else process.env.SPOTLY_INCIDENT_INGEST_ENABLED = previous;
  });
}

function harness({ rejectAppCheck = false, rejectQuota = false } = {}) {
  let checks = 0, quotas = 0, writes = 0;
  const h = routeHarness(root, {
    "@/lib/firebase-admin": {
      getAdminServices: () => ({ db: { collection: (name) => ({
        doc: (id) => ({ create: async (data) => { assert.equal(name, "clientIncidents"); writes++; h.records.set(`${name}/${id}`, data); } })
      }) } }),
      verifyAppCheckRequest: async (_request, opts) => {
        checks++;
        assert.equal(opts.required, true);
        if (rejectAppCheck) throw Object.assign(new Error("App Check required"), { status: 401 });
      },
      apiError: (error) => Response.json({ ok: false, error: error.message }, { status: error.status || 500 }),
    },
    "@/lib/rate-limit-server": {
      enforceRateLimit: async (_request, opts) => {
        quotas++;
        assert.equal(opts.limit, 3);
        if (rejectQuota) throw Object.assign(new Error("Slow down"), { status: 429 });
      }
    },
    "firebase-admin/firestore": { FieldValue: { serverTimestamp: () => "mock-time" } },
  });
  return { route: h.load("app/api/public/client-incidents/route.js"), records: h.records, counts: () => ({ checks, quotas, writes }) };
}

function incident(body) {
  return new Request("https://spotly.example/api/public/client-incidents", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
  });
}
const sample = { surface: "page-boundary", errorClass: "TypeError", screen: "/ride/trips/secret?token=private", digest: "known-digest" };

test("LX1: input removes URL secrets and extra PII fields", () => {
  assert.equal(safeIncidentScreen("/ride/ABCD123?secret=yes"), "/ride");
  assert.equal(safeIncidentScreen("/72f4f9?x=1"), "/");
  assert.deepEqual(normalizeClientIncident({ ...sample, password: "secret", stack: "private coordinates" }), {
    surface: "page-boundary", errorClass: "TypeError", screen: "/ride", digest: "known-digest"
  });
  assert.equal(normalizeClientIncident({ ...sample, surface: "payment-override" }), null);
  assert.equal(normalizeClientIncident(null), null);
});

test("LX1: reporting disabled means zero auth, quota or database activity", async () => withEnabled("false", async () => {
  const { route, counts } = harness();
  const response = await route.POST(incident(sample));
  assert.equal(response.status, 503);
  assert.deepEqual(counts(), { checks: 0, quotas: 0, writes: 0 });
}));

test("LX1: mandatory App Check rejection precedes quota and database writes", async () => withEnabled("true", async () => {
  const { route, counts } = harness({ rejectAppCheck: true });
  const response = await route.POST(incident(sample));
  assert.equal(response.status, 401);
  assert.deepEqual(counts(), { checks: 1, quotas: 0, writes: 0 });
}));

test("LX1: over-quota incident never reaches the database", async () => withEnabled("true", async () => {
  const { route, counts } = harness({ rejectQuota: true });
  const response = await route.POST(incident(sample));
  assert.equal(response.status, 429);
  assert.deepEqual(counts(), { checks: 1, quotas: 1, writes: 0 });
}));

test("LX1: incident storage contains only permitted context", async () => withEnabled("true", async () => {
  const { route, records, counts } = harness();
  const response = await route.POST(incident({ ...sample, password: "secret", stack: "very private stack", latitude: -13.9 }));
  assert.equal(response.status, 201);
  const payload = await response.json();
  assert.match(payload.incidentId, /^SI-[0-9A-F]{12}$/);
  assert.deepEqual(counts(), { checks: 1, quotas: 1, writes: 1 });
  const record = records.get(`clientIncidents/${payload.incidentId}`);
  assert.equal(record.screen, "/ride");
  assert.equal(record.errorClass, "TypeError");
  assert.ok(record.fingerprint);
  assert.ok(!JSON.stringify(record).includes("secret"));
  assert.ok(!JSON.stringify(record).includes("private"));
  assert.ok(!JSON.stringify(record).includes("-13.9"));
}));

test("LX1: malformed/oversized reports are rejected without record writes", async () => withEnabled("true", async () => {
  const { route, counts } = harness();
  const malformed = new Request("https://spotly.example/api/public/client-incidents", {method:"POST",body:"{broken"});
  assert.equal((await route.POST(malformed)).status, 400);
  const enormous = new Request("https://spotly.example/api/public/client-incidents", { method: "POST", body: JSON.stringify({ ...sample, stack: "z".repeat(5000) }) });
  assert.equal((await route.POST(enormous)).status, 413);
  assert.equal(counts().writes, 0);
}));

test("LX1: staff incident route requires permission, caps results and redacts", () => {
  const admin = source("app/api/admin/client-incidents/route.js");
  assert.match(admin, /authenticateRequest\(request\)/);
  assert.match(admin, /requirePlatformPermission\(user, "support\.read"/);
  assert.match(admin, /\.limit\(40\)/);
  assert.doesNotMatch(admin, /resource\.data|\.get\(\)\.then\(.*request\.headers/);
  assert.match(source("components/admin-app.js"), /<AdminClientIncidents\/>/);
});

test("LX1: web boundaries avoid generic crash text and expose support recovery", () => {
  for (const path of ["app/error.js", "app/global-error.js"]) {
    const text = source(path);
    assert.doesNotMatch(text, /hit an unexpected error/i);
    assert.match(text, path === "app/error.js" ? /copy\.support/ : /Contact support/);
    assert.match(text, path === "app/error.js" ? /copy\.body/ : /check Activity/i);
    assert.match(text, /reportBoundaryIncident/);
  }
  assert.match(source(".env.example"), /SPOTLY_INCIDENT_INGEST_ENABLED=false/);
});

test("LX1: native applications have safe user-facing error mapping", () => {
  const files = [
    "../../driver/spotlydriver/spotlydriver/Core/Platform/DriverObservability.swift",
    "../../customer/spotly/spotly/Core/Platform/SpotlyObservability.swift"
  ];
  for (const file of files) {
    const text = readFileSync(resolve(root, file), "utf8");
    assert.match(text, /static func message\(_ error: Error/);
    assert.match(text, /NSURLErrorTimedOut/);
    assert.match(text, /Check the latest status/);
  }
});

test("LX1: unauthorized admin cannot query even one incident", async () => {
  let reads = 0;
  const h = routeHarness(root, {
    "@/lib/firebase-admin": {
      authenticateRequest: async () => ({ uid: "non-support", profile: { roles: ["customer"] } }),
      getAdminServices: () => ({ db: { collection: () => { reads++; throw new Error("query should not run"); } } }),
      apiError: (error) => Response.json({ ok: false, error: error.message }, { status: error.status || 500 }),
    },
    "@/lib/access-control-server": {
      requirePlatformPermission: () => { throw Object.assign(new Error("Not allowed"), { status: 403 }); }
    }
  });
  const route = h.load("app/api/admin/client-incidents/route.js");
  const response = await route.GET(new Request("https://spotly.example/api/admin/client-incidents"));
  assert.equal(response.status, 403);
  assert.equal(reads, 0);
});

test("LX1: support-scoped admin gets no raw client payload or unlimited records", async () => {
  const h = routeHarness(root, {
    "@/lib/firebase-admin": {
      authenticateRequest: async () => ({ uid: "agent", profile: { roles: ["support_agent"] } }),
      getAdminServices: () => ({ db: { collection: (name) => {
        assert.equal(name, "clientIncidents");
        return { orderBy: (field, direction) => {
          assert.equal(field, "createdAt"); assert.equal(direction, "desc");
          return { limit: (count) => {
            assert.equal(count, 40);
            return { get: async () => ({ docs: [{ id: "SI-123456789ABC", data: () => ({ screen: "/ride", digest: "digest", stack: "PRIVATE", token: "SECRET", createdAt: { toDate: () => new Date("2026-11-15") } }) }] }) };
          } };
        } };
      } } }),
      apiError: (error) => Response.json({ ok: false, error: error.message }, { status: error.status || 500 }),
    },
    "@/lib/access-control-server": { requirePlatformPermission: (_user, permission) => { assert.equal(permission, "support.read"); } },
  });
  const response = await h.load("app/api/admin/client-incidents/route.js")
    .GET(new Request("https://spotly.example/api/admin/client-incidents"));
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.incidents.length, 1);
  assert.equal(payload.incidents[0].screen, "/ride");
  assert.ok(!JSON.stringify(payload).includes("PRIVATE"));
  assert.ok(!JSON.stringify(payload).includes("SECRET"));
});

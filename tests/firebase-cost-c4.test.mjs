import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ADMIN_DATA_SOURCES, adminDataSourcesFor } from "../lib/admin-data-scope.mjs";
import { routeHarness } from "./helpers/route-harness.mjs";

const root = process.cwd();
const source = (file) => readFileSync(join(root, file), "utf8");

test("C4: admin sections subscribe only to the sources their screens require", () => {
  assert.equal(ADMIN_DATA_SOURCES.length, 12);
  assert.deepEqual(adminDataSourcesFor("mobility"), []);
  assert.deepEqual(adminDataSourcesFor("work"), []);
  assert.deepEqual(adminDataSourcesFor("people"), []);
  assert.deepEqual(adminDataSourcesFor("drivers"), []);
  assert.deepEqual(adminDataSourcesFor("money"), ["businesses", "payouts"]);
  assert.deepEqual(adminDataSourcesFor("finance"), ["businesses", "payouts"]);
  assert.ok(adminDataSourcesFor("home").includes("payouts"));
  assert.ok(adminDataSourcesFor("home").includes("support"));
  assert.ok(adminDataSourcesFor("growth").includes("waitlist"));
  assert.ok(adminDataSourcesFor("marketplace").includes("users"));
  assert.ok(adminDataSourcesFor("system").includes("audit"));
  assert.equal(adminDataSourcesFor("invalid-area").length, 12, "unknown sections must retain legacy data rather than silently hide content");
  assert.ok(Object.isFrozen(adminDataSourcesFor("home")), "stable plans prevent render-effect re-subscribe loops");
});

test("C4: main and legacy Admin gates prevent unauthorized subscriptions", () => {
  const service = source("components/admin-legacy-sections.js");
  const main = source("components/admin-app.js");
  assert.ok(service.includes('adminDataSourcesFor(enabled ? section : "work")'));
  assert.ok(service.includes("requestedSources.map((name) => subscribers[name]())"));
  assert.ok(service.includes("active = false; cleanups.forEach((cleanup) => cleanup?.())"));
  assert.ok(service.includes("useAdminData(safe, Boolean(user?.uid && canAccessAdminSection(profile, safe)))"));
  assert.ok(main.includes("useAdminData(canonical,Boolean(user?.uid&&canAccessAdminSection(profile,canonical)))"));
  assert.ok(!main.includes("data=useAdminData()"));
});

test("C4: account-level Business pages use portfolio without 12 selected-business listeners", () => {
  const context = source("components/business/business-context.js");
  assert.ok(context.includes("const accountLevel = isBusinessAccountSection(businessSectionFromPath(pathname))"));
  assert.ok(context.includes("if (!selectedBusinessId || accountLevel)"));
  assert.ok(context.includes("if (!selectedBusinessId || accountLevel) return;"));
  assert.ok(context.includes("if (accountLevel) return undefined;"));
  assert.ok(context.includes('authenticatedFetch("/api/business/portfolio"'), "portfolio must still load");
  for (const listener of ["subscribeBusiness(", "subscribeBranches(", "subscribeBusinessCatalog(", "subscribeOrdersForBusiness(", "subscribeBusinessClaimsForBusiness(", "subscribeBusinessPayouts("]) {
    assert.ok(context.includes(listener), `${listener} must remain in operational pages`);
  }
});

test("C4: active Driver operations retains 15-second cadence and pauses when hidden", () => {
  const client = source("components/admin-driver-operations.js");
  assert.ok(client.includes('document.visibilityState !== "hidden"'));
  assert.ok(client.includes('document.visibilityState === "visible"'));
  assert.ok(client.includes('window.setInterval(pollWhenVisible, 15000)'));
  assert.ok(client.includes('requestInFlight.current'));
  assert.ok(client.includes('document.removeEventListener("visibilitychange", resume)'));
  assert.ok(client.includes('authenticatedFetch("/api/admin/driver-network")'));
});

test("C4: filtered driver review queue excludes unrelated records without altering output contract", async () => {
  const h = routeHarness(root, {
    "@/lib/driver-delivery-server": { docsData: (snapshot) => snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) },
    "@/lib/driver-capabilities": { capabilityRequirements: () => ({ ready: true }), normalizeCapabilities: () => [] }
  });
  h.records.set("drivers/d1", { displayName: "Test Driver", city: "Harare", status: "approved" });
  h.records.set("driverApplications/d1", { userId: "d1", legalName: "Test Driver", status: "under_review" });
  // The old unfiltered .limit(2000) would exhaust its scan on these unrelated
  // records and miss the relevant review at the end of the collection.
  for (let i = 0; i < 2001; i++) h.records.set(`adminQueueItems/unrelated-${i}`, { queue: "payments", status: "open" });
  h.records.set("adminQueueItems/review-d1", { queue: "driver-documents", status: "open", driverId: "d1", title: "Check identity" });
  const route = h.load("app/api/admin/driver-network/route.js");
  const response = await route.GET(new Request("https://spotly.example/api/admin/driver-network"));
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.ok, true);
  assert.equal(data.summary.drivers, 1);
  assert.equal(data.summary.documentReviews, 1);
  assert.equal(data.queues.documentReviews[0].queueItemId, "review-d1");
  assert.equal(data.queues.applicationReviews.length, 0);
  assert.ok(Array.isArray(data.drivers));
  assert.ok(Array.isArray(data.activeWork.rides));
  assert.ok(Array.isArray(data.activeWork.send));
});

test("C4: driver network query keeps the original authorization, caps and recovery fallback", () => {
  const route = source("app/api/admin/driver-network/route.js");
  assert.ok(route.includes("await authenticateRequest(request, { roles: ADMIN_ROLES })"));
  assert.ok(route.includes('.where("queue", "in", ["driver-applications", "driver-documents", "driver-vehicles"])'));
  assert.ok(route.includes("if (![9, \"failed-precondition\"].includes(error?.code)) throw error"));
  assert.ok(route.includes('queueRef.limit(2000).get()'));
  assert.ok(route.includes('db.collection("driverDocuments").limit(2000).get()'));
  assert.ok(route.includes("return Response.json({"));
});

test("C4: driver review queue uses bounded legacy fallback only for a missing index", async () => {
  let db;
  const attempted = { filtered: 0, fallback: 0 };
  const h = routeHarness(root, {
    "@/lib/driver-delivery-server": { docsData: (snapshot) => snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) },
    "@/lib/driver-capabilities": { capabilityRequirements: () => ({ ready: true }), normalizeCapabilities: () => [] },
    "@/lib/firebase-admin": {
      authenticateRequest: async () => ({ uid: "admin" }),
      getAdminServices: () => ({ db }),
      apiError: (error) => Response.json({ ok: false, error: error.message }, { status: error.status || 500 })
    }
  });
  db = {
    ...h.db,
    collection(name) {
      const base = h.db.collection(name);
      if (name !== "adminQueueItems") return base;
      return {
        where: () => ({ limit: () => ({ get: async () => {
          attempted.filtered += 1;
          throw Object.assign(new Error("index unavailable"), { code: 9 });
        } }) }),
        limit: (n) => ({ get: async () => { attempted.fallback += 1; return base.limit(n).get(); } })
      };
    }
  };
  h.records.set("adminQueueItems/review", { queue: "driver-vehicles", status: "open", driverId: "d1" });
  const route = h.load("app/api/admin/driver-network/route.js");
  const warn = console.warn;
  let response;
  try { console.warn = () => {}; response = await route.GET(new Request("https://spotly.example/api/admin/driver-network")); }
  finally { console.warn = warn; }
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.summary.vehicleReviews, 1);
  assert.equal(attempted.filtered, 1);
  assert.equal(attempted.fallback, 1);
});


test("C4: network scan measurements reuse sampled, privacy-minimal C0 telemetry", () => {
  const route = source("app/api/admin/driver-network/route.js");
  const telemetry = source("lib/cost-observability-server.js");
  assert.ok(route.includes('recordCostEvent("admin.driver-network", {'));
  assert.ok(telemetry.includes('"admin.driver-network"'));
  assert.ok(telemetry.includes('process.env.SPOTLY_COST_TELEMETRY !== "true"'));
  assert.ok(!route.includes("console.log(drivers"));
});

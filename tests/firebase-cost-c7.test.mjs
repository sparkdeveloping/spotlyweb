import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { routeHarness } from "./helpers/route-harness.mjs";
import { REQUIRED_EVIDENCE, evaluateC7Release } from "../scripts/c7-release-gate.mjs";

const root = process.cwd();
const src = (p) => readFileSync(resolve(root,p),"utf8");
const fallbackMock = {
  "@/lib/book-live-domain": {
    appointmentRules: () => ({ capacity: 1, maxAdvanceDays: 30, durationMinutes: 30 }),
    appointmentSlotTimes: () => ["09:00"],
    bookingRules: () => ({ capacity: 2, minStayDays: 1, maxAdvanceDays: 30, capacityMode: "booking" }),
    bookingRangeValidation: () => ({ ok: true }),
    ticketRules: () => ({ salesOpen: true, transferable: true, maxQuantity: 8, cancellationCutoffMinutes: 0 }),
    dateKey: (d) => d, addDays: (d) => d
  },
  "@/lib/country-engine": { countryTimeZone: () => "Africa/Harare", normalizeCountryCode: () => "ZW" },
  "@/lib/service-availability-server": { requireServiceDiscoverable: () => ({ available: true }) },
};

function makeHarness({ limitResponse = null } = {}) {
  let db, reads = 0, appChecks = 0, quotaChecks = 0;
  const h = routeHarness(root, {
    ...fallbackMock,
    "@/lib/firebase-admin": {
      getAdminServices: () => ({ db }),
      verifyAppCheckRequest: async () => { appChecks++; },
      apiError: (error) => Response.json({ ok: false, error: error.message },{status:error.status||500})
    },
    "@/lib/rate-limit-server": { enforceRateLimit: async (_request, config) => {
      quotaChecks++;
      assert.equal(config.key,"public-transaction-availability");
      assert.equal(config.limit,60);
      if (limitResponse) throw limitResponse;
      return { remaining: 59 };
    } }
  });
  db = {
    collection(name) {
      if (name === "availabilityReservations") reads++;
      return h.db.collection(name);
    }
  };
  h.records.set("products/ticket-a", { businessId:"biz-a", name:"A ticket", capacity:100, reservedQuantity:4 });
  h.records.set("branches/branch-a", { businessId:"biz-a", country:"ZW", city:"Harare" });
  h.records.set("businesses/biz-a", { businessType:"ticketing_events",country:"ZW" });
  h.records.set("platformSettings/global", {});
  return { h, route: h.load("app/api/public/transactions/availability/route.js"), getCounts: () => ({ reads, appChecks, quotaChecks }) };
}

test("C7: Book/Live ticket availability does not scan reservation documents", async () => {
  const {route,getCounts}=makeHarness();
  const response=await route.GET(new Request("https://spotly.example/api/public/transactions/availability?itemId=ticket-a&branchId=branch-a"));
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.kind,"ticket");
  assert.equal(body.ticket.remaining,96);
  assert.deepEqual(getCounts(),{ reads:0, appChecks:1, quotaChecks:1 });
});

test("C7: appointments still read reservations and preserve remaining capacity", async () => {
  const {h,route,getCounts}=makeHarness();
  h.records.set("businesses/biz-a", { businessType:"appointments_services", country:"ZW" });
  h.records.set("products/ticket-a", { businessId:"biz-a", name:"Service", capacity:2 });
  const day=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Harare",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  h.records.set(`availabilityReservations/ticket-a_appointment_${day}_09_00`,{itemId:"ticket-a",reserved:1});
  const response=await route.GET(new Request("https://spotly.example/api/public/transactions/availability?itemId=ticket-a&branchId=branch-a&days=7"));
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.kind,"appointment");
  assert.equal(body.days[0].slots[0].remaining,0); // Reserved slot is not incorrectly shown available.
  assert.deepEqual(getCounts(),{reads:1,appChecks:1,quotaChecks:1});
});

test("C7: accommodation booking still retrieves its reservation capacity", async () => {
  const {h,route,getCounts}=makeHarness();
  h.records.set("businesses/biz-a", { businessType:"accommodation_activities", country:"ZW" });
  h.records.set("products/ticket-a", { businessId:"biz-a", name:"Room", capacity:2 });
  const response=await route.GET(new Request("https://spotly.example/api/public/transactions/availability?itemId=ticket-a&branchId=branch-a&days=7"));
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.kind,"booking");
  assert.ok(Array.isArray(body.days));
  assert.deepEqual(getCounts(),{reads:1,appChecks:1,quotaChecks:1});
});

test("C7: quota rejection blocks all business and reservation reads", async () => {
  const {route,getCounts}=makeHarness({limitResponse:Object.assign(new Error("Limit"),{status:429})});
  const response=await route.GET(new Request("https://spotly.example/api/public/transactions/availability?itemId=ticket-a&branchId=branch-a"));
  assert.equal(response.status,429);
  assert.deepEqual(getCounts(),{reads:0,appChecks:1,quotaChecks:1});
});

test("C7: Book/Live availability callers preserve cancellation and carry App Check",()=>{
  const marketplace=src("components/marketplace-app.js");
  const conversion=src("components/customer-conversion.js");
  assert.match(marketplace,/publicApiFetch\(`\/api\/public\/transactions\/availability/);
  assert.match(conversion,/publicApiFetch\(`\/api\/public\/transactions\/availability/);
  assert.match(conversion,/signal: controller\.signal/);
  assert.match(conversion,/controller\.abort\(\)/);
  assert.match(src("lib/api-client.js"),/await appCheckHeader\(\)/);
  const route=src("app/api/public/transactions/availability/route.js");
  assert.match(route,/await verifyAppCheckRequest\(request\)/);
  assert.match(route,/await enforceRateLimit\(request/);
});

function observations() {
  return {
    trafficMixComparable:true,
    evidence:Object.fromEntries(REQUIRED_EVIDENCE.map((key)=>[key,true])),
    baseline:{ platformCostUsd:100,firestoreReads:100000,rtdbDownloadBytes:10000000,activeDriverHours:100,completedCustomerOperations:1000,errorRate:0.01,offerP95Ms:1500,trackingP95Ms:1000,windowDays:7 },
    candidate:{ platformCostUsd:90,firestoreReads:80000,rtdbDownloadBytes:8000000,activeDriverHours:100,completedCustomerOperations:1000,errorRate:0.01,offerP95Ms:1500,trackingP95Ms:1000,windowDays:7 }
  };
}

test("C7: release stays NO_GO with absent evidence", () => {
  const value=evaluateC7Release({});
  assert.equal(value.decision,"NO_GO");
  assert.ok(value.checks.length >= 16);
});

test("C7: only complete, comparable, measured evidence can proceed to manual review",()=>{
  const report=observations();
  assert.equal(evaluateC7Release(report).decision,"READY_FOR_MANUAL_REVIEW");
  report.evidence.driverBackgroundGpsReconnect=false;
  assert.equal(evaluateC7Release(report).decision,"NO_GO");
});

test("C7: cost and reliability regressions block promotion",()=>{
  for(const [key,value] of [["platformCostUsd",120],["firestoreReads",120000],["rtdbDownloadBytes",15000000],["errorRate",0.03],["offerP95Ms",1900],["trackingP95Ms",1800]]) {
    const candidate=observations(); candidate.candidate[key]=value;
    assert.equal(evaluateC7Release(candidate).decision,"NO_GO",key);
  }
});

test("C7: missing, invalid or zero-denominator cost observations never pass",()=>{
  for(const bad of [undefined,NaN,-5,0]) {
    const candidate=observations(); candidate.candidate.completedCustomerOperations=bad;
    assert.equal(evaluateC7Release(candidate).decision,"NO_GO");
  }
});

test("C7: experimental C0–C6 toggles remain off by default",()=>{
  const env=src(".env.example");
  for(const expected of ["SPOTLY_SHARED_SERVICE_FEED_CACHE=false","SPOTLY_PUBLIC_GET_LIMITER=firestore","SPOTLY_RTDB_INDEXED_PRESENCE_READS=false"]) assert.ok(env.includes(expected));
  assert.match(src("lib/driver-presence-query.mjs"),/root\.get\(\)/);
  assert.match(src("lib/rate-limit-server.js"),/process\.env\.SPOTLY_PUBLIC_GET_LIMITER === "upstash"/);
});

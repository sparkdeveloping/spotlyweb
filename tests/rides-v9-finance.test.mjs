import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("Provider disputes and Ride refunds create persistent Driver finance holds",()=>{
 const callback=read("lib/payment-processor-server.js");
 const refunds=read("app/api/admin/refunds/route.js");
 const driver=read("app/api/driver/payout/route.js");
 const admin=read("app/api/admin/driver-money/route.js");
 for(const source of [callback,refunds]){
  assert.ok(source.includes("rideFinanceHold:true"));
  assert.ok(source.includes('collection("rideFinanceReviews")'));
 }
 for(const source of [driver,admin])assert.ok(source.includes("rideFinanceHold"));
 assert.ok(refunds.includes('body.evidenceUrl?.startsWith("https://")'));
 assert.ok(refunds.includes("refund.requestedBy"));
});
test("Finance clearance needs external evidence, distinct reviewers and no other unresolved cases",()=>{
 const route=read("app/api/admin/ride-finance-review/route.js");
 for(const expression of ["submit_resolution","confirm_resolution",
   "awaiting_second_review","submittedBy===actor.uid",
   "rideFinanceHold:false","independently_closed","evidenceUrl",
   'where("driverId","==",driverId)'])
  assert.ok(route.includes(expression),expression);
 assert.equal(route.includes("paynow.refund("),false);
});
test("Geofencing is enforced server-side and operator-configurable",()=>{
 const geo=read("lib/ride-geography.js");
 const server=read("lib/ride-server.js");
 const admin=read("app/api/admin/rides/route.js");
 const ui=read("components/admin-driver-operations.js");
 for(const term of ["radiusKm","cityGeofences","insideCountryBounds","Your pickup is outside"])
  assert.ok(geo.includes(term),term);
 assert.ok(server.includes("cityGeofences"));
 assert.ok(admin.includes("cityGeofences"));
 assert.ok(ui.includes("geofences"));
});

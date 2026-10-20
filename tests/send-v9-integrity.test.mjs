import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {newParcelPin,sealParcelPin,revealParcelPin,matchesParcelPin,expectedParcelProofPath} from "../lib/send-security.js";
import {validateSendTerritory} from "../lib/send-territory.js";
const read=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
const pickup={lat:-17.83,lng:31.04,country:"ZW",city:"Harare",area:"CBD"};
const dropoff={...pickup,lat:-17.85};
const policy={enabledCities:["Harare"],enabledAreas:{},cityGeofences:{"ZW:harare":{country:"ZW",lat:-17.83,lng:31.04,radiusKm:35}}};
test("Zimbabwe-only pickup territory is authenticated against operator geofences",()=>{
 assert.equal(validateSendTerritory(pickup,dropoff,policy).country,"ZW");
 assert.throws(()=>validateSendTerritory({...pickup,country:"MW"},dropoff,policy));
 assert.throws(()=>validateSendTerritory(pickup,{...dropoff,country:"MW"},policy));
 assert.throws(()=>validateSendTerritory(pickup,dropoff,{...policy,cityGeofences:{}}));
 assert.throws(()=>validateSendTerritory({...pickup,lat:-21},dropoff,policy));
});
test("Sender and recipient handoffs use encrypted six-digit codes and scoped proof path",()=>{
 const secret="test-secret-".repeat(7);
 process.env.SPOTLY_SEND_PIN_KEY=secret;
 try{
  const pin=newParcelPin();assert.match(pin,/^\d{6}$/);
  const cipher=sealParcelPin(pin);assert.ok(!cipher.includes(pin));
  const doc={pickupPinCiphertext:cipher,dropoffPinCiphertext:cipher};
  assert.equal(revealParcelPin(doc,"pickup"),pin);
  assert.equal(matchesParcelPin(doc,"dropoff",pin),true);
  assert.equal(matchesParcelPin(doc,"pickup","123456"),pin==="123456");
  assert.equal(expectedParcelProofPath("driver-A","parcel-B"),"driver-send-proof/driver-A/parcel-B/");
 }finally{delete process.env.SPOTLY_SEND_PIN_KEY}
});
test("Send never goes live through legacy peer-delivery flags or incomplete infrastructure",()=>{
 const code=read("lib/parcel-server.js");
 for(const token of ['send.enabled === true',"SPOTLY_SEND_PIN_KEY","SPOTLY_GEOCODING_URL",
  "dispatchSchedulerVerified","maxSearchSeconds","locationUpdatedAt?.toMillis",
  "cityGeofences","pickupPinCiphertext","dropoffPinCiphertext"])
  assert.ok(code.includes(token)||read("app/api/customer/parcels/route.js").includes(token),token);
 assert.ok(!code.includes("settings.commerce?.peerDeliveryEnabled === true"));
});
test("Send booking verifies external road metrics, price lock and post-write recovery",()=>{
 const request=read("app/api/customer/parcels/route.js");
 const quote=read("app/api/customer/parcels/quote/route.js");
 const refresh=read("app/api/customer/parcels/refresh/route.js");
 for(const s of [request,quote])assert.ok(s.includes("getVerifiedRideRoute"));
 for(const term of ["validateSendTerritory","quotedTotal","quotedCurrency","sealParcelPin"])
  assert.ok(request.includes(term));
 assert.ok(refresh.includes("authenticateRequest"));
 assert.ok(refresh.includes("dispatch.scheduled_due"));
});
test("Send payment capture, delivery and Driver payouts require verified financial status",()=>{
 const processor=read("lib/payment-processor-server.js");
 const driver=read("app/api/driver/parcels/route.js");
 const payout=read("app/api/driver/payout/route.js");
 const adminMoney=read("app/api/admin/driver-money/route.js");
 for(const term of ["parcel?.state", "parcel.earningsCreditedAt","creditParcelEarnings",
  "sendFinanceHold:true","parcel.paymentReviewRequired"])
  assert.ok(processor.includes(term)||driver.includes(term),term);
 for(const term of ["matchesParcelPin","parcelPinAttempts","cashReceived","cash_driver_attested",
  'parcel.paymentStatus==="paid"',"report_handoff_problem","confirm_return"])
  assert.ok(driver.includes(term),term);
 assert.ok(payout.includes("sendFinanceHold"));
 assert.ok(adminMoney.includes("sendFinanceHold"));
});
test("Parcel recovery is transaction-safe and independent reviewers are required",()=>{
 const ops=read("app/api/admin/send-recovery/route.js");
 for(const term of ["db.runTransaction","arrange_return","mark_lost","resolve_uncollected",
  "record_external_resolution","confirm_external_resolution","awaiting_independent_confirmation",
  "requestedBy===actor.uid","independently_closed","sendFinanceExternalReferences"])
  assert.ok(ops.includes(term),term);
 assert.ok(!ops.includes("paynow.refund("));
});
test("Visible admin launch center uses authorized guarded activation endpoint",()=>{
 const api=read("app/api/admin/service-launch/route.js");
 const ui=read("components/admin-mobility-launch.js");
 const mobility=read("components/admin-driver-operations.js");
 for(const term of ["ENABLE SPOTLY","confirmation","prerequisites","dispatchSchedulerVerified","cityGeofences"])assert.ok(api.includes(term),term);
 assert.ok(ui.includes("Customer booking disabled"));
 assert.ok(mobility.includes("Service Launch"));
});

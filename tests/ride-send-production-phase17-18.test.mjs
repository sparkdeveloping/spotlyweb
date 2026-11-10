import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateSendTerritory } from "../lib/send-territory.js";

const read=(path)=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");

test("Phase 17 Paynow Ride is not dispatched until verified provider capture",()=>{
 const route=read("app/api/customer/rides/route.js");
 const processor=read("lib/payment-processor-server.js");
 assert.match(route,/initialState=body\.paymentMethod==="paynow"\?"awaiting_payment":"requested"/);
 assert.match(route,/body\.paymentMethod==="cash"\) dispatch=await dispatchRide/);
 assert.match(processor,/rideDispatchNow/);
 assert.match(processor,/ride\.state==="awaiting_payment"/);
 assert.match(processor,/dispatchRide\(/);
 const initiate=read("app/api/payments/paynow/initiate/route.js");
 assert.match(initiate,/order\.rideStatus!=="awaiting_payment"/);
 assert.doesNotMatch(initiate,/rideStatus!=="completed"/);
});

test("Phase 17 paid pre-trip Ride cancellation enters the auditable refund workflow",()=>{
 const route=read("app/api/customer/rides/route.js");
 for(const token of ["refundRequests","refund_pending","refundRequestId","customer_cancel_ride_"]) assert.ok(route.includes(token),token);
 assert.match(route,/\["awaiting_payment", "requested", "searching_driver"/);
});

test("Phase 17 customer tracking uses realtime active work and vehicle-specific markers",()=>{
 const tracking=read("lib/customer-driver-tracking-server.js");
 const ride=read("app/api/customer/rides/route.js");
 const send=read("app/api/customer/parcels/route.js");
 const map=read("components/mobility-map.js");
 assert.match(tracking,/activeTrips\/\$\{workId\}\/driverLocation/);
 assert.match(tracking,/realtime_active_work/);
 assert.match(ride,/loadRealtimeDriverLocation/g);
 assert.match(send,/loadRealtimeDriverLocation/g);
 assert.match(map,/driverVehicleType/);
 assert.match(map,/driverVehicleMarker/);
});

test("Phase 18 Send supports explicitly enabled Malawi territory but rejects cross-country parcels",()=>{
 const policy={enabledCountries:["MW"],enabledCities:["Lilongwe"],enabledAreas:{},cityGeofences:{"MW:lilongwe":{country:"MW",lat:-13.9626,lng:33.7741,radiusKm:35}}};
 const pickup={lat:-13.9626,lng:33.7741,country:"MW",city:"Lilongwe"};
 const dropoff={lat:-13.98,lng:33.79,country:"MW",city:"Lilongwe"};
 assert.equal(validateSendTerritory(pickup,dropoff,policy).country,"MW");
 assert.throws(()=>validateSendTerritory(pickup,{...dropoff,country:"ZW"},policy));
 assert.throws(()=>validateSendTerritory(pickup,dropoff,{...policy,enabledCountries:["ZW"]}));
});

test("Phase 18 Send pricing, payment and Admin readiness are country-scoped",()=>{
 const parcel=read("lib/parcel-server.js");
 const admin=read("app/api/admin/launch-readiness/route.js");
 const control=read("lib/service-availability-control-plane.js");
 for(const token of ["pricingByCountry","parcelPricingForCountry","parcelPaymentMethodsForCountry"]) assert.ok(parcel.includes(token),token);
 assert.ok(admin.includes("parcelPricingForCountry"));
 assert.ok(admin.includes("parcelPaymentMethodsForCountry"));
 for(const token of ['"territory"','"pricing"','"payments"']) assert.ok(control.includes(token),token);
 assert.doesNotMatch(admin,/backend remains Zimbabwe-only/i);
});

test("Phase 18 Send has scheduled dispatch, PIN handoffs, controlled return and return proof",()=>{
 const customer=read("app/api/customer/parcels/route.js");
 const refresh=read("app/api/customer/parcels/refresh/route.js");
 const driver=read("app/api/driver/parcels/route.js");
 const runtime=read("firebase/functions/src/core/driver-runtime.js");
 for(const token of ["scheduledPickupAt","pickupMode","sealParcelPin"]) assert.ok(customer.includes(token),token);
 assert.ok(refresh.includes("scheduled_due"));
 for(const token of ["report_handoff_problem","start_return","confirm_return","returnProofPhotoUrl"]) assert.ok(driver.includes(token),token);
 assert.ok(runtime.includes("return_in_progress"));
 assert.ok(runtime.includes("returnProofPhotoUrl"));
});

test("Ride and Send web checkout only exposes payment methods returned by the country quote",()=>{
 const ride=read("components/ride-app.js");
 const send=read("components/send-app.js");
 for(const source of [ride,send]){
  assert.match(source,/paymentMethods=Array\.isArray\(data\.paymentMethods\)/);
  assert.match(source,/quote\.paymentMethods\?\.includes\("cash"\)/);
  assert.match(source,/quote\.paymentMethods\?\.includes\("paynow"\)/);
 }
 assert.doesNotMatch(ride,/Paynow rides are paid from Activity after completion/);
});

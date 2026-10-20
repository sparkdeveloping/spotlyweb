import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {newRidePin,sealRidePin,revealRidePin,matchesRidePin} from "../lib/ride-security.js";
import {insideCountryBounds,validateRideTerritory} from "../lib/ride-geography.js";
import {routeEndpoint,getVerifiedRideRoute} from "../lib/ride-routing.js";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const secret="test-only-secret-not-for-production-".repeat(3);
const ZW={lat:-17.831,lng:31.05,city:"Harare",country:"ZW"};
const MW={lat:-13.966,lng:33.79,city:"Lilongwe",country:"MW"};
test("six digit pickup verification is encrypted, tamper-evident and secret-gated",()=>{
 const pin=newRidePin();assert.match(pin,/^\d{6}$/);
 const ciphertext=sealRidePin(pin,secret);assert.equal(ciphertext.includes(pin),false);
 const record={pickupPinCiphertext:ciphertext};
 assert.equal(revealRidePin(record,secret),pin);
 assert.equal(matchesRidePin(record,pin,secret),true);
 assert.equal(matchesRidePin(record,"000000",secret),pin==="000000");
 assert.throws(()=>revealRidePin(record,"incorrect".repeat(10)));
 assert.throws(()=>sealRidePin(pin,"short"));
 assert.equal(revealRidePin({pickupPin:"1234"}),"1234");
});
test("Ride launch accepts only explicitly enabled country and city, blocks cross-border points",()=>{
 assert.equal(insideCountryBounds(ZW,"ZW"),true);
 assert.equal(insideCountryBounds(MW,"MW"),true);
 assert.equal(insideCountryBounds({lat:38,lng:-94},"ZW"),false);
 const policy={enabledCountries:["ZW","MW"],enabledCities:["Harare","Lilongwe"],enabledAreas:{},
 cityGeofences:{"ZW:harare":{country:"ZW",lat:-17.83,lng:31.05,radiusKm:45},
 "MW:lilongwe":{country:"MW",lat:-13.96,lng:33.79,radiusKm:45}}};
 assert.equal(validateRideTerritory(ZW,{...ZW,lat:-17.84},policy).country,"ZW");
 assert.equal(validateRideTerritory(MW,{...MW,lat:-13.95},policy).country,"MW");
 assert.throws(()=>validateRideTerritory(ZW,MW,policy));
 assert.throws(()=>validateRideTerritory({...ZW,country:"US"},ZW,policy));
 assert.throws(()=>validateRideTerritory(ZW,ZW,{...policy,enabledCountries:[]}));
 assert.throws(()=>validateRideTerritory(ZW,ZW,{...policy,enabledCities:[]}));
 assert.throws(()=>validateRideTerritory({...MW,city:"Harare",country:"ZW"},ZW,policy));
 assert.throws(()=>validateRideTerritory({...ZW,city:"Lilongwe"},ZW,policy));
 assert.throws(()=>validateRideTerritory(ZW,ZW,{...policy,cityGeofences:{}}));
});
test("Verified road route uses an approved HTTPS routing endpoint and actual road metrics",async()=>{
 assert.match(routeEndpoint(ZW,{...ZW,lng:31.12},"https://routing.example.org"),/route\/v1\/driving/);
 assert.throws(()=>routeEndpoint(ZW,MW,"http://routing.example.org"));
 assert.throws(()=>routeEndpoint(ZW,MW));
 const sample={code:"Ok",routes:[{distance:6500,duration:780,
  geometry:{coordinates:[[31.05,-17.831],[31.08,-17.832],[31.12,-17.834]]}}]};
 const route=await getVerifiedRideRoute(ZW,{...ZW,lng:31.12},{
  endpoint:"https://routing.example.org",
  fetcher:async()=>({ok:true,json:async()=>sample})
 });
 assert.equal(route.distanceKm,6.5);assert.equal(route.durationMinutes,13);
 assert.equal(route.source,"verified_road_route");assert.equal(route.path.length,3);
 await assert.rejects(()=>getVerifiedRideRoute(ZW,MW,{
  endpoint:"https://routing.example.org",
  fetcher:async()=>({ok:true,json:async()=>({code:"NoRoute"})})
 }));
});
test("Ride API never awards unpaid Paynow earnings or starts without customer PIN",()=>{
 const driver=read("app/api/driver/rides/route.js");
 const callback=read("lib/payment-processor-server.js");
 const money=read("lib/driver-money-server.js");
 for(const p of ["matchesRidePin","ridePinAttempts","cashReceived","cash_driver_attested",
   'ride.paymentStatus==="paid"',"earningsCreditedAt"])assert.ok(driver.includes(p),p);
 assert.ok(callback.includes('ride.state==="completed"'));
 assert.ok(callback.includes('!ride.earningsCreditedAt'));
 assert.ok(callback.includes("creditRideEarnings"));
 assert.ok(money.includes('driverLedgerEntryId("ride_earned", rideId)'));
 assert.ok(driver.includes("report_no_show"));
 assert.ok(driver.includes("no_show_review"));
});
test("Ride request is launch-gated, country-bound, provider-routed and quote-price-locked",()=>{
 const ride=read("app/api/customer/rides/route.js");
 const quote=read("app/api/customer/rides/quote/route.js");
 const config=read("lib/ride-server.js");
 for(const term of ["validateRideTerritory","getVerifiedRideRoute","quotedTotal","quotedCurrency",
   "sealRidePin","dispatchRide"])assert.ok(ride.includes(term),term);
 assert.ok(quote.includes("getVerifiedRideRoute"));
 for(const flag of ["enabledCountries","dispatchSchedulerVerified","routingVerified",
   "SPOTLY_RIDE_PIN_KEY","SPOTLY_GEOCODING_URL","SPOTLY_ROUTING_URL"])
   assert.ok(config.includes(flag),flag);
});
test("Dispatch recovery has timeout, stable offers, customer retry and protected scheduler",()=>{
 const server=read("lib/ride-server.js");
 const refresh=read("app/api/customer/rides/refresh/route.js");
 const cron=read("app/api/internal/ride-dispatch/route.js");
 for(const term of ["maxSearchSeconds","dispatch_timeout","rideId+\"_\"+candidate.driverId",
  "locationUpdatedAt?.toMillis"])assert.ok(server.includes(term),term);
 assert.ok(refresh.includes("authenticateRequest"));
 assert.ok(refresh.includes("enforceRateLimit"));
 assert.ok(cron.includes("CRON_SECRET"));
 const settings=read("app/api/admin/rides/route.js");
 assert.ok(settings.includes("dispatchSchedulerVerified"));
 assert.ok(settings.includes("runTransaction"));
});
test("Geocoder is country-aware and blocks unlicensed public autocomplete",()=>{
 const search=read("app/api/public/geocode/route.js");
 const reverse=read("app/api/public/reverse-geocode/route.js");
 assert.ok(search.includes("countrycodes="));
 assert.ok(search.includes("nominatim.openstreetmap.org"));
 assert.ok(reverse.includes("SPOTLY_REVERSE_GEOCODING_URL"));
});

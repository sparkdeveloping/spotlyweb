import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("Scheduler proves real recurring authenticated callbacks instead of checkbox only",()=>{
 const health=read("lib/mobility-scheduler-health.js");
 const ride=read("app/api/internal/ride-dispatch/route.js");
 const send=read("app/api/internal/parcel-dispatch/route.js");
 const launch=read("app/api/admin/service-launch/route.js");
 for(const s of ["lastTickAt","consecutive","elapsed>=20000","elapsed<=240000","failed","210000"])
  assert.ok(health.includes(s),s);
 assert.ok(ride.includes('recordDispatchHeartbeat(db,"ride"'));
 assert.ok(send.includes('recordDispatchHeartbeat(db,"send"'));
 assert.ok(launch.includes("dispatchHealth(heartbeat||{})"));
 assert.ok(launch.includes('mobilityDispatchHealth'));
 assert.ok(launch.includes("licensedMapStyle()"));
});
test("GPS requires accurate fresh fixes, transactionally enforces online presence and filters jumps",()=>{
 const gps=read("app/api/driver/location/route.js");
 const client=read("components/driver-app.js");
 for(const s of ["accuracy","max(150)","fixAgeMs","runTransaction","haversineKm",
 "travelKm>0.45+elapsed*.065","locationUpdatedAt"])assert.ok(gps.includes(s),s);
 assert.ok(client.includes("watchPosition"));
 assert.ok(client.includes("fixAgeMs"));
 assert.ok(client.includes("lastFixRef"));
 assert.ok(client.includes("75000"));
});
test("Licensed geocoder preserves vendor credentials and client exposes map config without private keys",()=>{
 const forward=read("app/api/public/geocode/route.js"),reverse=read("app/api/public/reverse-geocode/route.js");
 const publicConfig=read("app/api/public/map-config/route.js");
 assert.ok(forward.includes('geocoder.searchParams.set("q",query)'));
 assert.ok(forward.includes("SPOTLY_GEOCODING_URL"));
 assert.ok(reverse.includes("SPOTLY_REVERSE_GEOCODING_URL"));
 assert.ok(publicConfig.includes("licensedMapStyle()"));
});

test("Admin does not advertise Paynow without actual merchant secrets",()=>{
 const launch=read("app/api/admin/service-launch/route.js");
 const secrets=read("lib/paynow-server.js");
 const admin=read("components/admin-mobility-launch.js");
 assert.ok(secrets.includes("paynowCredentialsConfigured"));
 assert.ok(launch.includes("config.paynowEnabled&&!paynowReady"));
 assert.ok(launch.includes('paynowCredentialsConfigured("USD")'));
 assert.ok(admin.includes("Paynow credentials"));
});

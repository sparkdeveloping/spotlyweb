import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {rideCreateRequestSchema,sendCreateRequestSchema} from "../lib/contracts/schemas.js";
import {routeEndpoint,interpretVerifiedRoute,getVerifiedRideRoute,assertRoadAccessConsent} from "../lib/ride-routing.js";
import {mobilityRequestFingerprint,mobilityRequestReferences,requireMatchingReplay,liveMobilityState} from "../lib/mobility-request-integrity.js";
import {hasVerifiedRoadAccess,needsRoadAccessAcknowledgement,roadAccessConsent} from "../lib/mobility-road-access-client.js";

const pickup={lat:-17.829,lng:31.047,country:"ZW",city:"Harare",area:"Harare",label:"Road pickup"};
const dropoff={lat:-17.806,lng:31.061,country:"ZW",city:"Harare",label:"Destination"};
const waypoints=[pickup,dropoff];
const route=(start=pickup,end=dropoff)=>({code:"Ok",waypoints:[
 {location:[start.lng,start.lat],name:"Road A"},{location:[end.lng,end.lat],name:"Road B"}],
 routes:[{distance:3400,duration:490,geometry:{coordinates:[[start.lng,start.lat],[31.054,-17.820],[end.lng,end.lat]]}}]});
const access={acknowledged:true,pickup:{lat:pickup.lat,lng:pickup.lng},destination:{lat:dropoff.lat,lng:dropoff.lng}};
const base={action:"request",idempotencyKey:"550e8400-e29b-41d4-a716-446655440000",
 roadAccessConsent:access,pickup,dropoff,quotedTotal:6.57,quotedCurrency:"USD",paymentMethod:"cash"};
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("native Ride request including idempotency and reviewed road coordinates passes strict parsing",()=>{
 const payload={...base,serviceType:"economy",riderName:"Example Customer",riderPhone:""};
 const parsed=rideCreateRequestSchema.safeParse(payload);
 assert.equal(parsed.success,true,parsed.error?.message);
 assert.equal(rideCreateRequestSchema.safeParse({...payload,idempotencyKey:"unsafe key!"}).success,false);
 assert.equal(rideCreateRequestSchema.safeParse({...payload,roadAccessConsent:{...access,acknowledged:false}}).success,false);
 assert.equal(rideCreateRequestSchema.safeParse({...payload,roadAccessConsent:{...access,secret:"x"}}).success,false);
 assert.equal(rideCreateRequestSchema.safeParse({...payload,unexpected:true}).success,false);
 const {idempotencyKey,roadAccessConsent,...legacy}=payload;
 assert.equal(rideCreateRequestSchema.safeParse(legacy).success,true);
});

test("native Send request accepts both protections without weakening required handoff fields",()=>{
 const payload={...base,parcelSize:"medium",senderName:"Sender",senderPhone:"+263777000000",
 recipientName:"Receiver",recipientPhone:"+263777000001",parcelDescription:"Small box",
 pickupMode:"now",prohibitedAcknowledged:true};
 assert.equal(sendCreateRequestSchema.safeParse(payload).success,true);
 assert.equal(sendCreateRequestSchema.safeParse({...payload,recipientPhone:""}).success,false);
 assert.equal(sendCreateRequestSchema.safeParse({...payload,prohibitedAcknowledged:false}).success,false);
});

test("MapMap web and Firebase route contracts use bounded snapping, not distant road guesses",async()=>{
 const from=pickup,to=dropoff,key="snk_"+"A".repeat(32);
 const url=routeEndpoint(from,to,"https://api.mapmap.ai",key);
 assert.equal(new URL(url).searchParams.get("snap_retry"),"false");
 assert.equal(new URL(url).searchParams.has("radiuses"),false);
 const generic=routeEndpoint(from,to,"https://licensed-routing.example.com");
 assert.equal(new URL(generic).searchParams.get("radiuses"),"350;350");
 const verified=await getVerifiedRideRoute(from,to,{endpoint:"https://api.mapmap.ai",apiKey:key,
  fetcher:async(actual)=>{assert.equal(actual,url);return {status:200,ok:true,json:async()=>route()};}});
 assert.equal(verified.distanceKm,3.4);
 assert.equal(verified.durationMinutes,9);
 assert.equal(verified.accessPoints.pickup.requiresConfirmation,false);
 assert.equal(assertRoadAccessConsent(verified,undefined),false);
});

test("material road access requires consent to the same verified curb points",()=>{
 const moved={...pickup,lat:pickup.lat+80/111195};
 const quoted=interpretVerifiedRoute(route(moved,dropoff),pickup,dropoff);
 assert.equal(quoted.accessPoints.pickup.requiresConfirmation,true);
 assert.throws(()=>assertRoadAccessConsent(quoted,undefined),e=>e.status===409);
 const consent={acknowledged:true,pickup:{lat:quoted.accessPoints.pickup.lat,lng:quoted.accessPoints.pickup.lng},
  destination:{lat:quoted.accessPoints.destination.lat,lng:quoted.accessPoints.destination.lng}};
 assert.equal(assertRoadAccessConsent(quoted,consent),true);
 assert.throws(()=>assertRoadAccessConsent(quoted,access),e=>e.status===409);
 assert.equal(interpretVerifiedRoute(route({...pickup,lat:pickup.lat+360/111195},dropoff),pickup,dropoff),null);
});

test("replays are stable, scoped to one customer and refuse changed content",()=>{
 const fingerprint=mobilityRequestFingerprint(base);
 assert.equal(fingerprint,mobilityRequestFingerprint({...base,idempotencyKey:"another-key"}));
 assert.notEqual(fingerprint,mobilityRequestFingerprint({...base,quotedTotal:9}));
 const db={collection(name){return {doc(key){return name+"/"+key;}}}};
 assert.notEqual(mobilityRequestReferences(db,"uid1","ride",base.idempotencyKey).requestRef,
  mobilityRequestReferences(db,"uid2","ride",base.idempotencyKey).requestRef);
 assert.equal(requireMatchingReplay({exists:true,data(){return {fingerprint,response:{rideId:"r1"}};}},fingerprint).rideId,"r1");
 assert.throws(()=>requireMatchingReplay({exists:true,data(){return {fingerprint:"wrong",response:{rideId:"r1"}};}},fingerprint),e=>e.status===409);
 assert.equal(liveMobilityState("in_trip","ride"),true);
 assert.equal(liveMobilityState("completed","ride"),false);
 for(const path of ["app/api/customer/rides/route.js","app/api/customer/parcels/route.js"]){
  const src=read(path);
  assert.match(src,/requireMatchingReplay\(await requestRef\.get\(\),fingerprint\)/);
  assert.match(src,/transaction\.get\(activeRef\)/);
  assert.match(src,/transaction\.create\(requestRef/);
  assert.match(src,/assertRoadAccessConsent\(/);
  assert.match(src,/if\(transactionResult\.reused\)/);
 }
});

test("web Ride and Send present the same curb consent and retry contract as iOS",()=>{
 const direct={pickup:{lat:pickup.lat,lng:pickup.lng,distanceMeters:0,requiresConfirmation:false},
  destination:{lat:dropoff.lat,lng:dropoff.lng,distanceMeters:0,requiresConfirmation:false}};
 assert.equal(hasVerifiedRoadAccess(direct),true);
 assert.equal(needsRoadAccessAcknowledgement(direct),false);
 assert.equal(roadAccessConsent(direct,false),undefined);
 const adjusted={...direct,pickup:{...direct.pickup,distanceMeters:80,requiresConfirmation:true,roadName:"Bessemer Road"}};
 assert.equal(needsRoadAccessAcknowledgement(adjusted),true);
 assert.equal(roadAccessConsent(adjusted,false),undefined);
 assert.deepEqual(roadAccessConsent(adjusted,true),{acknowledged:true,
  pickup:{lat:pickup.lat,lng:pickup.lng},destination:{lat:dropoff.lat,lng:dropoff.lng}});
 assert.equal(hasVerifiedRoadAccess({...direct,pickup:{...direct.pickup,distanceMeters:800}}),false);
 for(const file of ["components/ride-app.js","components/send-app.js"]){
  const src=read(file);
  assert.match(src,/roadAccessConsent\(quote\.accessPoints,roadAccessAcknowledged\)/);
  assert.match(src,/hasVerifiedRoadAccess\(quote\.accessPoints\)/);
  assert.match(src,/needsRoadAccessAcknowledgement\(quote\.accessPoints\)/);
  assert.match(src,/crypto\.randomUUID\(\)/);
 }
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {routeEndpoint,routingConfiguration,getVerifiedRideRoute} from "../lib/ride-routing.js";

const endpoint="https://api.mapmap.ai";
const key="snk_"+ "A".repeat(32);
const from={lat:-17.83382,lng:31.03853},to={lat:-17.7588,lng:31.0835};
const data={code:"Ok",routes:[{distance:11320.37,duration:980.5,geometry:{type:"LineString",
  coordinates:[[from.lng,from.lat],[31.053,-17.805],[to.lng,to.lat]]}}]};
const response=(body=data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body});
test("MapMap OSRM endpoint uses lon,lat pairs, GeoJSON route and API key in headers only",async()=>{
 const url=routeEndpoint(from,to,endpoint,key);
 assert.match(url,/\/route\/v1\/driving\/31\.038530,-17\.833820;31\.083500,-17\.758800/);
 assert.equal(new URL(url).searchParams.get("geometries"),"geojson");
 assert.ok(!url.includes(key));
 const verified=await getVerifiedRideRoute(from,to,{endpoint,apiKey:key,
  fetcher:async(actual,opts)=>{
   assert.equal(actual,url);assert.equal(opts.headers.Authorization,"Bearer "+key);
   assert.equal(opts.headers.Accept,"application/json");
   assert.equal(opts.redirect,"error");
   assert.equal(opts.cache,"no-store");
   return response();
  }});
 assert.equal(verified.source,"verified_road_route");
 assert.equal(verified.distanceKm,11.32);
 assert.equal(verified.durationMinutes,17);
 assert.equal(verified.path.length,3);
});
test("MapMap configuration fails closed when credential or provider URL is missing",()=>{
 assert.equal(routingConfiguration({endpoint,apiKey:""}).ready,false);
 assert.equal(routingConfiguration({endpoint,apiKey:"wrong"}).ready,false);
 assert.equal(routingConfiguration({endpoint,apiKey:key}).ready,true);
 assert.equal(routingConfiguration({endpoint:"https://api.mapmap.ai/route/v1",apiKey:key}).ready,false);
 assert.equal(routingConfiguration({endpoint:"http://api.mapmap.ai",apiKey:key}).ready,false);
 assert.equal(routingConfiguration({endpoint:"https://router.project-osrm.org",apiKey:key}).ready,false);
 assert.throws(()=>routeEndpoint(from,to,endpoint,""),/API key/);
 assert.throws(()=>routeEndpoint(from,from,endpoint,key),/two different locations/);
});
test("Other licensed OSRM endpoints never receive the MapMap bearer key",async()=>{
 const other="https://licensed-routing.example.net";
 const result=await getVerifiedRideRoute(from,to,{endpoint:other,apiKey:key,fetcher:async(_,opts)=>{
  assert.equal(opts.headers.Authorization,undefined);
  return response();
 }});
 assert.equal(result.source,"verified_road_route");
});
test("Provider errors surface actionable messages without leaking credentials",async()=>{
 const outcomes=[
  [401,/Routing access was rejected/],
  [402,/quota, credits or rate limit/],
  [429,/quota, credits or rate limit/],
  [502,/temporarily unavailable/]
 ];
 for(const [status,pattern] of outcomes)
  await assert.rejects(()=>getVerifiedRideRoute(from,to,{endpoint,apiKey:key,
    fetcher:async()=>response({detail:"secret "+key},status)}),pattern);
 await assert.rejects(()=>getVerifiedRideRoute(from,to,{endpoint,apiKey:key,
   fetcher:async()=>{throw Error("secret "+key);}}),/could not be reached/);
});
test("Malformed or spoofed route geometry never reaches fare calculation",async()=>{
 for(const bad of [
  {code:"Ok",routes:[{distance:10000,duration:700,geometry:{coordinates:[]}}]},
  {code:"Ok",routes:[{distance:10000,duration:700,geometry:{coordinates:[[31.03,-17.83],[1000,1000]]}}]},
  {code:"Ok",routes:[{distance:10000,duration:700,geometry:{coordinates:[[32,-20],[32.1,-20.1]]}}]},
  {code:"NoRoute",routes:[]}
 ]){
  await assert.rejects(()=>getVerifiedRideRoute(from,to,{endpoint,apiKey:key,fetcher:async()=>response(bad)}));
 }
});
test("Ride/Send quote paths use authenticated shared routing and never silently guess",()=>{
 const read=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
 const r=read("app/api/customer/rides/quote/route.js"),s=read("app/api/customer/parcels/quote/route.js");
 for(const file of [r,s])assert.ok(file.includes("getVerifiedRideRoute(pickup,dropoff)"));
 const ride=read("lib/ride-server.js"),send=read("lib/parcel-server.js");
 assert.ok(ride.includes("routingConfiguration()"));
 assert.ok(send.includes("routingConfiguration().ready"));
 assert.ok(send.includes("mapTilerReady()"));
 const admin=read("app/api/admin/service-launch/route.js");
 assert.ok(admin.includes("routingConfiguration().ready"));
 const diag=read("app/api/admin/mobility-routing-diagnostics/route.js");
 assert.ok(diag.includes("authenticateRequest(request,{roles})"));
 assert.ok(diag.includes("enforceRateLimit"));
 assert.ok(diag.includes("getVerifiedRideRoute(probe.from,probe.to)"));
});

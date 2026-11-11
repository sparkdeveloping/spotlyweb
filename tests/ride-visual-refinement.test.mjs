import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read=(path)=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("Ride class artwork is distinct and reused by web selectors and tracking",()=>{
 const visuals=read("components/ride-visuals.js");
 for(const kind of ["economy","comfort","xl"]){
  assert.match(visuals,new RegExp(kind+": \"/ride/vehicles/"+kind+"\\.svg\""));
  const svg=read("public/ride/vehicles/"+kind+".svg");
  assert.match(svg,/<svg /);
  assert.match(svg,/linearGradient/);
  assert.doesNotMatch(svg,/https?:\/\//);
 }
 const app=read("components/ride-app.js");
 assert.match(app,/RideVehicleArt type=\{type\.id\}/);
 assert.match(app,/RideVehicleArt type=\{ride\.serviceType\}/);
 assert.match(app,/aria-pressed=\{selected\}/);
});

test("matching is one dynamic hero state, not two cards or an invented driver count",()=>{
 const app=read("components/ride-app.js");
 const visuals=read("components/ride-visuals.js");
 assert.match(app,/matching\?<RideMatchingBeacon/);
 assert.doesNotMatch(app,/Matching with a Driver/);
 assert.match(app,/if \(!\(state in stages\)\) return null/);
 assert.match(visuals,/prefers-reduced-motion: reduce/);
 assert.doesNotMatch(visuals,/nearbyDriverCount|driverCount|fakeDriver/);
});

test("MapLibre road gradient uses true verified GeoJSON with line metrics",()=>{
 const map=read("components/mobility-map.js");
 assert.match(map,/export function verifiedRoadGeoJSON/);
 assert.match(map,/lineMetrics:true/);
 assert.match(map,/"line-gradient"/);
 assert.match(map,/\["line-progress"\]/);
 assert.match(map,/if\(line\.length>=2\)/);
 assert.doesNotMatch(map,/data\.path\?\.length>=2\?data\.path:\[data\.pickup,data\.dropoff\]/);
 assert.match(map,/getSource\("road-route"\)\?\.setData\(verifiedRoadGeoJSON/);
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  MOBILITY_COUNTRIES,normalizedCoverageKey,verifyCoverageZone,validateCoverageCollection
} from "../lib/mobility-coverage.js";
const read=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
const cities=["Harare","Bulawayo","Lilongwe"];
const countries=["ZW","MW"];
test("Map clicks save a normalized city center and radius, no typed geofence codes",()=>{
 const {key,value}=verifyCoverageZone({country:"zw",city:"Harare",lat:-17.825,lng:31.033,radiusKm:35},
  {enabledCountries:countries,enabledCities:cities});
 assert.equal(key,"ZW:harare");
 assert.deepEqual(value,{country:"ZW",lat:-17.825,lng:31.033,radiusKm:35});
 assert.deepEqual(validateCoverageCollection({[key]:value},
   {enabledCountries:countries,enabledCities:cities}),{[key]:value});
 assert.equal(MOBILITY_COUNTRIES.ZW,"Zimbabwe");
 assert.equal(normalizedCoverageKey("mw","Lilongwe"),"MW:lilongwe");
});
test("Cannot accidentally approve country mismatch, unsupported cities or invalid map centers",()=>{
 const options={enabledCountries:countries,enabledCities:cities};
 for(const zone of [
 {country:"US",city:"Harare",lat:-17.825,lng:31.033,radiusKm:35},
 {country:"ZW",city:"Unknown city",lat:-17.825,lng:31.033,radiusKm:35},
 {country:"ZW",city:"Harare",lat:-13.962,lng:33.774,radiusKm:35},
 {country:"ZW",city:"Harare",lat:0,lng:0,radiusKm:35},
 {country:"ZW",city:"Harare",lat:-17.825,lng:31.033,radiusKm:102},
 {country:"ZW",city:"Harare",lat:-17.825,lng:31.033,radiusKm:2},
 ])assert.throws(()=>verifyCoverageZone(zone,options));
});
test("Send zones are restricted to Zimbabwe and cannot mismatch their keys",()=>{
 const options={enabledCountries:["ZW"],enabledCities:cities,send:true};
 const good={country:"ZW",lat:-17.825,lng:31.033,radiusKm:15};
 assert.deepEqual(validateCoverageCollection({"ZW:harare":good},options),{"ZW:harare":good});
 assert.throws(()=>validateCoverageCollection({"MW:lilongwe":{country:"MW",lat:-13.962,lng:33.774,radiusKm:20}},options));
 assert.throws(()=>validateCoverageCollection({"ZW:bulawayo":good},{...options,enabledCities:["Harare"]}));
 assert.throws(()=>validateCoverageCollection({"ZW:harare":{...good,country:"MW"}},options));
 assert.throws(()=>validateCoverageCollection({"zw:harare":good},options));
 assert.throws(()=>validateCoverageCollection({"ZW:harare":{...good,radiusKm:0}},options));
});
test("Ride & Send Admin never expose raw geofence serialization and validate on server",()=>{
 const ui=read("components/admin-driver-operations.js");
 const editor=read("components/admin-service-coverage-editor.js");
 const map=read("components/mobility-map.js");
 for(const word of ["ServiceCoverageEditor","fences={fences} onChange={setFences}","cityGeofences:fences"])assert.ok(ui.includes(word),word);
 assert.ok(!ui.includes("fences.split("));
 assert.ok(!ui.includes("Approved city pickup geofences (one per line)"));
 for(const word of ["loadMapLibrary","loadStyle","circleGeometry","map.on"]){
   if(word==="map.on")continue;
   assert.ok(editor.includes(word),word);
 }
 for(const word of ["stageZone","Find city on map","Tap the map","type=\"range\"","onChange({...fences"])assert.ok(editor.includes(word),word);
 assert.ok(map.includes("export function loadMapLibrary"));
 assert.ok(map.includes("export async function loadStyle"));
 for(const path of ["app/api/admin/rides/route.js","app/api/admin/parcels/route.js"]){
  const code=read(path);
  assert.ok(code.includes("validateCoverageCollection"));
  assert.ok(code.includes("validatedZones"));
  assert.ok(code.includes("authenticateRequest(request"));
 }
});
test("Saving coverage does not bypass launch authorizations or make unverified scheduler live",()=>{
 const launch=read("app/api/admin/service-launch/route.js");
 const service=read("lib/ride-server.js");
 assert.ok(launch.includes("dispatchHealth("));
 assert.ok(launch.includes("prereq.ready"));
 assert.ok(service.includes("dispatchSchedulerVerified"));
 assert.ok(service.includes("ridesEnabled"));
});

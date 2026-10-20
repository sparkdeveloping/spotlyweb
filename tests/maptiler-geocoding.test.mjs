import test from "node:test";
import assert from "node:assert/strict";
import {
 mapTilerCountry,mapTilerKey,mapTilerReady,mapTilerSearchUrl,mapTilerReverseUrl,
 mapTilerForwardResults,mapTilerReverseLocation,requestMapTiler
} from "../lib/maptiler-geocoding.js";
import fs from "node:fs";

const KEY="DevelopmentKey001234";
const harare={id:"address.239",type:"Feature",text:"Sam Levy Village",
 place_type:["address"],place_name:"Sam Levy Village, Borrowdale, Harare, Zimbabwe",
 geometry:{type:"Point",coordinates:[31.0835,-17.7588]},
 center:[31.0835,-17.7588],properties:{country_code:"zw"},
 context:[{id:"municipality.434",text:"Harare",country_code:"zw"},
  {id:"neighbourhood.6",text:"Borrowdale",country_code:"zw"},
  {id:"country.2",text:"Zimbabwe",country_code:"zw"}]};
const malawi={id:"poi.14",type:"Feature",text:"Lilongwe Shop",place_type:["poi"],
 place_name:"Lilongwe Shop, Lilongwe, Malawi",
 center:[33.7754,-13.9626],properties:{country_code:"mw"},
 context:[{id:"municipality.12",text:"Lilongwe",country_code:"mw"}]};

test("MapTiler style key is reused without embedding secrets in source",()=>{
 assert.equal(mapTilerKey({styleUrl:"https://api.maptiler.com/maps/openstreetmap/style.json?key="+KEY,override:""}),KEY);
 assert.equal(mapTilerKey({styleUrl:"https://attacker.example/maps/openstreetmap/style.json?key="+KEY,override:""}),"");
 assert.equal(mapTilerKey({styleUrl:"https://api.maptiler.com/maps/openstreetmap/style.json?key="+KEY,override:"SeparateKey0123456"}),"SeparateKey0123456");
 assert.equal(mapTilerKey({styleUrl:"http://api.maptiler.com/maps/openstreetmap/style.json?key="+KEY,override:""}),"");
});
test("Forward request uses MapTiler GeoJSON API and restricts country",()=>{
 const target=new URL(mapTilerSearchUrl({query:"mount pleasant",city:"Harare",country:"ZW",key:KEY}));
 assert.equal(target.hostname,"api.maptiler.com");
 assert.ok(target.pathname.startsWith("/geocoding/"));
 assert.equal(target.searchParams.get("country"),"zw");
 assert.equal(target.searchParams.get("key"),KEY);
 assert.equal(target.searchParams.get("limit"),"6");
 assert.throws(()=>mapTilerSearchUrl({query:"x",country:"US",key:KEY}),/Country is not supported/);
});
test("MapTiler results are normalized into Spotly Ride and Send verified selections",()=>{
 const rows=mapTilerForwardResults({features:[malawi,harare]},"ZW");
 assert.equal(rows.length,1);
 assert.deepEqual([rows[0].lat,rows[0].lng],[-17.7588,31.0835]);
 assert.equal(rows[0].country,"ZW");
 assert.equal(rows[0].city,"Harare");
 assert.equal(rows[0].area,"Borrowdale");
 assert.match(rows[0].label,/Sam Levy/);
 assert.equal(mapTilerCountry(malawi),"MW");
});
test("Reverse pin retains exact tapped coordinates, rejects out-of-country data",()=>{
 const lat=-17.833821,lng=31.038527;
 const url=new URL(mapTilerReverseUrl({lat,lng,key:KEY}));
 assert.match(decodeURI(url.pathname),/31\.038527,-17\.833821\.json/);
 const pin=mapTilerReverseLocation({features:[harare]},lat,lng);
 assert.equal(pin.lat,lat);assert.equal(pin.lng,lng);
 assert.equal(pin.city,"Harare");assert.equal(pin.country,"ZW");
 assert.throws(()=>mapTilerReverseLocation({features:[malawi]},lat,lng),/could not be verified/);
});
test("Requests include trusted website origin without echoing untrusted origins",async()=>{
 const url=mapTilerReverseUrl({lat:-17.8,lng:31.03,key:KEY});
 const json={features:[harare]};
 const got=await requestMapTiler(url,{origin:"https://www.spotlyafrica.com",
  fetcher:async(target,opts)=>{
   assert.equal(opts.headers.Origin,"https://www.spotlyafrica.com");
   assert.equal(new URL(target).hostname,"api.maptiler.com");
   return {ok:true,status:200,json:async()=>json};
  }});
 assert.deepEqual(got,json);
 await requestMapTiler(url,{origin:"https://attacker.example",fetcher:async(_,opts)=>{
  assert.equal(opts.headers.Origin,undefined);
  return {ok:true,status:200,json:async()=>json};
 }});
 await assert.rejects(()=>requestMapTiler(url,{fetcher:async()=>({status:403,ok:false})}),/key permissions/);
});
test("Public APIs retain rate limits, location validation and MapTiler fallback",()=>{
 const root=new URL("../",import.meta.url);
 for(const name of ["app/api/public/geocode/route.js","app/api/public/reverse-geocode/route.js"]){
  const c=fs.readFileSync(new URL(name,root),"utf8");
  assert.match(c,/enforceRateLimit/);
  assert.match(c,/mapTilerReady/);
  assert.match(c,/requestMapTiler/);
 }
});

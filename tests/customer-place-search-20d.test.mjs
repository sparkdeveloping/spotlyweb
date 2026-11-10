import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const source=fs.readFileSync(new URL("../firebase/functions/src/core/customer-place-search.js",import.meta.url),"utf8");
const compiled=source.replace('import { HttpsError } from "firebase-functions/v2/https";',
  'class HttpsError extends Error { constructor(code,message){super(message);this.code=code;} }');
const mod=await import("data:text/javascript;base64,"+Buffer.from(compiled).toString("base64"));
const sample=(name,lng,lat,rel=0.92,extra={})=>({
  id:"poi."+name, text:name, place_name:name+", Harare, Zimbabwe",
  place_type:["poi"],center:[lng,lat],relevance:rel,
  context:[{id:"municipality.harare",place_type:["municipality"],text:"Harare",country_code:"zw"}],
  ...extra
});
test("autocomplete requests named POIs without stuffing a city into the search term",()=>{
  const url=mod.mapTilerSearchUrl({query:"KFC",country:"ZW",
    center:{lat:-17.825,lng:31.03},apiKey:"abcdefghijklmnopqrs"});
  assert.match(url.pathname,/KFC\.json$/);
  assert.match(url.searchParams.get("types"),/poi/);
  assert.equal(url.searchParams.get("country"),"zw");
  assert.ok(url.searchParams.get("bbox"));
});
test("KFC results cannot become unrelated roads and real branches remain distinct",()=>{
  const results=mod.normalizeMapTilerSuggestions({features:[
    sample("Harare Road",31.03,-17.82),sample("KFC Avondale",31.02,-17.80),
    sample("KFC Borrowdale",31.09,-17.76)]},{query:"KFC",country:"ZW",city:"Harare"});
  assert.equal(results.length,2);
  assert.ok(results.every(row=>row.label.includes("KFC")));
});
test("Green and Golf searches reject random nearby roads",()=>{
  for(const [query,desired] of [["Green","Greendale Avenue"],["Golf","Royal Harare Golf Club"]]){
    const results=mod.normalizeMapTilerSuggestions({features:[
      sample("Harare Road",31.03,-17.82),sample(desired,31.07,-17.78)
    ]},{query,country:"ZW",city:"Harare"});
    assert.equal(results.length,1);
    assert.match(results[0].label,new RegExp(desired));
  }
});
test("Ruwa is not mislabeled as a suburb of Harare",()=>{
  const row=sample("Ruwa Shopping Centre",31.18,-17.88,.92,{
    context:[{id:"municipality.ruwa",place_type:["municipality"],text:"Ruwa",country_code:"zw"},
      {id:"neighbourhood.ruwa",place_type:["neighbourhood"],text:"Ruwa"}]});
  const result=mod.normalizeMapTilerSuggestions({features:[row]},
    {query:"Ruwa",country:"ZW",city:"Harare"})[0];
  assert.equal(result.city,"Ruwa");
  assert.equal(result.area,null);
});
test("ignore low quality or cross-country candidates",()=>{
  const wrong=sample("KFC",31.04,-17.8,.9,{context:[{country_code:"mw"}]});
  const low=sample("KFC",31.04,-17.8,.2);
  assert.deepEqual(mod.normalizeMapTilerSuggestions({features:[wrong,low]},
    {query:"KFC",country:"ZW",city:"Harare"}),[]);
});
test("provider failure surfaces as recoverable error, never fabricated results",async()=>{
  await assert.rejects(mod.searchCustomerPlaces({data:{query:"KFC",country:"ZW",city:"Harare"},
    apiKey:"abcdefghijklmnopqrs",fetcher:async()=>{throw Error("offline");}}),/Location search could not connect/);
});

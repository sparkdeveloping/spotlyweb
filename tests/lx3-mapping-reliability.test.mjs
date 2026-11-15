import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {routeHarness} from "./helpers/route-harness.mjs";
import {normalizePlaceIntent,uniquePlaceIntents,isSecondaryGeocoderEnabled} from "../lib/spotly-place-intent.js";
import {recentMobilityPlaces,rememberMobilityPlace,clearRecentMobilityPlaces} from "../lib/recent-mobility-places.mjs";
import {mapTilerForwardResults} from "../lib/maptiler-geocoding.js";

const root=process.cwd();
const read=path=>readFileSync(resolve(root,path),"utf8");
const harare={lat:-17.7588,lng:31.0835,label:"Sam Levy Village, Harare, Zimbabwe",area:"Borrowdale",city:"Harare",country:"ZW"};
const lilongwe={lat:-13.9626,lng:33.7754,label:"Area 18, Lilongwe, Malawi",city:"Lilongwe",country:"MW"};
const oldFetch=global.fetch;
const oldFallback=process.env.SPOTLY_MAP_GEOCODE_FALLBACK_ENABLED;
const oldGeocode=process.env.SPOTLY_GEOCODING_URL;
const oldReverse=process.env.SPOTLY_REVERSE_GEOCODING_URL;

function harness({forwardData=[harare],reverseData=lilongwe}={}) {
  let primary=0, secondary=0, quota=0, appCheck=0;
  const h=routeHarness(root,{
    "@/lib/firebase-admin": {verifyAppCheckRequest:async()=>{appCheck++;},apiError:e=>Response.json({ok:false,error:e.message},{status:e.status||500})},
    "@/lib/rate-limit-server": {enforceRateLimit:async()=>{quota++;}},
    "@/lib/maptiler-geocoding": {
      mapTilerReady:()=>true,mapTilerSearchUrl:()=>"https://api.maptiler.com/geocoding/query.json",
      mapTilerReverseUrl:()=>"https://api.maptiler.com/geocoding/reverse.json",
      requestMapTiler:async()=>{secondary++;return {features:[]};},
      mapTilerForwardResults:()=>forwardData,
      mapTilerReverseLocation:()=>reverseData
    }
  });
  const get=type=>h.load(`app/api/public/${type}/route.js`).GET;
  return {get,counters:()=>({primary,secondary,quota,appCheck}),countPrimary:()=>primary++};
}
const request=(q,country="ZW")=>new Request(`https://spotlyafrica.com/api/public/geocode?q=${encodeURIComponent(q)}&city=Harare&country=${country}`);
async function withConfig(config,run) {
  const previous={SPOTLY_MAP_GEOCODE_FALLBACK_ENABLED:process.env.SPOTLY_MAP_GEOCODE_FALLBACK_ENABLED,
    SPOTLY_GEOCODING_URL:process.env.SPOTLY_GEOCODING_URL,
    SPOTLY_REVERSE_GEOCODING_URL:process.env.SPOTLY_REVERSE_GEOCODING_URL};
  const fetcher=global.fetch;
  Object.assign(process.env,config);
  try{return await run();}finally{
    for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
    global.fetch=fetcher;
  }
}

test("LX3 place contract never turns an address search into a verified entrance",()=>{
  const provider=normalizePlaceIntent({...harare,isVerified:true},{country:"ZW",provider:"maptiler"});
  assert.equal(provider.isVerified,false);
  assert.equal(provider.precision,"provider_estimate");
  assert.equal(normalizePlaceIntent({...harare,lat:-13.9626,lng:33.7754},{country:"ZW"}),null);
  assert.equal(normalizePlaceIntent({...lilongwe},{country:"ZW"}),null);
  assert.equal(normalizePlaceIntent({...harare,lat:NaN},{country:"ZW"}),null);
  assert.equal(normalizePlaceIntent({...harare,city:""},{country:"ZW"}),null);
  assert.equal(normalizePlaceIntent({...harare,isVerified:true},{country:"ZW",provider:"spotly_entrance"}).isVerified,true);
});

test("LX3 only deduplicates same-name nearby coordinates, not separate business branches",()=>{
  const nearby={...harare,lat:harare.lat+.00002,id:"other"};
  const distant={...harare,lat:harare.lat+.01,id:"third"};
  const output=uniquePlaceIntents([harare,nearby,distant,lilongwe],{country:"ZW",limit:6});
  assert.equal(output.length,2);
  assert.equal(output[0].country,"ZW");
});

test("LX3 MapTiler rejects a wrong-country coordinate despite valid provider country metadata",()=>{
  const bad={id:"poi.fake",center:[33.7754,-13.9626],text:"Wrong point",place_name:"Wrong point, Harare",properties:{country_code:"zw"},context:[{id:"municipality.1",text:"Harare",country_code:"zw"}]};
  assert.equal(mapTilerForwardResults({features:[bad]},"ZW").length,0);
});

test("LX3 provider failover is opt-in to avoid additional paid map requests",()=>{
  assert.equal(isSecondaryGeocoderEnabled("false"),false);
  assert.equal(isSecondaryGeocoderEnabled(undefined),false);
  assert.equal(isSecondaryGeocoderEnabled("true"),true);
});

test("LX3 a configured primary geocoder is used alone when healthy",async()=>withConfig({SPOTLY_GEOCODING_URL:"https://licensed.example/search",SPOTLY_MAP_GEOCODE_FALLBACK_ENABLED:"true"},async()=>{
  const h=harness();
  global.fetch=async()=>({ok:true,json:async()=>[{place_id:1,display_name:harare.label,lat:String(harare.lat),lon:String(harare.lng),address:{city:"Harare",country_code:"zw"}}]});
  const response=await h.get("geocode")(request("Sam Levy Village"));
  assert.equal(response.status,200);
  assert.equal((await response.json()).results.length,1);
  assert.equal(h.counters().secondary,0);
}));

test("LX3 a down primary geocoder fails closed by default",async()=>withConfig({SPOTLY_GEOCODING_URL:"https://licensed.example/search",SPOTLY_MAP_GEOCODE_FALLBACK_ENABLED:"false"},async()=>{
  const h=harness();global.fetch=async()=>{throw new Error("private token: secret")};
  const response=await h.get("geocode")(request("Sam Levy Village"));
  assert.equal(response.status,503);assert.equal(h.counters().secondary,0);
  assert.equal(JSON.stringify(await response.json()).includes("secret"),false);
}));

test("LX3 enabled secondary search rescues a genuine provider outage",async()=>withConfig({SPOTLY_GEOCODING_URL:"https://licensed.example/search",SPOTLY_MAP_GEOCODE_FALLBACK_ENABLED:"true"},async()=>{
  const h=harness();global.fetch=async()=>{throw new Error("unreachable")};
  const response=await h.get("geocode")(request("Sam Levy Village"));
  assert.equal(response.status,200);
  const payload=await response.json();assert.equal(payload.results[0].source,"maptiler");
  assert.equal(payload.results[0].isVerified,false);
  assert.equal(h.counters().secondary,1);
}));

test("LX3 secondary geocoder never leaks mismatched-country results",async()=>withConfig({SPOTLY_GEOCODING_URL:"https://licensed.example/search",SPOTLY_MAP_GEOCODE_FALLBACK_ENABLED:"true"},async()=>{
  const h=harness({forwardData:[lilongwe]});global.fetch=async()=>{throw new Error("unreachable")};
  const response=await h.get("geocode")(request("Sam Levy Village"));
  assert.equal(response.status,503);
}));

test("LX3 country rejection happens before any provider call",async()=>withConfig({SPOTLY_GEOCODING_URL:"https://licensed.example/search",SPOTLY_MAP_GEOCODE_FALLBACK_ENABLED:"true"},async()=>{
  const h=harness();global.fetch=async()=>{throw new Error("no provider should run")};
  const response=await h.get("geocode")(request("Store","US"));
  assert.equal(response.status,422);
  assert.equal(h.counters().secondary,0);
}));

test("LX3 reverse-geocode falls back only on upstream outage, not on country denial",async()=>withConfig({SPOTLY_REVERSE_GEOCODING_URL:"https://licensed.example/reverse",SPOTLY_MAP_GEOCODE_FALLBACK_ENABLED:"true"},async()=>{
  const h=harness();
  global.fetch=async()=>({ok:false,status:502});
  const url="https://spotlyafrica.com/api/public/reverse-geocode?lat=-13.9626&lng=33.7754";
  const response=await h.get("reverse-geocode")(new Request(url));
  assert.equal(response.status,200);assert.equal((await response.json()).location.source,"maptiler");
  assert.equal(h.counters().secondary,1);
  const h2=harness();
  global.fetch=async()=>({ok:true,json:async()=>({address:{country_code:"za",city:"Pretoria"},display_name:"Wrong",name:"Wrong"})});
  const blocked=await h2.get("reverse-geocode")(new Request(url));
  assert.equal(blocked.status,409);assert.equal(h2.counters().secondary,0);
}));

test("LX3 recently picked places are session-only, country-isolated and clearable",()=>{
  const data=new Map();
  global.sessionStorage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
  try{
    clearRecentMobilityPlaces();
    assert.equal(rememberMobilityPlace({...lilongwe,formattedAddress:lilongwe.label},"MW",1000),true);
    assert.equal(recentMobilityPlaces("ZW",1000).length,0);
    assert.equal(recentMobilityPlaces("MW",1000).length,1);
    assert.equal(recentMobilityPlaces("MW",1000+24*3600000+1).length,0);
    clearRecentMobilityPlaces();assert.equal(data.size,0);
  } finally {delete global.sessionStorage;}
});

test("LX3 web maps respect Save-Data and show a useful map-free fallback",()=>{
  const map=read("components/mobility-map.js");
  assert.match(map,/shouldShowMobilityMap/);
  assert.match(read("lib/mobility-map-preference.mjs"),/connection\?\.saveData/);
  assert.match(map,/!showMap\|\|!container\.current/);
  assert.match(map,/Map tiles are paused/);
  assert.match(map,/hasRoute\?"Verified route available":"Route drawing unavailable"/);
  for(const name of ["ride-app.js","send-app.js"]) {
    const ui=read(`components/${name}`);
    assert.match(ui,/AbortController/);assert.match(ui,/recentMobilityPlaces/);
    assert.match(ui,/publicApiFetch\(`\/api\/public\/geocode/);
  }
});

test("LX3 native fallback can resolve ISO-less but valid country coordinates",()=>{
  const swift=read("../../customer/spotly/spotly/Core/Services/NativeLocationSearch.swift");
  assert.match(swift,/iso == nil && SpotlyCountryEngine\.country/);
  assert.match(swift,/SpotlyLocationQueryQuality\.matches/);
});

test("LX3 empty primary results may recover from the opt-in secondary without fabricating a route",async()=>withConfig({SPOTLY_GEOCODING_URL:"https://licensed.example/search",SPOTLY_MAP_GEOCODE_FALLBACK_ENABLED:"true"},async()=>{
  const h=harness();global.fetch=async()=>({ok:true,json:async()=>[]});
  const response=await h.get("geocode")(request("Sam Levy Village"));
  assert.equal(response.status,200);
  assert.equal((await response.json()).results[0].source,"maptiler");
  assert.equal(h.counters().secondary,1);
  const routing=read("lib/ride-routing.js");
  assert.match(routing,/interpretVerifiedRoute/);
  assert.match(routing,/if\(!verified\)fail\("Could not verify nearby drivable access/);
}));

test("LX3 empty or non-numeric reverse coordinates are blocked before any provider lookup",async()=>withConfig({SPOTLY_REVERSE_GEOCODING_URL:"https://licensed.example/reverse",SPOTLY_MAP_GEOCODE_FALLBACK_ENABLED:"true"},async()=>{
  const h=harness();global.fetch=async()=>{throw new Error("provider should not be called")};
  const response=await h.get("reverse-geocode")(new Request("https://spotlyafrica.com/api/public/reverse-geocode?lat=&lng=nope"));
  assert.equal(response.status,400);assert.equal(h.counters().secondary,0);
}));

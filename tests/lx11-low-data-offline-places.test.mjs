import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {
  savedMobilityPlaces, saveMobilityPlace, isSavedMobilityPlace,
  forgetSavedMobilityPlace, clearSavedMobilityPlaces, findSavedMobilityPlaces
} from "../lib/saved-mobility-places.mjs";
import {mobilityMapMode, shouldShowMobilityMap, setMobilityMapMode} from "../lib/mobility-map-preference.mjs";

const read = file => readFileSync(resolve(process.cwd(), file), "utf8");
function local() {
  const records = new Map();
  global.localStorage = {
    getItem: key => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value),
    removeItem: key => records.delete(key)
  };
  return records;
}
const ZW = {lat:-17.79,lng:31.1,label:"Borrowdale",formattedAddress:"Borrowdale, Harare, Zimbabwe",city:"Harare",area:"Borrowdale",country:"ZW"};
const MW = {lat:-13.95,lng:33.78,label:"Area 18",formattedAddress:"Area 18, Lilongwe, Malawi",city:"Lilongwe",country:"MW"};
function withStore(fn) { const map=local();try{return fn(map);}finally{delete global.localStorage;} }

test("LX11 never stores any place until the person explicitly saves it",()=>withStore(db=>{
  assert.deepEqual(savedMobilityPlaces("ZW"),[]);
  assert.equal(db.size,0);
  assert.equal(saveMobilityPlace(ZW,"ZW",1000),true);
  assert.equal(db.size,1);
  assert.equal(savedMobilityPlaces("ZW",1000).length,1);
  assert.equal(isSavedMobilityPlace(ZW,"ZW",1000),true);
}));

test("LX11 keeps saved locations country isolated",()=>withStore(()=>{
  saveMobilityPlace(ZW,"ZW",1000);saveMobilityPlace(MW,"MW",1000);
  assert.equal(savedMobilityPlaces("MW",1000)[0].city,"Lilongwe");
  assert.equal(savedMobilityPlaces("ZW",1000)[0].city,"Harare");
  assert.equal(saveMobilityPlace({...MW,country:"ZW"},"ZW",1000),false);
  assert.equal(saveMobilityPlace({...ZW,lat:-13.95},"ZW",1000),false);
}));

test("LX11 saved places expire and are deleted from local storage on next use",()=>withStore(db=>{
  saveMobilityPlace(ZW,"ZW",10_000);
  assert.equal(savedMobilityPlaces("ZW",10_000+29*86400000).length,1);
  assert.equal(savedMobilityPlaces("ZW",10_000+30*86400000).length,0);
  assert.equal(db.size,0);
}));

test("LX11 saved places are bounded and deduplicate exact locations",()=>withStore(()=>{
  const now=1000;
  for(let i=0;i<12;i++)saveMobilityPlace({...ZW,lat:ZW.lat+i*.001,formattedAddress:`Address ${i}, Harare, Zimbabwe`},"ZW",now+i);
  assert.equal(savedMobilityPlaces("ZW",now+12).length,8);
  const first=savedMobilityPlaces("ZW",now+12)[0];
  saveMobilityPlace(first,"ZW",now+15);
  assert.equal(savedMobilityPlaces("ZW",now+15).length,8);
}));

test("LX11 lookup is local, text matching and does not call an API",()=>withStore(()=>{
  saveMobilityPlace(ZW,"ZW",1000);saveMobilityPlace(MW,"MW",1000);
  assert.equal(findSavedMobilityPlaces("ZW","bor",1000).length,1);
  assert.equal(findSavedMobilityPlaces("ZW","lilongwe",1000).length,0);
  assert.equal(findSavedMobilityPlaces("MW","area 18",1000).length,1);
  assert.equal(findSavedMobilityPlaces("MW","ar",1000).length,0);
}));

test("LX11 saving only retains an allowlisted place projection",()=>withStore(db=>{
  saveMobilityPlace({...ZW,token:"secret",customerId:"private",isVerified:true,routePath:[1,2]},"ZW",1000);
  const raw=[...db.values()][0];
  for(const key of ["secret","private","customerId","routePath","isVerified"])assert.equal(raw.includes(key),false);
}));

test("LX11 can forget one saved location or clear every location",()=>withStore(db=>{
  saveMobilityPlace(ZW,"ZW",1000);saveMobilityPlace(MW,"MW",1000);
  forgetSavedMobilityPlace(ZW,"ZW",1001);
  assert.equal(savedMobilityPlaces("ZW",1001).length,0);
  assert.equal(savedMobilityPlaces("MW",1001).length,1);
  assert.equal(clearSavedMobilityPlaces(),true);
  assert.equal(db.size,0);
}));

test("LX11 corrupted or huge local storage data fails closed",()=>withStore(db=>{
  db.set("spotly:mobility:offline-places:v1","{");assert.deepEqual(savedMobilityPlaces("ZW"),[]);
  db.set("spotly:mobility:offline-places:v1","x".repeat(8000));assert.deepEqual(savedMobilityPlaces("ZW"),[]);
}));

test("LX11 unavailable local storage never crashes location selection",()=>{
  assert.equal(saveMobilityPlace(ZW,"ZW"),false);
  assert.deepEqual(savedMobilityPlaces("ZW"),[]);
  assert.equal(clearSavedMobilityPlaces(),true);
});

test("LX11 Save-Data and slow connections avoid map tile downloads by default",()=>{
  assert.equal(shouldShowMobilityMap({mode:"auto",connection:{saveData:true}}),false);
  assert.equal(shouldShowMobilityMap({mode:"auto",connection:{effectiveType:"2g"}}),false);
  assert.equal(shouldShowMobilityMap({mode:"auto",connection:{effectiveType:"slow-2g"}}),false);
  assert.equal(shouldShowMobilityMap({mode:"auto",connection:{effectiveType:"4g"}}),true);
  assert.equal(shouldShowMobilityMap({mode:"map",connection:{saveData:true}}),true);
  assert.equal(shouldShowMobilityMap({mode:"low",connection:{}}),false);
  assert.equal(shouldShowMobilityMap({mode:"map",connection:{},online:false}),false);
});

test("LX11 map preference is a tab-local visual choice, not a Firestore setting",()=>{
  const entries=new Map();global.sessionStorage={getItem:key=>entries.get(key),setItem:(k,v)=>entries.set(k,v),removeItem:key=>entries.delete(key)};
  try {assert.equal(mobilityMapMode(),"auto");assert.equal(setMobilityMapMode("low"),true);assert.equal(mobilityMapMode(),"low");assert.equal(setMobilityMapMode("map"),true);assert.equal(mobilityMapMode(),"map");assert.equal(setMobilityMapMode("bad"),false);assert.equal(setMobilityMapMode("auto"),true);assert.equal(mobilityMapMode(),"auto");}
  finally {delete global.sessionStorage;}
});

test("LX11 Ride and Send preserve server route and fare checks after offline selection",()=>{
  for (const name of ["ride-app.js","send-app.js"]) {
    const src=read(`components/${name}`);
    assert.match(src,/saveMobilityPlace\(point,country\)/);
    assert.match(src,/findSavedMobilityPlaces\(country,value\.trim\(\)\)/);
    assert.match(src,/navigator\.onLine===false/);
    assert.match(src,/hasVerifiedRoadAccess/);
    assert.match(src,/RoadRouteMap/);
    assert.match(src,/Clear all/);
  }
  const map=read("components/mobility-map.js");
  assert.match(map,/verifiedRoadGeoJSON/);
  assert.match(map,/shouldShowMobilityMap/);
  assert.match(map,/setMobilityMapMode/);
  assert.match(map,/15000/);
});

test("LX11 Customer iOS map pause leaves authoritative trip status and route checks intact",()=>{
  const source=read("../../customer/spotly/spotly/Core/Components/SpotlyOperationalTrackingMap.swift");
  assert.match(source,/@AppStorage\("spotly\.mobility\.lowDataMap"\)/);
  assert.match(source,/if lowDataMap/);
  assert.match(source,/Map paused to save data/);
  assert.match(source,/if verifiedRoute\.count >= 2/);
  assert.match(source,/\.task\(id: routeKey\)/);
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {licensedMapStyle} from "../lib/mobility-map-provider.js";
const read=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("Street map requires a licensed HTTPS provider and browser-safe token",()=>{
 assert.equal(licensedMapStyle(""),null);
 assert.equal(licensedMapStyle("http://maps.example.org/style.json"),null);
 assert.equal(licensedMapStyle("https://tile.openstreetmap.org/11/1/2.png"),null);
 assert.equal(licensedMapStyle("https://demotiles.maplibre.org/style.json"),null);
 assert.equal(licensedMapStyle("https://user:pass@tiles.example.org/style.json"),null);
 assert.equal(licensedMapStyle("https://tiles.example.org/maps/basic/style.json"),"https://tiles.example.org/maps/basic/style.json");
});
test("Ride and Send use shared pin picker with reverse geocode, route overlay and Driver position recency",()=>{
 const shared=read("components/mobility-map.js");
 for(const keyword of ["PinDropMap","RoadRouteMap","maplibre-gl@5.12.0","reverse-geocode","dragend","fitBounds","road-route-line","lastFix"])
 assert.ok(shared.includes(keyword),keyword);
 for(const entry of ["ride-app","send-app"]){
  const ui=read("components/"+entry+".js");
  for(const term of ["PinDropMap","RoadRouteMap","Choose","routePath"])assert.ok(ui.includes(term),entry+" "+term);
 }
});
test("Server-controlled routing and geocoding never silently fall back to guessed road prices",()=>{
 const ride=read("app/api/customer/rides/quote/route.js");
 const send=read("app/api/customer/parcels/quote/route.js");
 assert.ok(ride.includes("getVerifiedRideRoute"));
 assert.ok(send.includes("getVerifiedRideRoute"));
 assert.ok(read("app/api/public/geocode/route.js").includes("SPOTLY_GEOCODING_URL"));
 assert.ok(read("app/api/public/reverse-geocode/route.js").includes("SPOTLY_REVERSE_GEOCODING_URL"));
});

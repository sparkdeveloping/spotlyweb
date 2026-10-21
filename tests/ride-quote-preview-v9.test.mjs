import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {mapTilerReverseLocation} from "../lib/maptiler-geocoding.js";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

const country={id:"country.7",text:"Zimbabwe",country_code:"zw"};
const town={id:"municipality.7",text:"Harare",country_code:"zw"};
const coarse={type:"Feature",id:"municipality.7",text:"Harare",
 place_type:["municipality"],place_name:"Harare, Zimbabwe",
 center:[31.03,-17.83],properties:{country_code:"zw"},context:[country,town]};
test("Fare quote does not depend on real-time dispatch but still needs verified road routing",()=>{
 const service=read("lib/ride-server.js");
 const quote=read("app/api/customer/rides/quote/route.js");
 const booking=read("app/api/customer/rides/route.js");
 assert.ok(service.includes("export function rideQuoteAvailability"));
 assert.ok(service.includes("const routeReady=routingConfiguration()"));
 assert.ok(service.includes('if(!config.routingVerified||!routingConfiguration().ready)'));
 assert.ok(quote.includes("rideQuoteAvailability(settings,pickup)"));
 assert.ok(quote.includes("const booking=rideAvailability(settings,pickup)"));
 assert.ok(quote.includes("bookingAvailable:booking.enabled"));
 assert.ok(booking.includes("rideAvailability(settings, pickup)"));
 assert.ok(quote.includes("getVerifiedRideRoute(pickup,dropoff)"));
 assert.ok(quote.includes("validateRideTerritory(pickup,dropoff"));
});
test("Client keeps informational quotes separate from bookable rides",()=>{
 const ui=read("components/ride-app.js");
 assert.ok(ui.includes("bookingAvailable:data.bookingAvailable===true"));
 assert.ok(ui.includes("disabled={quote.bookingAvailable!==true"));
 assert.ok(ui.includes("This is an informational road-based estimate"));
 assert.ok(ui.includes("setServiceType(type.id);setQuote(null)"));
});
test("MapTiler municipality-only reverse geocoding differentiates distinct dropped pins",()=>{
 const a=mapTilerReverseLocation({features:[coarse]},-17.83382,31.03853);
 const b=mapTilerReverseLocation({features:[coarse]},-17.86517,31.02711);
 assert.match(a.formattedAddress,/Pinned location/);
 assert.match(a.formattedAddress,/31\.03853/);
 assert.match(b.formattedAddress,/31\.02711/);
 assert.notEqual(a.formattedAddress,b.formattedAddress);
 assert.equal(a.city,"Harare");
});
test("Error toasts no longer say Done",()=>{
 const ui=read("components/providers.js");
 assert.match(ui,/kind==="error"\?"Unable to continue"/);
});

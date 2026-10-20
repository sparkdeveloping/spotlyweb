import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {SPOTLY_PRODUCTS,publicProductRoute,productServiceId} from "../lib/spotly-products.js";
const read=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("Brand names are cohesive while internal commerce service IDs stay unchanged",()=>{
 assert.equal(SPOTLY_PRODUCTS.eat.name,"SpotlyBite");
 assert.equal(SPOTLY_PRODUCTS.shop.name,"SpotlyShopper");
 assert.equal(SPOTLY_PRODUCTS.events.name,"SpotlyLive");
 assert.equal(SPOTLY_PRODUCTS.book.name,"SpotlyBook");
 assert.equal(SPOTLY_PRODUCTS.ride.name,"SpotlyRide");
 assert.equal(SPOTLY_PRODUCTS.send.name,"SpotlySend");
 for(const [id,route,old] of [["eat","/bite","/eat"],["shop","/shopper","/shop"],["events","/live","/events"]]){
  assert.equal(publicProductRoute(id),route);
  assert.equal(productServiceId(route),id);
  assert.equal(productServiceId(old),id);
  assert.ok(read("next.config.mjs").includes("source:\""+old+"\",destination:\""+route+"\""));
  const page=read("app/"+route.slice(1)+"/page.js");
  assert.ok(page.includes('initialService="'+id+'"'));
  assert.ok(page.includes('canonical:"'+route+'"'));
 }
});
test("Homepage, city URLs and sitemap use public product names",()=>{
 const home=read("components/marketplace-home.js");
 const city=read("app/city/[city]/[service]/page.js");
 const app=read("components/marketplace-app.js");
 const sitemap=read("app/sitemap.js");
 for(const term of ['label: "Bite"','label: "Shopper"','label: "Live"'])assert.ok(home.includes(term));
 for(const term of ['bite:"eat"','shopper:"shop"','live:"events"'])assert.ok(city.includes(term));
 assert.ok(app.includes("publicProductRoute(nextService)"));
 for(const path of ["/bite","/shopper","/live"])assert.ok(sitemap.includes(path));
});

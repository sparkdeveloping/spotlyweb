import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {AFRICAN_COUNTRY_SEEDS,locationCanAccept,regionalServicePolicy,operationalAssistAvailable} from "../lib/v9-assist-regions.js";
import {independentPublicStore,independentShoppingFlags,independentQuote} from "../lib/independent-shopping.js";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const place={country:"ZW",city:"Harare",area:"Avondale"};
test("Zimbabwe and Malawi location datasets exist",()=>{
 assert(AFRICAN_COUNTRY_SEEDS.some(c=>c.code==="ZW"&&c.cities.includes("Harare")));
 assert(AFRICAN_COUNTRY_SEEDS.some(c=>c.code==="MW"&&c.currency==="MWK"&&c.cities.includes("Lilongwe")));
});
test("regional eligibility is on unless explicitly paused",()=>{
 assert.equal(regionalServicePolicy({},place,"eat").available,true);
 const settings={countries:{ZW:{services:{book:false}}},regions:[{country:"ZW",city:"Harare",area:"Avondale",service:"eat",enabled:false}]};
 assert.equal(regionalServicePolicy(settings,place,"book").available,false);
 assert.equal(regionalServicePolicy(settings,place,"eat").available,false);
 assert.equal(regionalServicePolicy(settings,{...place,area:"Borrowdale"},"eat").available,true);
 assert.equal(regionalServicePolicy({countries:{MW:{enabled:false}}},{country:"MW",city:"Lilongwe"},"eat").available,false);
 assert.equal(regionalServicePolicy({},place,"events").available,false);
});
test("location pause never overrides required publication and operational review",()=>{
 assert.equal(locationCanAccept({status:"published",operationalReviewed:true}),true);
 assert.equal(locationCanAccept({status:"published",operationalReviewed:true,assistAccepting:false}),false);
 assert.equal(locationCanAccept({status:"draft",operationalReviewed:true}),false);
 assert.equal(operationalAssistAvailable({},place,"eat").available,false);
});
test("independent shopping uses correct currency, source and safety state",()=>{
 assert.deepEqual(independentShoppingFlags({}),{browseEnabled:true,requestEnabled:true});
 assert.deepEqual(independentShoppingFlags({independentShopping:{browseEnabled:false}}),{browseEnabled:false,requestEnabled:false});
 const now=Date.now();
 const raw={name:"Sample independent location",country:"MW",city:"Lilongwe",address:"Sample Road, Lilongwe",status:"published",affiliation:"unaffiliated",sourcingModel:"independent_in_person",currency:"MWK",items:[{id:"food",name:"Regular meal",status:"available",priceEstimate:15000,priceCheckedAt:new Date(now-3600000).toISOString()}]};
 const store=independentPublicStore("sample",raw,now);
 assert.equal(store.currency,"MWK");assert.equal(store.items[0].currency,"MWK");
 const quote=independentQuote(store,[{itemId:"food",quantity:2}],{},now);
 assert.equal(quote.currency,"MWK");assert.equal(quote.totalEstimate,30000);
 assert.equal(quote.paymentRequired,false);assert.equal(quote.dispatchCreated,false);
 assert.equal(independentPublicStore("sample",{...raw,assistAccepting:false},now),null);
});
test("assisted quote acceptance never marks a paid order",()=>{
 const response=read("app/api/customer/independent-shopping/requests/respond/route.js");
 assert.match(response,/quote_accepted_awaiting_payment/);
 assert.match(response,/paymentCollected:false/);
 const operators=read("app/api/admin/assist-shopping/actions/route.js");
 assert.match(operators,/finalQuote/);
 assert.doesNotMatch(operators,/dispatchDelivery|postPaymentCapturedLedger/);
});
test("independent flows do not call the existing merchant money or driver routes",()=>{
 const src=read("app/api/customer/independent-shopping/requests/route.js");
 assert.match(src,/paymentStatus: "not_initiated"/);
 assert.match(src,/dispatchStatus: "not_dispatched"/);
 assert.doesNotMatch(src,/collection\("paymentIntents"\)|collection\("deliveryJobs"\)/);
});
test("merchant checkout and approved owner takeover retain guards",()=>{
 assert.match(read("app/api/orders/create/route.js"),/marketplaceTrust\(businessData\).commerceVerified/);
 const claim=read("app/api/admin/business-claims/decision/route.js");
 assert.match(claim,/assist.owner_handover.paused/);
 assert.match(claim,/assistAccepting: false/);
});

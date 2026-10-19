import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assistLocationEnabled, assistModeForBusiness, canAssistBook, quoteBookingInput,
  canTransitionAssist, assistCountryDefaults, ASSIST_NOTICE
} from "../lib/spotly-assist.js";
import { AFRICAN_COUNTRIES, AFRICAN_COUNTRY_CODES, africaCountry } from "../lib/africa-geo.js";
import { independentShoppingFlags } from "../lib/independent-shopping.js";

function source(file) {
  return readFileSync(new URL("../" + file, import.meta.url), "utf8");
}
const restaurant = {
  id:"r1",public:true,status:"provisional",country:"ZW",city:"Harare",
  name:"Illustrative restaurant",businessType:"restaurant_food",verificationStatus:"unverified"
};
const salon={...restaurant,id:"s1",name:"Illustrative salon",businessType:"appointments_services",category:"Beauty Salon",phone:"+263700000000"};

test("Africa registry includes 54 unique country codes, Zimbabwe and Malawi",()=>{
  assert.equal(AFRICAN_COUNTRIES.length,54);
  assert.equal(new Set(AFRICAN_COUNTRIES.map((c)=>c.code)).size,54);
  assert.equal(AFRICAN_COUNTRY_CODES.has("ZW"),true);
  assert.equal(AFRICAN_COUNTRY_CODES.has("MW"),true);
  assert.equal(africaCountry("MW")?.name,"Malawi");
  assert.equal(africaCountry("US"),null);
});
test("request intake is on by default only for eligible records",()=>{
  assert.equal(assistLocationEnabled(restaurant),true);
  assert.equal(assistLocationEnabled({...restaurant,assistEnabled:false}),false);
  assert.equal(assistLocationEnabled({...restaurant,assistPaused:true}),false);
  assert.equal(assistLocationEnabled({...restaurant,status:"archived"}),false);
  assert.equal(assistLocationEnabled({...restaurant,public:false}),false);
  assert.deepEqual(independentShoppingFlags({}),{browseEnabled:true,requestEnabled:true});
  assert.deepEqual(independentShoppingFlags({independentShopping:{requestEnabled:false}}),{browseEnabled:true,requestEnabled:false});
});
test("country-city-area shutdowns inherit without enabling bypass",()=>{
  assert.equal(assistLocationEnabled(restaurant,{assistCoverage:{globalEnabled:false}}),false);
  assert.equal(assistLocationEnabled(restaurant,{assistCoverage:{countries:{ZW:{enabled:false}}}}),false);
  assert.equal(assistLocationEnabled(restaurant,{assistCoverage:{cities:{"ZW:harare":{enabled:false}}}}),false);
  assert.equal(assistLocationEnabled({...restaurant,area:"Avondale"},{assistCoverage:{areas:{"ZW:harare:avondale":{enabled:false}}}}),false);
  assert.equal(assistLocationEnabled({...restaurant,area:"Eastlea"},{assistCoverage:{areas:{"ZW:harare:avondale":{enabled:false}}}}),true);
});
test("only nonmerchant shopping/booking locations can request Spotly Assist",()=>{
  assert.equal(assistModeForBusiness(restaurant),"shopping");
  assert.equal(assistModeForBusiness(salon),"booking");
  assert.equal(assistModeForBusiness({...restaurant,commerceVerified:true}),null);
  assert.equal(assistModeForBusiness({...restaurant,commerceEnabled:true}),null);
  assert.equal(assistModeForBusiness({...restaurant,assistEnabled:false}),null);
  assert.equal(canAssistBook(salon),true);
  assert.equal(canAssistBook({...salon,phone:"",website:""}),false);
  assert.match(ASSIST_NOTICE,/not necessarily partnered/i);
});
test("assisted appointments are requests until a confirmed business reference exists",()=>{
  const tomorrow=new Date(Date.now()+2*86400000).toISOString().slice(0,10);
  const booking=quoteBookingInput({date:tomorrow,time:"12:00",serviceName:"Hair styling",flexibility:"nearby"});
  assert.equal(booking.flexibility,"nearby");
  assert.throws(()=>quoteBookingInput({date:"2020-01-01",time:"12:00",serviceName:"Hair styling"}));
  assert.throws(()=>quoteBookingInput({date:tomorrow,time:"25:00",serviceName:"Hair styling"}));
  assert.equal(canTransitionAssist("pending_review","contacting_business"),true);
  assert.equal(canTransitionAssist("awaiting_customer","awaiting_confirmation"),true);
  assert.equal(canTransitionAssist("confirmed","completed"),true);
  assert.equal(canTransitionAssist("completed","confirmed"),false);
  assert.match(source("app/api/admin/assist/route.js"),/confirmationReference/);
  assert.match(source("app/api/admin/assist/route.js"),/customerAcceptedAt/);
  assert.match(source("app/api/customer/assist/bookings/decision/route.js"),/customerId !== user.uid/);
});
test("independent request, canonical business and claim checks cannot be bypassed",()=>{
  const feed=source("app/api/public/service-feed/route.js");
  const intake=source("app/api/customer/independent-shopping/requests/route.js");
  const publicRoute=source("app/api/public/independent-shopping/route.js");
  const claim=source("app/api/admin/business-claims/decision/route.js");
  assert.match(feed,/firestoreBusinessIds/);
  assert.match(intake,/marketplaceTrust\(business\)\.commerceVerified/);
  assert.match(intake,/assistLocationEnabled\(business, settings\)/);
  assert.match(publicRoute,/marketplaceTrust\(owner\)\.commerceVerified/);
  assert.match(claim,/assistHandoverState/);
  assert.match(claim,/status: "paused", handoverStatus:/);
});
test("an unaffiliated shopping payment is physically gated and never becomes a merchant settlement",()=>{
  const checkout=source("app/api/customer/assist/shopping/checkout/route.js");
  const processor=source("lib/payment-processor-server.js");
  const receipt=source("app/api/driver/shopping/route.js");
  assert.match(checkout,/paidCheckoutEnabled !== true/);
  assert.match(checkout,/shopperPurchaseFundingReady !== true/);
  assert.match(checkout,/transactionType:"assist_shopping"/);
  assert.match(checkout,/commissionPercent:0/);
  assert.match(checkout,/merchantSettlementStatus:"not_applicable"/);
  assert.match(processor,/order\.transactionType === "assist_shopping" \? "not_applicable"/);
  assert.match(receipt,/order\.transactionType !== "assist_shopping"/);
  assert.match(receipt,/order\.transactionType === "assist_shopping" \? "not_applicable"/);
  assert.match(source("app/api/admin/assist/shopping/route.js"),/checkoutAuthorizedByAdminId/);
});
test("bulk data imports never overwrite existing business records",()=>{
  const importer=source("app/api/admin/assist/import/route.js");
  assert.match(importer,/batch\.create\(businessRef,data\)/);
  assert.match(importer,/existing_import_skip/);
  assert.match(importer,/protected_skip/);
  assert.match(importer,/possible_duplicate_skip/);
  assert.match(importer,/mode:"preview"/);
});
test("existing merchant checkout still validates commerce verification",()=>{
  const merchant=source("app/api/orders/create/route.js");
  assert.match(merchant,/marketplaceTrust\(businessData\)\.commerceVerified/);
  assert.match(merchant,/businessId: z\.string\(\)\.min\(1\)/);
  const money=source("lib/payment-processor-server.js");
  assert.match(money,/postPaymentCapturedLedger/);
});
test("country expansion is a geography setting, never an automatic payment method",()=>{
  assert.deepEqual(assistCountryDefaults("MW").supportedCurrencies,["MWK"]);
  assert.deepEqual(assistCountryDefaults("ZW").supportedCurrencies,["USD","ZWG"]);
  const geo=source("app/api/admin/assist/geography/route.js");
  assert.match(geo,/AFRICAN_COUNTRY_CODES/);
  assert.match(geo,/supportedCountries/);
  const checkout=source("app/api/customer/assist/shopping/checkout/route.js");
  assert.match(checkout,/quote\.currency!=="USD"/);
  assert.match(checkout,/record\.country!=="ZW"/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { brandCompatible, canonicalStoreId, claimSafeUnpartnered, verifiedResearchPrice } from "../lib/assist-research-menu.js";
import { independentStoreSafe } from "../lib/assist-store-safety.js";
const read = p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

const business={
  public:true,status:"provisional",country:"ZW",claimStatus:"unclaimed",
  ownerIds:[],verificationStatus:"unverified",commerceEnabled:false,
  source:{type:"spotly_assist_research",batchId:"zw_test",researchLocationId:"loc1"}
};
const branch={businessId:"assistbiz_abc",public:true,status:"provisional"};
const store={
  directoryBusinessId:"assistbiz_abc",directoryBranchId:"assistbranch_abc",
  sourceResearchBatchId:"zw_test",sourceResearchLocationId:"loc1",
  status:"published",assistAccepting:true,operationalReviewed:true
};
const now=Date.parse("2026-10-20T08:00:00.000Z");
const validPrice={
  brand:"Nando's",status:"independently_verified_reference",currency:"USD",
  priceReview:{decision:"verified",method:"phone",factualDataRightsReviewed:true,verifiedPrice:7},
  priceCheckedAt:"2026-10-19T08:00:00.000Z"
};

test("brand-specific approval doesn't transfer between chains",()=>{
  assert.equal(brandCompatible("Nando's","Nandos"),true);
  assert.equal(brandCompatible("Nando's","Hungry Lion"),false);
  assert.equal(verifiedResearchPrice(validPrice,"Hungry Lion",now),false);
});
test("only recent independently verified prices can be activated",()=>{
  assert.equal(verifiedResearchPrice(validPrice,"Nando's",now),true);
  assert.equal(verifiedResearchPrice({...validPrice,priceCheckedAt:"2026-09-01T00:00:00Z"},"Nando's",now),false);
  assert.equal(verifiedResearchPrice({...validPrice,priceReview:{...validPrice.priceReview,method:"not_verified"}},"Nando's",now),false);
  assert.equal(verifiedResearchPrice({...validPrice,status:"online_reference_unverified"},"Nando's",now),false);
});
test("claims and disabled locations stop independent orders",()=>{
  assert.equal(claimSafeUnpartnered(business),true);
  assert.equal(claimSafeUnpartnered({...business,ownerIds:["owner"]}),false);
  assert.equal(independentStoreSafe(store,business,branch),true);
  assert.equal(independentStoreSafe(store,{...business,claimStatus:"claimed"},branch),false);
  assert.equal(independentStoreSafe(store,{...business,assistAccepting:false},branch),false);
  assert.equal(independentStoreSafe(store,business,{...branch,public:false}),false);
  assert.equal(independentStoreSafe({...store,operationalReviewed:false},business,branch),false);
});
test("research-linked stores cannot become independent from their canonical records",()=>{
  assert.equal(independentStoreSafe(store,null,branch),false);
  assert.equal(independentStoreSafe(store,business,null),false);
  assert.equal(independentStoreSafe({...store,sourceResearchLocationId:"different"},business,branch),false);
  assert.equal(independentStoreSafe({...store,status:"paused"},business,branch),false);
  assert.equal(canonicalStoreId("assistbiz_abc"),"assistresearch_assistbiz_abc");
});
test("activation is not checkout or dispatch and requires independent verification",()=>{
  const route=read("app/api/admin/assist-research/activate-menu/route.js");
  assert.match(route,/operatorCoverageAttestedBy/);
  assert.match(route,/verifiedResearchPrice/);
  assert.match(route,/claimSafeUnpartnered/);
  assert.match(route,/businessClaims/);
  assert.match(route,/tx\.set\(storeRef/);
  assert.match(route,/tx\.create\(db\.collection\("auditLogs"\)/);
  for(const collection of ["orders","products","paymentIntents","deliveryJobs","rideTrips"]) {
    assert.doesNotMatch(route,new RegExp('collection\\("'+collection+'"\\)'));
  }
});
test("public and request endpoints enforce canonical availability",()=>{
  for(const file of [
    "app/api/public/independent-shopping/route.js",
    "app/api/customer/independent-shopping/requests/route.js",
    "app/api/public/service-feed/route.js"
  ]) assert.match(read(file),/filterSafeIndependentStores/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { brandCompatible, canonicalStoreId, claimSafeUnpartnered, verifiedResearchPrice, verifiedLocationPrice } from "../lib/assist-research-menu.js";
import { independentStoreSafe } from "../lib/assist-store-safety.js";
import { marketplaceTrust } from "../lib/marketplace-trust.js";
const read = p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

const business={
  public:true,launchApproved:true,status:"provisional",country:"ZW",claimStatus:"unclaimed",
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
  assert.equal(claimSafeUnpartnered({...business,claimStatus:"claim_needs_information"}),false);
  assert.equal(claimSafeUnpartnered({...business,claimStatus:undefined}),false);
  assert.equal(claimSafeUnpartnered({...business,ownershipStatus:"claim_pending"}),false);
  assert.equal(independentStoreSafe(store,business,branch),true);
  assert.equal(independentStoreSafe(store,{...business,launchApproved:false},branch),false);
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
  assert.match(route,/verifiedLocationPrice/);
  assert.match(route,/claimSafeUnpartnered/);
  assert.match(route,/businessClaims/);
  assert.match(route,/tx\.set\(storeRef/);
  assert.match(route,/tx\.create\(db\.collection\("auditLogs"\)/);
  for(const collection of ["orders","products","paymentIntents","deliveryJobs","rideTrips"]) {
    assert.doesNotMatch(route,new RegExp('collection\\("'+collection+'"\\)'));
  }
});
test("quote offering and acceptance both recheck canonical ownership",()=>{
 for(const file of [
   "app/api/admin/assist-shopping/actions/route.js",
   "app/api/customer/independent-shopping/requests/respond/route.js"
 ]) assert.match(read(file),/independentStoreSafe/);
});
test("public and request endpoints enforce canonical availability",()=>{
  for(const file of [
    "app/api/public/independent-shopping/route.js",
    "app/api/customer/independent-shopping/requests/route.js",
    "app/api/public/service-feed/route.js"
  ]) assert.match(read(file),/filterSafeIndependentStores/);
});

test("Admin preflight is read-only and reports independent-price and claim blockers",()=>{
  const source=read("app/api/admin/assist-research/pilot-preflight/route.js");
  assert.ok(source.includes("authenticateRequest(request,{roles})"));
  assert.ok(source.includes("verifiedLocationPrice"));
  assert.ok(source.includes("pendingClaims"));
  assert.ok(source.includes("canEnableMenu"));
  assert.ok(source.includes("canRequestQuote"));
  assert.ok(source.includes("mutationsPerformed:false,paymentCollected:false,driverDispatched:false"));
  for(const mutation of [".set(", ".update(", ".create(", ".delete(", "runTransaction("]){
    assert.equal(source.includes(mutation),false,"Preflight should not write Firestore: "+mutation);
  }
  const ui=read("components/admin-assist-menu-launch.js");
  assert.ok(ui.includes("Run read-only pilot checks"));
});

test("matching a chain brand never verifies another location's price",()=>{
 const source={id:"p1",brand:"Nando's",currency:"USD",itemName:"Quarter Chicken"};
 const approval={sourcePriceId:"p1",locationId:"branch_A",scope:"specific_location",verifiedPrice:8,
   currency:"USD",sourceRightsReviewed:true,method:"phone",notes:"Checked at branch A with staff",
   checkedAt:"2026-10-19T08:00:00.000Z"};
 assert.equal(verifiedLocationPrice(source,approval,"Nando's","branch_A",now),true);
 assert.equal(verifiedLocationPrice(source,null,"Nando's","branch_A",now),false);
 assert.equal(verifiedLocationPrice(source,approval,"Nando's","branch_B",now),false);
 assert.equal(verifiedLocationPrice(source,{...approval,scope:"brand"},"Nando's","branch_A",now),false);
 assert.equal(verifiedLocationPrice(source,{...approval,checkedAt:"2026-09-01T08:00:00.000Z"},"Nando's","branch_A",now),false);
 assert.equal(verifiedLocationPrice({...source,brand:"Hungry Lion"},approval,"Nando's","branch_A",now),false);
});
test("approval, discovery release and Assist ordering are three separate privileges",()=>{
 const route=read("app/api/admin/assist-research/publication/route.js");
 const trust=read("lib/marketplace-trust.js");
 assert.ok(route.includes('publicationState:"approved"'));
 assert.ok(route.includes('public:false,launchApproved:false'));
 assert.ok(route.includes('confirmation:z.literal("PUBLISH_TO_CUSTOMERS")'));
 assert.ok(route.includes('publicationState:"published",discoveryLaunchedAt'));
 assert.ok(trust.includes('record.launchApproved !== true'));
 const menu=read("app/api/admin/assist-research/activate-menu/route.js");
 assert.ok(menu.includes("launchApproved===true"));
 assert.ok(menu.includes("menuApprovals"));
});
test("all brands use the same location-scoped review queue",()=>{
 const route=read("app/api/admin/assist-research/location-prices/route.js");
 const menu=read("app/api/admin/assist-research/activate-menu/route.js");
 const ui=read("components/admin-assist-menu-launch.js");
 assert.ok(route.includes("confirmedForThisLocation"));
 assert.ok(route.includes("menuApprovals"));
 assert.ok(menu.includes("verifiedLocationPrice"));
 assert.ok(ui.includes("All researched restaurants"));
 assert.ok(ui.includes("Filter by brand"));
 assert.ok(ui.includes("Save location-specific price verification"));
});

test("research launch approval never grants merchant checkout or settlement",()=>{
 const research={...business,public:true,launchApproved:true,commerceEnabled:true,commerceVerified:true,
  commerceVerificationStatus:"verified",verificationStatus:"verified",ownerIds:["user_1"],
  status:"active",capabilities:["merchant_ordering","settlement"]};
 const trust=marketplaceTrust(research);
 assert.equal(trust.discoveryAllowed,true);
 assert.equal(trust.commerceVerified,false);
 assert.equal(trust.commerce.merchantOrdering,false);
 assert.equal(trust.commerce.settlement,false);
 assert.equal(marketplaceTrust({...research,launchApproved:false}).discoveryAllowed,false);
});

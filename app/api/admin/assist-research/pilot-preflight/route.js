import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { verifiedResearchPrice, brandCompatible, claimSafeUnpartnered, canonicalStoreId } from "@/lib/assist-research-menu";
import { independentStoreSafe } from "@/lib/assist-store-safety";
import { regionalServicePolicy } from "@/lib/v9-assist-regions";
export const runtime="nodejs";
const roles=["super_admin","platform_admin","operations_manager","data_import_manager"];
const ok=(id,label,value,detail="")=>({id,label,pass:Boolean(value),detail});
export async function GET(request) {
 try {
  await authenticateRequest(request,{roles});
  const q=new URL(request.url).searchParams;
  const batchId=String(q.get("batchId")||""),locationId=String(q.get("locationId")||"");
  if(!/^zw_[a-f0-9]{24}$/.test(batchId)||!/^[a-zA-Z0-9_-]{4,110}$/.test(locationId))
    return Response.json({ok:false,error:"Select a valid Zimbabwe research batch and location."},{status:422});
  const {db}=getAdminServices();
  const root=db.collection("assistResearchBatches").doc(batchId),loc=root.collection("locations").doc(locationId);
  const [batch,location,prices,settings]=await Promise.all([
   root.get(),loc.get(),root.collection("prices").limit(301).get(),db.collection("platformSettings").doc("global").get()
  ]);
  if(!batch.exists||batch.data().country!=="ZW"||!location.exists)
    return Response.json({ok:false,error:"Staged Zimbabwe restaurant not found."},{status:404});
  const item=location.data(),businessId=item.linkedBusinessId||"",branchId=item.linkedBranchId||"";
  const [biz,branch,store,claims]=await Promise.all([
   businessId?db.collection("businesses").doc(businessId).get():null,
   branchId?db.collection("branches").doc(branchId).get():null,
   businessId?db.collection("independentShoppingStores").doc(canonicalStoreId(businessId)).get():null,
   businessId?db.collection("businessClaims").where("businessId","==",businessId).limit(25).get():null
  ]);
  const b=biz?.exists?biz.data():null,br=branch?.exists?branch.data():null,st=store?.exists?store.data():null;
  const brand=item.brandName||item.name;
  const eligible=prices.docs.filter(doc=>verifiedResearchPrice(doc.data(),brand));
  const sameBrand=prices.docs.filter(doc=>brandCompatible(doc.data().brand,brand));
  const pendingClaims=claims?.docs?.some(doc=>["submitted","needs_information","under_review","approved"].includes(doc.data().status))||false;
  const review=item.publicationReview||null;
  const checks=[
   ok("location_published","Restaurant is individually published",item.publicationState==="published",
      "Research-only and rejected locations cannot receive shopping requests."),
   ok("source_identity","Canonical Firestore business and branch match source",
      Boolean(b&&br&&b.source?.type==="spotly_assist_research"&&b.source?.batchId===batchId&&b.source?.researchLocationId===locationId&&br.businessId===businessId),
      "Do not reuse another branch's menu or a merchant-owned listing."),
   ok("verified_location","Publication review documented actual address, operation and rights",
      Boolean(review?.addressVerified&&review?.operatingVerified&&review?.sourceRightsReviewed&&review?.duplicatesReviewed),
      "A published record still requires genuine verification evidence."),
   ok("ownership","Business remains unclaimed and independent",
      Boolean(b&&claimSafeUnpartnered(b)&&b.assistAccepting!==false&&!pendingClaims&&claims?.size!==25),
      "Pause independent shopping if any ownership claim is pending, approved or under review."),
   ok("branch","Location is public and not paused",
      Boolean(br&&br.public===true&&br.assistAccepting!==false&&!["archived","removed"].includes(br.status)),
      "Confirmed pickup address and local staff availability are required."),
   ok("country_policy","Zimbabwe Eat / Spotly Assist is allowed in this area",
      regionalServicePolicy(settings.data()?.assistCoverage||{},{country:"ZW",city:item.city,area:item.area},"eat").available,
      "Malawi remains Ride-only; service switches may disable a region."),
   ok("menu_prices","At least one independently verified USD price is current",
      eligible.length>0,
      "Only item reviews confirmed by phone, business or field visit within 14 days count."),
   ok("assistance","Independent shopping menu is activated and operator-attested",
      Boolean(st&&independentStoreSafe(st,b,br)),
      "This is an independent price-check request, not a paid restaurant order.")
  ];
  return Response.json({
   ok:true,batchId,locationId,restaurant:item.name,brand,
   country:"ZW",canEnableMenu:checks.slice(0,7).every(c=>c.pass),
   canRequestQuote:checks.every(c=>c.pass),
   totalPriceReferences:sameBrand.length,independentlyVerifiedPrices:eligible.length,
   publishedItemCount:st?.status==="published"?st.items?.length||0:0,
   storeStatus:st?.status||"not_created",
   checks,mutationsPerformed:false,paymentCollected:false,driverDispatched:false,
   description:"Read-only operational preflight. This does not contact restaurants, verify prices, create customer requests or charge anybody."
  },{headers:{"Cache-Control":"private, no-store"}});
 } catch(error){return apiError(error);}
}

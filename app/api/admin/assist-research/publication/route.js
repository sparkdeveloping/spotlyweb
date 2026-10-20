import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { rankRestaurantCandidates, normalizeRestaurantText, restaurantMatchSignals } from "@/lib/assist-research-match";
import { openPlaces } from "@/lib/open-marketplace-data";

export const runtime = "nodejs";
const roles = ["super_admin", "platform_admin", "operations_manager", "data_import_manager"];
const id = z.string().regex(/^[a-zA-Z0-9_-]{4,110}$/);
const batchId = z.string().regex(/^zw_[a-f0-9]{24}$/);
const locationReview = z.object({
  action: z.literal("review_location"), batchId, locationId: id,
  decision: z.enum(["new_business", "link_existing", "reject"]),
  businessId: z.string().max(160).default(""), branchId: z.string().max(160).default(""),
  verifiedAddress: z.string().trim().max(350).default(""),
  contactMethod: z.enum(["in_person","phone","business_confirmed","independent_field_research"]),
  addressVerified: z.boolean(), operatingVerified: z.boolean(),
  sourceRightsReviewed: z.boolean(), duplicatesReviewed: z.boolean(),
  notes: z.string().trim().min(8).max(1200)
}).strict();
const priceReview = z.object({
  action: z.literal("review_price"), batchId, priceId: id,
  decision: z.enum(["verified", "rejected"]),
  method: z.enum(["in_person","phone","business_confirmed","not_verified"]),
  checkedPrice: z.number().finite().min(0).max(100000).optional(),
  factualDataRightsReviewed: z.boolean(), notes: z.string().trim().min(8).max(700)
}).strict();
const command = z.discriminatedUnion("action", [locationReview, priceReview]);
const publishSchema = z.object({batchId,locationId:id}).strict();
const launchSchema = z.object({batchId,locationId:id,confirmation:z.literal("PUBLISH_TO_CUSTOMERS")}).strict();
const withdrawSchema = z.object({batchId,locationId:id,reason:z.string().trim().min(8).max(700)}).strict();
const digest = value => createHash("sha256").update(value).digest("hex").slice(0,27);
const fail = (message,status=409) => { throw Object.assign(new Error(message), { status }); };
const norm = value => normalizeRestaurantText(value);
function meaningfulAddress(value) {
  const s=String(value||"").trim();
  return s.length>=8 && !/requires verification|unknown|tbd|not available|exact street address/i.test(s);
}
function safeListingIds(batch,loc) {
  const hash=digest(batch+"|"+loc);
  return {businessId:"assistbiz_"+hash,branchId:"assistbranch_"+hash,organizationId:"assistorg_"+hash};
}
function keyFor(location,address){
  return digest([location.country||"ZW",norm(location.city),norm(location.name),norm(address)].join("|"));
}
function curatedCandidates(record,address) {
  const matches=openPlaces().filter(place => norm(place.city)===norm(record.city) && String(place.country||"ZW").toUpperCase()==="ZW");
  return rankRestaurantCandidates({...record,address},matches.map(item=>({...item,type:"curated",businessId:item.id})),15);
}
function candidate(doc,type) {
  const d=doc.data();
  return {
    id:doc.id,type,
    businessId:type==="branch"?String(d.businessId||""):doc.id,
    name:String(d.name||d.displayName||d.branchName||""),
    brandName:String(d.brandName||""),
    country:String(d.country||"ZW"),
    city:String(d.city||""),address:String(d.address||""),phone:String(d.phone||"")
  };
}
async function findLiveCandidates(tx,db,record,address) {
  const scans=await Promise.all([
    tx.get(db.collection("businesses").where("city","==",record.city).limit(500)),
    tx.get(db.collection("branches").where("city","==",record.city).limit(500))
  ]);
  if(scans.some(scan=>scan.size>=500))fail("This city has more businesses than the safe review limit. Complete a full duplicate audit before publishing.");
  const candidates=scans.flatMap((snap,index)=>snap.docs.map(doc=>candidate(doc,index?"branch":"business")))
    .filter(item=>item.country==="ZW");
  return rankRestaurantCandidates({...record,address},candidates,15);
}
async function stagedRefs(db,batch,location) {
  const root=db.collection("assistResearchBatches").doc(batch);
  const loc=root.collection("locations").doc(location);
  return {root,loc};
}

export async function GET(request) {
  try{
    await authenticateRequest(request,{roles});
    const url=new URL(request.url),key=batchId.parse(url.searchParams.get("batchId"));
    const {db}=getAdminServices();
    const root=db.collection("assistResearchBatches").doc(key);
    const [batch,locations,prices]=await Promise.all([
      root.get(),root.collection("locations").limit(121).get(),root.collection("prices").limit(301).get()
    ]);
    if(!batch.exists || batch.data().country!=="ZW")fail("Research batch not found.",404);
    if(locations.size>120||prices.size>300)fail("This batch needs to be reviewed in smaller groups.");
    return Response.json({
      ok:true,batchId:key,
      summary:{
        locationCount:locations.size, priceCount:prices.size,
        reviewedLocations:locations.docs.filter(doc=>doc.data().publicationReview).length,
        approvedLocations:locations.docs.filter(doc=>doc.data().publicationState==="approved").length,
        publishedLocations:locations.docs.filter(doc=>doc.data().publicationState==="published").length,
        linkedLocations:locations.docs.filter(doc=>doc.data().publicationState==="linked_existing").length,
        reviewedPrices:prices.docs.filter(doc=>doc.data().priceReview).length
      },
      locations:locations.docs.map(doc=>({
        id:doc.id,name:doc.data().name,brandName:doc.data().brandName,
        city:doc.data().city,area:doc.data().area,address:doc.data().address,
        phone:doc.data().phone,sourceUrl:doc.data().sourceUrl,
        observedAt:doc.data().observedAt,
        publicationState:doc.data().publicationState||"research_only",
        linkedBusinessId:doc.data().linkedBusinessId||null,
        linkedBranchId:doc.data().linkedBranchId||null,
        publicationReview:doc.data().publicationReview||null
      })),
      prices:prices.docs.map(doc=>({
        id:doc.id,brand:doc.data().brand,itemName:doc.data().itemName,
        onlineReferencePrice:doc.data().onlineReferencePrice,
        currency:doc.data().currency,sourceUrl:doc.data().priceSourceUrl,
        observedAt:doc.data().observedAt,
        review:doc.data().priceReview||null
      }))
    },{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){
    if(error instanceof z.ZodError)return Response.json({ok:false,error:"Choose a valid research batch."},{status:422});
    return apiError(error);
  }
}

export async function PATCH(request) {
  try{
    const actor=await authenticateRequest(request,{roles});
    const payload=command.parse(await request.json());
    const {db}=getAdminServices(),root=db.collection("assistResearchBatches").doc(payload.batchId);
    const doc=payload.action==="review_location"
      ?root.collection("locations").doc(payload.locationId)
      :root.collection("prices").doc(payload.priceId);
    let state;
    await db.runTransaction(async tx=>{
      const [batch,snap]=await Promise.all([tx.get(root),tx.get(doc)]);
      if(!batch.exists || batch.data().country!=="ZW"||!snap.exists)fail("Research record not found.",404);
      if(payload.action==="review_location"){
        const old=snap.data();
        if(["published","linked_existing","withdrawn"].includes(old.publicationState))fail("Published or linked records cannot be changed through research review.");
        if(payload.decision==="new_business"){
          if(!meaningfulAddress(payload.verifiedAddress)||!payload.addressVerified||!payload.operatingVerified||
             !payload.sourceRightsReviewed||!payload.duplicatesReviewed)fail("Verify the full address, current operating status, factual-data rights and duplicate search first.",422);
        }
        if(payload.decision==="link_existing"){
          if(!payload.businessId||!payload.duplicatesReviewed||!payload.sourceRightsReviewed)fail("Select an existing business and confirm its identity and source review.",422);
          const existing=await tx.get(db.collection("businesses").doc(payload.businessId));
          if(!existing.exists||String(existing.data().country||"ZW")!=="ZW")fail("Selected Zimbabwe business not found.",404);
          const candidateMatch=restaurantMatchSignals(old,{...existing.data(),id:existing.id});
          if(!candidateMatch||candidateMatch.rank==="brand_only")fail("A shared chain name is insufficient to link two outlets. Confirm a matching address, phone or full location name.");
          if(payload.branchId){
            const branch=await tx.get(db.collection("branches").doc(payload.branchId));
            if(!branch.exists||branch.data().businessId!==payload.businessId)fail("That branch does not belong to the selected business.",409);
          }
        }
        const review={
          decision:payload.decision,
          businessId:payload.decision==="link_existing"?payload.businessId:"",
          branchId:payload.decision==="link_existing"?payload.branchId:"",
          verifiedAddress:payload.verifiedAddress,
          contactMethod:payload.contactMethod,
          addressVerified:payload.addressVerified,
          operatingVerified:payload.operatingVerified,
          sourceRightsReviewed:payload.sourceRightsReviewed,
          duplicatesReviewed:payload.duplicatesReviewed,
          notes:payload.notes,reviewedBy:actor.uid,reviewedAt:new Date().toISOString()
        };
        tx.update(doc,{publicationReview:review,publicationState:payload.decision==="reject"?"rejected":"reviewed",reviewUpdatedAt:FieldValue.serverTimestamp()});
        state=payload.decision==="reject"?"rejected":"reviewed";
      }else{
        if(payload.decision==="verified"){
          if(payload.method==="not_verified"||payload.checkedPrice===undefined||!payload.factualDataRightsReviewed){
            fail("Verify the actual price with an independent check or the business before approving it.",422);
          }
        }
        const reviewed={
          decision:payload.decision,method:payload.method,
          verifiedPrice:payload.decision==="verified"?payload.checkedPrice:null,
          factualDataRightsReviewed:payload.factualDataRightsReviewed,
          notes:payload.notes,reviewedBy:actor.uid,reviewedAt:new Date().toISOString()
        };
        tx.update(doc,{priceReview:reviewed,
          status:payload.decision==="verified"?"independently_verified_reference":"rejected",
          // Price references stay PRIVATE. Merchant products cannot be auto-created.
          public:false,orderable:false,priceCheckedAt:payload.decision==="verified"?FieldValue.serverTimestamp():null
        });
        state=payload.decision;
      }
      tx.create(db.collection("auditLogs").doc(),{
        action:"assist.research."+payload.action,
        actorId:actor.uid,entityType:"assistResearch",entityId:doc.id,
        metadata:{batchId:payload.batchId,decision:payload.decision},
        createdAt:FieldValue.serverTimestamp()
      });
    });
    return Response.json({ok:true,state});
  }catch(error){
    if(error instanceof z.ZodError)return Response.json({ok:false,error:"Check all required verification fields.",details:error.flatten()},{status:422});
    return apiError(error);
  }
}

export async function POST(request) {
  try{
    const actor=await authenticateRequest(request,{roles:["super_admin","platform_admin","operations_manager"]});
    const {batchId:batchKey,locationId:locId}=publishSchema.parse(await request.json());
    const {db}=getAdminServices(),{root,loc}=await stagedRefs(db,batchKey,locId);
    const ids=safeListingIds(batchKey,locId);
    const org=db.collection("organizations").doc(ids.organizationId);
    const business=db.collection("businesses").doc(ids.businessId);
    const branch=db.collection("branches").doc(ids.branchId);
    let result;
    await db.runTransaction(async tx=>{
      const [rootSnap,locSnap]=await Promise.all([tx.get(root),tx.get(loc)]);
      if(!rootSnap.exists||rootSnap.data().country!=="ZW"||!locSnap.exists)fail("Research location not found.",404);
      const item=locSnap.data(),review=item.publicationReview;
      if(["approved","published","linked_existing"].includes(item.publicationState)){
        result={state:item.publicationState,businessId:item.linkedBusinessId,branchId:item.linkedBranchId,idempotent:true};return;
      }
      if(item.publicationState!=="reviewed"||!review||!review.sourceRightsReviewed||!review.duplicatesReviewed)fail("Complete the location verification review before publishing.");
      if(Date.now()-Date.parse(review.reviewedAt)>7*86400000)fail("Review is older than seven days. Reconfirm the location.");
      if(review.decision==="link_existing"){
        const ref=db.collection("businesses").doc(review.businessId);
        const existing=await tx.get(ref);
        if(!existing.exists||String(existing.data().country||"ZW")!=="ZW")fail("Existing business no longer available; redo the review.");
        const candidateMatch=restaurantMatchSignals(item,{...existing.data(),id:existing.id});
        if(!candidateMatch||candidateMatch.rank==="brand_only")fail("A shared brand alone is not enough to link these outlets. Review exact branch identity.");
        if(review.branchId){
          const snap=await tx.get(db.collection("branches").doc(review.branchId));
          if(!snap.exists||snap.data().businessId!==ref.id)fail("Selected branch no longer belongs to this business.");
        }
        tx.update(loc,{publicationState:"linked_existing",linkedBusinessId:ref.id,linkedBranchId:review.branchId||null,linkedAt:FieldValue.serverTimestamp(),linkedBy:actor.uid});
        result={state:"linked_existing",businessId:ref.id,branchId:review.branchId||null}; 
      }else if(review.decision==="new_business"){
        if(!review.addressVerified||!review.operatingVerified||!meaningfulAddress(review.verifiedAddress))fail("A verified physical pickup address and operating check are required.");
        // Abort when a verified merchant/branch or generated directory outlet appears to match.
        const generated=curatedCandidates(item,review.verifiedAddress);
        if(generated.some(({match})=>match.rank==="high"))fail("The outlet already appears in Spotly curated directory data. Resolve its canonical identity before publishing a duplicate.");
        const candidates=await findLiveCandidates(tx,db,item,review.verifiedAddress);
        if(candidates.some(({match,candidate})=>match.rank==="high"&&candidate.id!==ids.businessId&&candidate.id!==ids.branchId)){
          fail("A stronger existing business/branch match was found. Link it or review the duplicate first.");
        }
        const lock=db.collection("assistPublicationKeys").doc(keyFor(item,review.verifiedAddress));
        const [lockSnap,bizSnap,branchSnap,orgSnap]=await Promise.all([tx.get(lock),tx.get(business),tx.get(branch),tx.get(org)]);
        if(lockSnap.exists||bizSnap.exists||branchSnap.exists||orgSnap.exists)fail("An existing published record or matching publication lock already exists.");
        const now=FieldValue.serverTimestamp();
        const source={type:"spotly_assist_research",rightsStatus:"spotly_created",origin:item.sourceKind||"research",sourceUrl:item.sourceUrl,
          batchId:batchKey,researchLocationId:locId,factualRightsReviewed:true,operatorReviewedBy:actor.uid};
        tx.create(org,{
          name:item.brandName||item.name,legalName:"",businessIds:[business.id],
          branchIds:[branch.id],ownerIds:[],country:"ZW",status:"provisional",
          source,createdAt:now,updatedAt:now,createdBy:actor.uid
        });
        tx.create(business,{
          organizationId:org.id,branchIds:[branch.id],branchCount:1,ownerIds:[],
          name:item.name,brandName:item.brandName||item.name,
          businessType:"restaurant_food",operatingModel:"physical_single",
          capabilities:["discover","claim"],fulfilment:[],
          onboardingStatus:"not_started",onboardingProgress:0,
          category:item.category||"Restaurant",categories:[item.category||"Restaurant"],
          country:"ZW",city:item.city,area:item.area||"",address:review.verifiedAddress,
          phone:item.phone||"",description:"Independent directory listing. Not an official Spotly restaurant partner.",
          currency:"USD",acceptedCurrencies:["USD"],public:false,launchApproved:false,status:"provisional",
          claimStatus:"unclaimed",ownershipStatus:"unclaimed",verificationStatus:"unverified",
          commerceVerificationStatus:"not_verified",commerceVerified:false,commerceEnabled:false,
          onlinePaymentEnabled:false,cashEnabled:false,
          assistAccepting:false,assistOperationalReady:false,
          source,aliases:[item.name,item.brandName||item.name,item.city],
          createdAt:now,updatedAt:now,createdBy:actor.uid
        });
        tx.create(branch,{
          organizationId:org.id,businessId:business.id,
          name:"Main location",branchName:"Main location",
          displayName:item.name+" — "+item.city,
          country:"ZW",city:item.city,area:item.area||"",address:review.verifiedAddress,
          phone:item.phone||"",public:false,status:"provisional",
          fulfilment:[],pickup:{enabled:false},acceptedCurrencies:["USD"],
          operatingHoursStatus:"unverified",assistOperationalReady:false,
          source,createdAt:now,updatedAt:now,createdBy:actor.uid
        });
        tx.create(lock,{
          businessId:business.id,branchId:branch.id,
          researchBatchId:batchKey,locationId:locId,createdAt:now
        });
        tx.update(loc,{
          publicationState:"approved",linkedBusinessId:business.id,linkedBranchId:branch.id,
          approvedAt:now,approvedBy:actor.uid
        });
        result={state:"approved",businessId:business.id,branchId:branch.id};
      }else fail("Rejected locations cannot be published.");
      tx.create(db.collection("auditLogs").doc(),{
        action:"assist.research.publication."+result.state,
        actorId:actor.uid,entityType:"assistResearch",entityId:locId,
        metadata:{batchId:batchKey,businessId:result.businessId,branchId:result.branchId},
        createdAt:FieldValue.serverTimestamp()
      });
    });
    return Response.json({ok:true,...result});
  }catch(error){
    if(error instanceof z.ZodError)return Response.json({ok:false,error:"Select a valid reviewed location."},{status:422});
    return apiError(error);
  }
}

/**
 * Separate customer-discovery release. Approval alone keeps new records private.
 * Requires an explicit signed launch confirmation; never enables ordering.
 */
export async function PUT(request) {
  try {
    const actor=await authenticateRequest(request,{roles:["super_admin","platform_admin"]});
    const payload=launchSchema.parse(await request.json());
    const {db}=getAdminServices();
    const {root,loc}=await stagedRefs(db,payload.batchId,payload.locationId);
    const ids=safeListingIds(payload.batchId,payload.locationId);
    const business=db.collection("businesses").doc(ids.businessId);
    const branch=db.collection("branches").doc(ids.branchId);
    let result;
    await db.runTransaction(async tx=>{
      const [batch,location,biz,bra,claims]=await Promise.all([
        tx.get(root),tx.get(loc),tx.get(business),tx.get(branch),
        tx.get(db.collection("businessClaims").where("businessId","==",business.id).limit(25))
      ]);
      if(!batch.exists||batch.data().country!=="ZW"||!location.exists)fail("Research location was not found.",404);
      const entry=location.data(),review=entry.publicationReview;
      if(!["approved","published"].includes(entry.publicationState)||entry.linkedBusinessId!==business.id||entry.linkedBranchId!==branch.id)
        fail("First approve this exact research location. Linking an existing merchant cannot launch their listing.");
      if(!biz.exists||!bra.exists||bra.data().businessId!==business.id)
        fail("The approved directory business and branch no longer match.");
      const owned=biz.data();
      if(owned.source?.type!=="spotly_assist_research"||
         owned.source?.batchId!==payload.batchId||
         owned.source?.researchLocationId!==payload.locationId)
        fail("Research source does not match this business.");
      if(owned.launchApproved===true && entry.publicationState==="published"){
        result={state:"published",businessId:business.id,branchId:branch.id,idempotent:true};return;
      }
      if(owned.claimStatus!=="unclaimed"||owned.ownershipStatus!=="unclaimed"||
         (owned.ownerIds||[]).length||owned.commerceEnabled===true||owned.commerceVerified===true)
        fail("A claimed, commerce-enabled or reassigned business must use its owner-controlled publication process.");
      if(claims.size>=25||claims.docs.some(doc=>["submitted","needs_information","under_review","approved"].includes(doc.data().status)))
        fail("An ownership claim is pending. Resolve it before public discovery.");
      if(!review?.addressVerified||!review?.operatingVerified||!review?.sourceRightsReviewed||!review?.duplicatesReviewed)
        fail("A documented business/location verification is required.");
      // This is discovery-only. Merchant ordering, fees, payments and Driver dispatch stay off.
      const now=FieldValue.serverTimestamp();
      tx.update(business,{
        public:true,launchApproved:true,assistAccepting:false,
        commerceEnabled:false,commerceVerified:false,updatedAt:now
      });
      tx.update(branch,{public:true,updatedAt:now});
      tx.update(loc,{
        publicationState:"published",discoveryLaunchedAt:now,discoveryLaunchedBy:actor.uid
      });
      tx.create(db.collection("auditLogs").doc(),{
        action:"assist.research.discovery_launched",
        actorId:actor.uid,entityType:"business",entityId:business.id,
        metadata:{batchId:payload.batchId,locationId:payload.locationId,branchId:branch.id},
        createdAt:now
      });
      result={state:"published",businessId:business.id,branchId:branch.id};
    });
    return Response.json({ok:true,...result,commerceEnabled:false,requestEnabled:false});
  }catch(error){
    if(error instanceof z.ZodError)return Response.json({ok:false,error:"A separate explicit discovery-launch confirmation is required."},{status:422});
    return apiError(error);
  }
}

export async function DELETE(request) {
  try {
    const actor=await authenticateRequest(request,{roles:["super_admin","platform_admin"]});
    const payload=withdrawSchema.parse(await request.json());
    const {db}=getAdminServices(),{root,loc}=await stagedRefs(db,payload.batchId,payload.locationId);
    const ids=safeListingIds(payload.batchId,payload.locationId);
    const business=db.collection("businesses").doc(ids.businessId);
    const branch=db.collection("branches").doc(ids.branchId);
    const result=await db.runTransaction(async tx=>{
      const [staged,biz,bra,pendingClaims]=await Promise.all([tx.get(loc),tx.get(business),tx.get(branch),tx.get(db.collection("businessClaims").where("businessId","==",business.id).limit(20))]);
      if(!staged.exists||staged.data().publicationState!=="published"||staged.data().linkedBusinessId!==business.id)fail("Only independently published, unclaimed research locations can be withdrawn.");
      if(!biz.exists||!bra.exists)fail("Related business records require manual review.",409);
      const d=biz.data();
      if(pendingClaims.size>=20 || pendingClaims.docs.some(doc=>["submitted","needs_information","under_review","approved"].includes(doc.data().status)))fail("Business has an existing or pending ownership claim. Manual withdrawal review required.");
      if(d.claimStatus!=="unclaimed" || d.ownerIds?.length || d.verificationStatus!=="unverified" || d.commerceEnabled===true || d.commerceVerified===true)fail("This business is claimed or commerce-enabled. Use the supervised owner process.");
      tx.update(business,{public:false,status:"archived",assistAccepting:false,updatedAt:FieldValue.serverTimestamp()});
      tx.update(branch,{public:false,status:"archived",updatedAt:FieldValue.serverTimestamp()});
      tx.update(loc,{publicationState:"withdrawn",withdrawnBy:actor.uid,withdrawnAt:FieldValue.serverTimestamp(),withdrawReason:payload.reason});
      tx.create(db.collection("auditLogs").doc(),{
        action:"assist.research.publication.withdrawn",actorId:actor.uid,
        entityType:"business",entityId:business.id,
        metadata:{batchId:payload.batchId,reason:payload.reason},
        createdAt:FieldValue.serverTimestamp()
      });
      return {state:"withdrawn",businessId:business.id};
    });
    return Response.json({ok:true,...result});
  }catch(error){
    if(error instanceof z.ZodError)return Response.json({ok:false,error:"Provide the location and reason for withdrawal."},{status:422});
    return apiError(error);
  }
}

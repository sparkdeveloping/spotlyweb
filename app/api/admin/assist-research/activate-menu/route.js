import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { brandCompatible, canonicalStoreId, claimSafeUnpartnered, verifiedLocationPrice } from "@/lib/assist-research-menu";
import { regionalServicePolicy } from "@/lib/v9-assist-regions";

export const runtime = "nodejs";
const roles = ["super_admin","platform_admin","operations_manager"];
const schema = z.object({
  batchId: z.string().regex(/^zw_[a-f0-9]{24}$/),
  locationId: z.string().regex(/^[a-zA-Z0-9_-]{4,110}$/),
  action: z.enum(["preview","enable","pause"]),
  priceIds: z.array(z.string().regex(/^[a-zA-Z0-9_-]{4,110}$/)).max(120).default([]),
  operationalAttested: z.boolean().default(false),
  agreementConfirmed: z.boolean().default(false)
}).strict();

async function loadSource(db, input) {
  const root = db.collection("assistResearchBatches").doc(input.batchId);
  const loc = root.collection("locations").doc(input.locationId);
  const [rootSnap,locSnap,prices,approvals] = await Promise.all([
    root.get(),loc.get(),root.collection("prices").limit(301).get(),loc.collection("menuApprovals").limit(121).get()
  ]);
  if (!rootSnap.exists || rootSnap.data()?.country!=="ZW" || !locSnap.exists) {
    throw Object.assign(new Error("The researched Zimbabwe restaurant could not be found."),{status:404});
  }
  if (prices.size > 300 || approvals.size > 120) throw Object.assign(new Error("Split this research batch before menu activation."),{status:409});
  const raw=locSnap.data();
  if(!["approved","published"].includes(raw.publicationState) || !raw.linkedBusinessId || !raw.linkedBranchId) {
    throw Object.assign(new Error("First publish and verify this specific restaurant location in Spotly Admin."),{status:409});
  }
  const compatible = prices.docs.filter(doc=>brandCompatible(raw.brandName || raw.name,doc.data().brand));
  const approvalMap = new Map(approvals.docs.map(doc=>[doc.id,doc.data()]));
  return {root,loc,raw,compatible,approvalMap};
}

export async function GET(request) {
  try{
    await authenticateRequest(request,{roles});
    const url=new URL(request.url);
    const batchId=url.searchParams.get("batchId");
    const locationId=url.searchParams.get("locationId");
    if(!/^zw_[a-f0-9]{24}$/.test(batchId||"")||(locationId && !/^[a-zA-Z0-9_-]{4,110}$/.test(locationId))) {
      return Response.json({ok:false,error:"Choose a published restaurant in the research batch."},{status:422});
    }
    const {db}=getAdminServices();
    if(!locationId){
      const batch=await db.collection("assistResearchBatches").doc(batchId).get();
      if(!batch.exists || batch.data()?.country!=="ZW")throw Object.assign(new Error("Batch not found."),{status:404});
      const locations=await batch.ref.collection("locations").limit(121).get();
      return Response.json({ok:true,batchId,locations:locations.docs.map(doc=>({
        id:doc.id,name:doc.data().name,brandName:doc.data().brandName||doc.data().name,city:doc.data().city,area:doc.data().area,
        publicationState:doc.data().publicationState||"research_only",
        linkedBusinessId:doc.data().linkedBusinessId||null
      })),count:locations.size},{headers:{"Cache-Control":"private, no-store"}});
    }
    const {raw,compatible,approvalMap}=await loadSource(db,{batchId,locationId});
    const [biz,branch,store]=await Promise.all([
      db.collection("businesses").doc(raw.linkedBusinessId).get(),
      db.collection("branches").doc(raw.linkedBranchId).get(),
      db.collection("independentShoppingStores").doc(canonicalStoreId(raw.linkedBusinessId)).get()
    ]);
    const valid= raw.publicationState==="published" && biz.exists && biz.data().launchApproved===true && claimSafeUnpartnered(biz.data()) &&
      biz.data().source?.researchLocationId === locationId &&
      biz.data().source?.batchId === batchId &&
      branch.exists && branch.data().businessId === biz.id &&
      branch.data().public===true;
    return Response.json({
      ok:true,batchId,locationId,restaurant:raw.name,brand:raw.brandName||raw.name,
      businessId:raw.linkedBusinessId,branchId:raw.linkedBranchId,
      publicationState:raw.publicationState,canActivate:Boolean(valid),reason:valid?"independent_unclaimed_location":"This location is approved but not separately released to customers, or its ownership/location checks are incomplete.",
      existingStore:store.exists?{id:store.id,status:store.data().status,itemCount:store.data().items?.length||0}:null,
      prices:compatible.map(doc=>({
        id:doc.id,name:doc.data().itemName,
        referencePrice:doc.data().onlineReferencePrice,currency:doc.data().currency,
        verifiedPrice:approvalMap.get(doc.id)?.verifiedPrice??null,
        verified:verifiedLocationPrice({id:doc.id,...doc.data()},approvalMap.get(doc.id),raw.brandName||raw.name,locationId),
        checkedAt:approvalMap.get(doc.id)?.checkedAt?.toDate?.()?.toISOString?.()||null,
        sourceUrl:doc.data().priceSourceUrl
      }))
    },{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){return apiError(error);}
}

export async function POST(request) {
  try{
    const actor=await authenticateRequest(request,{roles});
    const input=schema.parse(await request.json());
    const {db}=getAdminServices();
    const {raw,compatible,approvalMap}=await loadSource(db,input);
    const selected=new Map(compatible.map(doc=>[doc.id,doc]));
    if(input.action==="preview") {
      return Response.json({ok:true,eligible:input.priceIds.filter(id=>selected.has(id) && verifiedLocationPrice({id,...selected.get(id).data()},approvalMap.get(id),raw.brandName||raw.name,input.locationId)).length,selected:input.priceIds.length});
    }
    const locRef=db.collection("assistResearchBatches").doc(input.batchId).collection("locations").doc(input.locationId);
    const bRef=db.collection("businesses").doc(raw.linkedBusinessId);
    const brRef=db.collection("branches").doc(raw.linkedBranchId);
    const storeRef=db.collection("independentShoppingStores").doc(canonicalStoreId(raw.linkedBusinessId));
    if(storeRef.id.length>100)throw Object.assign(new Error("Store ID is too long for the Assist catalogue."),{status:422});
    let state;
    await db.runTransaction(async tx=>{
      const [business,branch,existing,claims]=await Promise.all([
        tx.get(bRef),tx.get(brRef),tx.get(storeRef),
        tx.get(db.collection("businessClaims").where("businessId","==",bRef.id).limit(25))
      ]);
      if(!business.exists||business.data().launchApproved!==true||!claimSafeUnpartnered(business.data()) ||
        business.data().source?.type!=="spotly_assist_research" ||
        business.data().source?.batchId!==input.batchId ||
        business.data().source?.researchLocationId!==input.locationId) {
        throw Object.assign(new Error("This restaurant is claimed, changed ownership, or is not an independently reviewed Spotly listing."),{status:409});
      }
      if(!branch.exists || branch.data().businessId!==business.id ||
        branch.data().public!==true || branch.data().status==="archived") {
        throw Object.assign(new Error("The approved location is not currently available."),{status:409});
      }
      if(claims.size===25 || claims.docs.some(doc=>["submitted","needs_information","under_review","approved"].includes(doc.data().status))) {
        throw Object.assign(new Error("A business claim is pending or approved. Stop independent shopping and complete the owner review."),{status:409});
      }
      if(existing.exists && (existing.data().directoryBusinessId!==business.id || existing.data().sourceResearchLocationId!==input.locationId)) {
        throw Object.assign(new Error("The existing independent store belongs to a different business or source. Manual reconciliation required."),{status:409});
      }
      const now=FieldValue.serverTimestamp();
      if(input.action==="pause") {
        if(!existing.exists)throw Object.assign(new Error("No independent menu is active for this location."),{status:404});
        tx.update(storeRef,{status:"paused",assistAccepting:false,operationalReviewed:false,updatedBy:actor.uid,updatedAt:now});
        state="paused";
      }else{
        if(!input.operationalAttested || !input.agreementConfirmed) {
          throw Object.assign(new Error("Confirm staff coverage, the independent purchase model and sourcing rights before enabling requests."),{status:422});
        }
        if(business.data().assistAccepting===false || branch.data().assistAccepting===false) {
          throw Object.assign(new Error("Spotly Admin has disabled Assist for this location."),{status:409});
        }
        const cfg=await tx.get(db.collection("platformSettings").doc("global"));
        if(!regionalServicePolicy(cfg.data()?.assistCoverage||{},{country:"ZW",city:raw.city,area:raw.area},"eat").available) {
          throw Object.assign(new Error("Independent restaurant shopping is disabled in this region."),{status:409});
        }
        if(!input.priceIds.length || new Set(input.priceIds).size!==input.priceIds.length) {
          throw Object.assign(new Error("Choose at least one unique, independently verified menu price."),{status:422});
        }
        // Prices are independently verified in the Admin research workflow, not scraped.
        const refs=input.priceIds.map(id=>selected.get(id));
        if(refs.some(x=>!x))throw Object.assign(new Error("A selected item belongs to another business or source batch."),{status:409});
        // Re-read both source and exact-location approvals transactionally. Brand-wide online references cannot authorize branch menus.
        const snaps=await Promise.all(refs.map(doc=>tx.get(doc.ref)));
        const locationApprovals=await Promise.all(refs.map(doc=>tx.get(locRef.collection("menuApprovals").doc(doc.id))));
        const prices=snaps.map((snap,i)=>{
          if(!snap.exists||!locationApprovals[i].exists||!verifiedLocationPrice({id:snap.id,...snap.data()},locationApprovals[i].data(),raw.brandName||raw.name,input.locationId)) {
            throw Object.assign(new Error("This exact branch does not have a current independent price verification for a selected item."),{status:409});
          }
          return {
            id:"research_"+snap.id,
            name:snap.data().itemName,
            category:"Food",unit:"",
            priceEstimate:locationApprovals[i].data().verifiedPrice,
            priceCheckedAt:locationApprovals[i].data().checkedAt.toDate().toISOString(),
            sourceResearchPriceId:snap.id,
            status:"available"
          };
        });
        tx.set(storeRef,{
          name:raw.name,category:"Restaurant",country:"ZW",currency:"USD",
          city:raw.city,area:raw.area||"",address:business.data().address,
          directoryBusinessId:business.id,directoryBranchId:branch.id,
          sourceResearchBatchId:input.batchId,sourceResearchLocationId:input.locationId,
          sourceRightsReviewed:true,
          affiliation:"unaffiliated",sourcingModel:"independent_in_person",
          priceCheckMethod:"independent_research",
          items:prices,status:"published",assistAccepting:true,
          operationalReviewed:true,operatorCoverageAttestedBy:actor.uid,
          operatorCoverageAttestedAt:now,updatedAt:now,updatedBy:actor.uid,
          ...(!existing.exists?{createdAt:now,createdBy:actor.uid}:{})
        },{merge:true});
        state="published";
      }
      tx.create(db.collection("auditLogs").doc(),{
        action:"assist.independent_menu."+state,
        actorId:actor.uid,entityType:"independentShoppingStore",entityId:storeRef.id,
        metadata:{businessId:business.id,branchId:branch.id,batchId:input.batchId,locationId:input.locationId,itemCount:input.priceIds.length},
        createdAt:now
      });
    });
    return Response.json({ok:true,state,storeId:storeRef.id,sourceBusinessId:raw.linkedBusinessId,paymentCollected:false,driverDispatched:false});
  }catch(error){
    if(error instanceof z.ZodError)return Response.json({ok:false,error:"Review the selected restaurant, prices and readiness confirmations.",details:error.flatten()},{status:422});
    return apiError(error);
  }
}

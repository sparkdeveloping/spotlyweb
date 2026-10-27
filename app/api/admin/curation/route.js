import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requirePlatformPermission } from "@/lib/access-control-server";
import { marketplaceDataSummary, openPlaces, openProducts } from "@/lib/open-marketplace-data";
import { masterProductPayload } from "@/lib/master-product-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema=z.object({action:z.enum(["sync_places","sync_products","sync_all"]),offset:z.number().int().min(0).max(10000).default(0),phase:z.enum(["places","products"]).default("places")});
const CHUNK=75;
const claimed=(record={})=>["claimed","owner_verified"].includes(String(record.ownershipStatus||record.claimStatus||"").toLowerCase())||(Array.isArray(record.ownerIds)&&record.ownerIds.length>0);

async function existingMap(db,collection,ids){const map=new Map();for(let i=0;i<ids.length;i+=CHUNK){const refs=ids.slice(i,i+CHUNK).map((id)=>db.collection(collection).doc(id));const snaps=await db.getAll(...refs);for(const snap of snaps)if(snap.exists)map.set(snap.id,snap.data());}return map;}
async function commitRows(db,collection,rows,actorId,kind){const existing=await existingMap(db,collection,rows.map((row)=>row.id));let created=0,updated=0,preserved=0;for(let i=0;i<rows.length;i+=CHUNK){const batch=db.batch();for(const row of rows.slice(i,i+CHUNK)){const ref=db.collection(collection).doc(row.id),current=existing.get(row.id);if(kind==="place"&&current&&claimed(current)){batch.set(ref,{curation:{source:row.source,lastSourceSnapshot:row.sourceTags||{},lastSyncedAt:FieldValue.serverTimestamp(),syncedBy:actorId},updatedSourceAt:FieldValue.serverTimestamp()},{merge:true});preserved++;continue;}if(kind==="product"&&current&&!["open_odbl","spotly_created"].includes(String(current.sourceRightsStatus||""))){batch.set(ref,{openReference:{sourceReferences:row.sourceReferences||[],lastSyncedAt:FieldValue.serverTimestamp()},updatedAt:FieldValue.serverTimestamp()},{merge:true});preserved++;continue;}if(kind==="place"){const payload={...row,curated:true,directoryVersion:5,ownershipStatus:"unclaimed",claimStatus:"unclaimed",verificationStatus:"listed",commerceVerificationStatus:"not_verified",commerceEnabled:false,commerceVerified:false,transactional:false,fulfilment:[],paymentMethods:[],capabilities:["discover","save","share","directions","contact","claim"],curation:{source:row.source,lastSourceSnapshot:row.sourceTags||{},lastSyncedAt:FieldValue.serverTimestamp(),syncedBy:actorId},updatedAt:FieldValue.serverTimestamp()};delete payload.sourceTags;batch.set(ref,payload,{merge:true});}else{const payload=masterProductPayload({...row,name:row.canonicalName,barcode:row.gtin,sourceType:row.sourceType,sourceReferences:row.sourceReferences,sourceRightsStatus:row.sourceRightsStatus,imageRightsStatus:"reference_only",verificationStatus:row.verificationStatus,country:"Zimbabwe",primaryImage:""},actorId);batch.set(ref,{...payload,merchantOfferRequired:true,storeAvailabilityConfirmed:false,curatedReference:true,updatedAt:FieldValue.serverTimestamp()},{merge:true});}if(current)updated++;else created++;}await batch.commit();}return{created,updated,preserved,total:rows.length};}

export async function GET(request) {
  try {
    const actor = await authenticateRequest(request);
    requirePlatformPermission(actor,"businesses.read",{roles:["content_manager","operations_manager","regional_operations_manager","business_success_manager"]});
    const {db}=getAdminServices();
    // Aggregate counts avoid downloading up to 15,000 records merely to render Admin metrics.
    const [curatedPlaces,unclaimed,masterProducts] = await Promise.all([
      db.collection("businesses").where("curated","==",true).count().get(),
      db.collection("businesses").where("claimStatus","==","unclaimed").count().get(),
      db.collection("masterProducts").count().get()
    ]);
    return Response.json({ok:true,sources:marketplaceDataSummary(),firestore:{
      curatedPlaces:curatedPlaces.data().count,unclaimed:unclaimed.data().count,masterProducts:masterProducts.data().count
    },policy:{unclaimedTransactions:false,unclaimedPickup:false,unclaimedCash:false,merchantOfferRequiredForStock:true,
      excludedDefaultSources:["google_maps_bulk","retailer_catalog_scrape","social_directory_scrape","provisional_review_required"]}},
      {headers:{"Cache-Control":"private, no-store"}});
  } catch(error){return apiError(error);}
}

export async function POST(request) {
  try {
    const actor=await authenticateRequest(request);
    requirePlatformPermission(actor,"businesses.update",{roles:["content_manager","operations_manager","regional_operations_manager"]});
    const {action,offset,phase}=schema.parse(await request.json());
    const {db}=getAdminServices();
    const stage=action==="sync_places"?"places":action==="sync_products"?"products":phase;
    const rows=stage==="places"?openPlaces():openProducts();
    if(offset>rows.length)throw Object.assign(new Error("The sync cursor is invalid. Refresh the dataset and start again."),{status:400});
    // One short Firestore transaction group per HTTP call. The client explicitly
    // continues; no 60-second monolithic invocation or detached background job.
    const batchRows=rows.slice(offset,offset+CHUNK);
    const result=await commitRows(db,stage==="places"?"businesses":"masterProducts",batchRows,actor.uid,stage==="places"?"place":"product");
    const processed=offset+batchRows.length;
    let next=null;
    if(processed<rows.length) next={action,phase:stage,offset:processed};
    else if(action==="sync_all"&&stage==="places") next={action,phase:"products",offset:0};
    await db.collection("auditLogs").add({
      actorId:actor.uid,actorEmail:actor.email||"",action:"marketplace.curation.sync_batch",
      entityType:"marketplaceDataset",entityId:stage,metadata:{offset,processed,total:rows.length,...result},
      source:"admin_curation",createdAt:FieldValue.serverTimestamp()
    });
    return Response.json({ok:true,places:stage==="places"?result:null,products:stage==="products"?result:null,
      progress:{stage,processed,total:rows.length,next,complete:next===null}});
  } catch(error) {
    if(error instanceof z.ZodError)return Response.json({ok:false,error:"Review the curation sync request."},{status:400});
    return apiError(error);
  }
}

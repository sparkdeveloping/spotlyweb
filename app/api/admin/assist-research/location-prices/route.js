import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { brandCompatible, verifiedLocationPrice } from "@/lib/assist-research-menu";

export const runtime="nodejs";
const roles=["super_admin","platform_admin","operations_manager","data_import_manager"];
const ids=z.string().regex(/^[a-zA-Z0-9_-]{4,110}$/);
const schema=z.object({
 batchId:z.string().regex(/^zw_[a-f0-9]{24}$/),
 locationId:ids,priceId:ids,
 method:z.enum(["in_person","phone","business_confirmed"]),
 verifiedPrice:z.number().finite().min(0).max(100000),
 sourceRightsReviewed:z.literal(true),
 confirmedForThisLocation:z.literal(true),
 notes:z.string().trim().min(8).max(1200)
}).strict();
const fail=(message,status=409)=>{throw Object.assign(new Error(message),{status});};

export async function GET(request) {
 try {
  await authenticateRequest(request,{roles});
  const q=new URL(request.url).searchParams;
  const batchId=q.get("batchId")||"",locationId=q.get("locationId")||"";
  if(!/^zw_[a-f0-9]{24}$/.test(batchId)||!/^[a-zA-Z0-9_-]{4,110}$/.test(locationId))
   return Response.json({ok:false,error:"Select a valid research batch and location."},{status:422});
  const {db}=getAdminServices(),root=db.collection("assistResearchBatches").doc(batchId);
  const loc=root.collection("locations").doc(locationId);
  const [batch,location,prices,approved]=await Promise.all([
   root.get(),loc.get(),root.collection("prices").limit(301).get(),loc.collection("menuApprovals").limit(121).get()
  ]);
  if(!batch.exists||batch.data().country!=="ZW"||!location.exists)fail("Research location not found.",404);
  if(prices.size>300||approved.size>120)fail("Menu needs to be reviewed in smaller groups.");
  const brand=location.data().brandName||location.data().name;
  const byId=new Map(approved.docs.map(d=>[d.id,d.data()]));
  const references=prices.docs.filter(d=>brandCompatible(brand,d.data().brand))
   .map(doc=>{
     const source={id:doc.id,...doc.data()},approval=byId.get(doc.id)||null;
     return {
       id:doc.id,name:source.itemName,brand:source.brand,
       originalReferencePrice:source.onlineReferencePrice,currency:source.currency,
       locationPrice:approval?.verifiedPrice??null,
       independentlyConfirmed:verifiedLocationPrice(source,approval,brand,locationId),
       checkedAt:approval?.checkedAt?.toDate?.()?.toISOString?.()||null,
       method:approval?.method||null,sourceUrl:source.priceSourceUrl
     };
   });
  return Response.json({ok:true,batchId,locationId,name:location.data().name,brand,
   publicationState:location.data().publicationState||"research_only",
   verifiedCount:references.filter(x=>x.independentlyConfirmed).length,
   references,public:false,orderable:false
  },{headers:{"Cache-Control":"private, no-store"}});
 }catch(error){return apiError(error);}
}

export async function POST(request) {
 try {
  const actor=await authenticateRequest(request,{roles});
  const payload=schema.parse(await request.json());
  const {db}=getAdminServices(),root=db.collection("assistResearchBatches").doc(payload.batchId);
  const loc=root.collection("locations").doc(payload.locationId);
  const source=root.collection("prices").doc(payload.priceId);
  const approved=loc.collection("menuApprovals").doc(payload.priceId);
  await db.runTransaction(async tx=>{
   const [batch,location,price]=await Promise.all([tx.get(root),tx.get(loc),tx.get(source)]);
   if(!batch.exists||batch.data().country!=="ZW"||!location.exists||!price.exists)fail("This brand or source item cannot be found.",404);
   const outlet=location.data();
   if(!["reviewed","approved","published"].includes(outlet.publicationState))fail("Review this specific restaurant before confirming location prices.");
   if(!brandCompatible(outlet.brandName||outlet.name,price.data().brand))fail("This price reference belongs to a different restaurant brand.");
   if(price.data().currency!=="USD")fail("Zimbabwe pilot price must use USD.");
   const stamp=FieldValue.serverTimestamp();
   tx.set(approved,{
     scope:"specific_location",locationId:payload.locationId,
     sourcePriceId:payload.priceId,brand:price.data().brand,
     name:price.data().itemName,currency:"USD",verifiedPrice:payload.verifiedPrice,
     method:payload.method,notes:payload.notes,
     sourceRightsReviewed:true,
     confirmedForThisLocation:true,
     checkedAt:stamp,checkedBy:actor.uid,updatedAt:stamp,
     public:false,orderable:false
   });
   tx.create(db.collection("auditLogs").doc(),{
     action:"assist.location_price.verified",actorId:actor.uid,
     entityType:"assistLocationMenuApproval",entityId:payload.priceId,
     metadata:{batchId:payload.batchId,locationId:payload.locationId,sourcePriceId:payload.priceId,scope:"specific_location"},
     createdAt:stamp
   });
  });
  return Response.json({ok:true,scope:"specific_location",public:false,orderable:false});
 }catch(error){
  if(error instanceof z.ZodError)return Response.json({ok:false,error:"Confirm the actual price for this specific restaurant branch, including evidence.",details:error.flatten()},{status:422});
  return apiError(error);
 }
}

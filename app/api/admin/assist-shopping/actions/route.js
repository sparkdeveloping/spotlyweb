import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { notifyUser } from "@/lib/notification-server";
import { independentStoreSafe } from "@/lib/assist-store-safety";
export const runtime = "nodejs";
const roles = ["super_admin","platform_admin","operations_manager"];
const schema = z.object({
 id: z.string().min(12).max(250),
 action: z.enum(["contacted","offer_quote","cannot_fulfil","cancel"]),
 merchandiseTotal: z.number().finite().min(0).max(10000000).optional(),
 shoppingFee: z.number().finite().min(0).max(1000000).optional(),
 deliveryFee: z.number().finite().min(0).max(1000000).optional(),
 expiresInMinutes: z.number().int().min(5).max(180).optional(),
 note: z.string().trim().max(800).default("")
}).strict();
const round = x => Math.round(x * 100) / 100;
export async function POST(request) {
 try {
   const actor = await authenticateRequest(request, { roles });
   const body = schema.parse(await request.json());
   const { db, messaging, auth } = getAdminServices();
   const ref = db.collection("independentShoppingRequests").doc(body.id);
   let state;
   await db.runTransaction(async tx => {
     const snap = await tx.get(ref);
     if(!snap.exists) throw Object.assign(new Error("Shopping request not found."),{status:404});
     const record=snap.data();
     if(body.action==="offer_quote"){
       const storeSnap=await tx.get(db.collection("independentShoppingStores").doc(record.storeId));
       if(!storeSnap.exists)throw Object.assign(new Error("This restaurant is no longer available for independent shopping."),{status:409});
       const store=storeSnap.data();
       const canonical=store.directoryBusinessId?await tx.get(db.collection("businesses").doc(store.directoryBusinessId)):null;
       const branch=store.sourceResearchBatchId&&store.directoryBranchId?await tx.get(db.collection("branches").doc(store.directoryBranchId)):null;
       if(!independentStoreSafe(store,canonical?.exists?canonical.data():null,branch?.exists?branch.data():null)){
         throw Object.assign(new Error("The restaurant is claimed or Spotly Assist is disabled. Do not send a new quote."),{status:409});
       }
     }
     if(!["pending_manual_quote","contacting_store","quote_offered"].includes(record.state)){
       throw Object.assign(new Error("The request is no longer available for this action."),{status:409});
     }
     const patch={updatedAt:FieldValue.serverTimestamp(),operatorId:actor.uid,lastOperatorNote:body.note};
     if(body.action==="contacted"){
       patch.state="contacting_store";
       patch.customerMessage="Spotly is checking prices and availability.";
     } else if(body.action==="offer_quote"){
       const values=[body.merchandiseTotal,body.shoppingFee,body.deliveryFee];
       if(values.some(x=>typeof x!=="number"||!Number.isFinite(x))||body.merchandiseTotal<=0){
         throw Object.assign(new Error("Confirm merchandise and fee amounts before quoting."),{status:422});
       }
       patch.finalQuote={
         merchandiseTotal:round(body.merchandiseTotal),
         shoppingFee:round(body.shoppingFee),
         deliveryFee:round(body.deliveryFee),
         total:round(body.merchandiseTotal+body.shoppingFee+body.deliveryFee),
         currency:record.estimate?.currency||"USD",
         confirmedAt:new Date().toISOString(),
         expiresAt:new Date(Date.now()+(body.expiresInMinutes||30)*60000).toISOString(),
         note:body.note
       };
       patch.state="quote_offered";
       patch.customerMessage="Your confirmed quote is ready to review. You have not been charged.";
     } else {
       patch.state=body.action==="cancel"?"cancelled":"cannot_fulfil";
       patch.customerMessage=body.note||"Spotly cannot arrange this purchase right now.";
     }
     state=patch.state;
     tx.update(ref,patch);
     tx.create(db.collection("independentShoppingRequestEvents").doc(),{
       requestId:body.id,actorId:actor.uid,actorType:"admin",
       action:body.action,priorState:record.state,state,note:body.note,
       createdAt:FieldValue.serverTimestamp()
     });
   });
   const stored=await ref.get();
   if(["offer_quote","cannot_fulfil","cancel"].includes(body.action)){
     const record=stored.data();
     await notifyUser({db,messaging,auth,userId:record?.customerId,
       title:body.action==="offer_quote"?"Your final shopping quote is ready":"Spotly shopping request update",
       body:record?.customerMessage||"Open Spotly to review your shopping request.",
       workspace:"customer",href:"/shop-for-me?store="+encodeURIComponent(record?.storeId||""),
       category:"assist_shopping",module:"spotly_assist",
       eventType:"assist.shopping."+body.action,entityType:"independentShoppingRequest",entityId:body.id
     }).catch(()=>{});
   }
   return Response.json({ok:true,state});
 } catch(error){
   if(error instanceof z.ZodError) return Response.json({ok:false,error:"Review the shopping request and quote amounts."},{status:422});
   return apiError(error);
 }
}

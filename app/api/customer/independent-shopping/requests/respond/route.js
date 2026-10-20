import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { independentStoreSafe } from "@/lib/assist-store-safety";
export const runtime="nodejs";
const schema=z.object({
 id:z.string().min(12).max(250),
 decision:z.enum(["accept_quote","decline_quote","cancel"])
}).strict();
export async function POST(request){
 try{
   const user=await authenticateRequest(request);
   const input=schema.parse(await request.json());
   const {db}=getAdminServices(),ref=db.collection("independentShoppingRequests").doc(input.id);
   let state;
   await db.runTransaction(async tx=>{
     const snap=await tx.get(ref);
     if(!snap.exists||snap.data().customerId!==user.uid)throw Object.assign(new Error("Shopping request not found."),{status:404});
     const d=snap.data(),quote=d.finalQuote;
     if(input.decision==="cancel"){
       if(!["pending_manual_quote","contacting_store","quote_offered"].includes(d.state))throw Object.assign(new Error("This request cannot be cancelled automatically."),{status:409});
       state="cancelled";
     } else {
       if(d.state!=="quote_offered"||!quote)throw Object.assign(new Error("There is no quote awaiting your decision."),{status:409});
       if(input.decision==="accept_quote"){
         const storeRef=db.collection("independentShoppingStores").doc(d.storeId);
         const storeSnap=await tx.get(storeRef);
         if(!storeSnap.exists)throw Object.assign(new Error("This shopping location is no longer available."),{status:409});
         const store=storeSnap.data();
         const canon=store.directoryBusinessId?await tx.get(db.collection("businesses").doc(store.directoryBusinessId)):null;
         const branch=store.sourceResearchBatchId&&store.directoryBranchId?await tx.get(db.collection("branches").doc(store.directoryBranchId)):null;
         if(!independentStoreSafe(store,canon?.exists?canon.data():null,branch?.exists?branch.data():null)){
           throw Object.assign(new Error("This restaurant has changed availability or ownership. Spotly must recheck the request."),{status:409});
         }
       }
       if(Date.parse(quote.expiresAt)<=Date.now())throw Object.assign(new Error("The quote has expired; ask Spotly to check the price again."),{status:409});
       state=input.decision==="accept_quote"?"quote_accepted_awaiting_payment":"quote_declined";
     }
     tx.update(ref,{
       state,customerDecision:input.decision,
       customerMessage:state==="quote_accepted_awaiting_payment"?"Quote accepted. Spotly has not charged you or dispatched a shopper yet.":"Your decision has been recorded.",
       updatedAt:FieldValue.serverTimestamp()
     });
     tx.create(db.collection("independentShoppingRequestEvents").doc(),{
       requestId:ref.id,actorId:user.uid,actorType:"customer",
       action:input.decision,state,createdAt:FieldValue.serverTimestamp()
     });
   });
   return Response.json({ok:true,state,paymentCollected:false,dispatchCreated:false});
 }catch(error){
   if(error instanceof z.ZodError)return Response.json({ok:false,error:"Review your quote decision."},{status:422});
   return apiError(error);
 }
}

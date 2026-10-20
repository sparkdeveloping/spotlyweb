import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { independentStoreSafe } from "@/lib/assist-store-safety";
import { independentShoppingFlags } from "@/lib/independent-shopping";
import { regionalServicePolicy } from "@/lib/v9-assist-regions";
export const runtime="nodejs";
const schema=z.object({
 id:z.string().min(12).max(250),
 decision:z.enum(["accept_quote","decline_quote","cancel","request_cancel"])
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
     if(input.decision==="request_cancel"){
       if(d.paymentStatus!=="paid_held"||["delivered","cancelled_pending_refund"].includes(d.state))
         throw Object.assign(new Error("The purchase cannot be cancelled through this route."),{status:409});
       if(d.cancellationRequested===true){state=d.state;return;}
       const jobRef=db.collection("assistIndependentShoppingJobs").doc(input.id);
       const floatRef=db.collection("assistShopperFloatTransfers").doc(input.id);
       const refundRef=db.collection("assistRefundRequests").doc("manual_"+input.id);
       const [job,float,refund]=await Promise.all([tx.get(jobRef),tx.get(floatRef),tx.get(refundRef)]);
       const now=FieldValue.serverTimestamp();
       const safeImmediate=d.state==="funded_awaiting_shopper"&&!job.exists&&!float.exists;
       if(safeImmediate){
         if(refund.exists)throw Object.assign(new Error("Finance is already reviewing a refund."),{status:409});
         if(!Number.isFinite(d.fundedAmount)||d.fundedAmount<=0)
           throw Object.assign(new Error("Confirmed captured funds must be reviewed by Finance."),{status:409});
         tx.create(refundRef,{requestId:input.id,currency:"USD",amount:d.fundedAmount,
           status:"awaiting_provider_execution",reason:"customer_cancelled_before_shopper_assignment",
           requestedBy:user.uid,createdAt:now});
       }else{
         tx.set(db.collection("assistFinanceIssues").doc("cancellation_"+input.id),{
           requestId:input.id,type:"customer_cancellation_requested",status:"open",
           updatedAt:now,createdAt:now
         },{merge:true});
       }
       state=safeImmediate?"cancelled_pending_refund":d.state;
       tx.update(ref,{state,cancellationRequested:true,cancellationRequestedAt:now,
         refundStatus:safeImmediate?"awaiting_provider_execution":d.refundStatus||null,
         customerMessage:safeImmediate?
          "Cancellation accepted before shopper assignment. Finance must arrange and verify the external refund.":
          "Cancellation requested. Operations must safely resolve any funds or shopping already in progress.",
         updatedAt:now});
       tx.create(db.collection("independentShoppingRequestEvents").doc(),{
         requestId:ref.id,actorId:user.uid,actorType:"customer",action:"request_cancel",
         state,createdAt:now});
       return;
     }
     if(input.decision==="cancel"){
       if(!["pending_manual_quote","contacting_store","quote_offered"].includes(d.state))throw Object.assign(new Error("This request cannot be cancelled automatically."),{status:409});
       state="cancelled";
     } else {
       if(d.state!=="quote_offered"||!quote)throw Object.assign(new Error("There is no quote awaiting your decision."),{status:409});
       if(input.decision==="accept_quote"){
         const storeRef=db.collection("independentShoppingStores").doc(d.storeId);
         const [storeSnap,settingsSnap]=await Promise.all([tx.get(storeRef),tx.get(db.collection("platformSettings").doc("global"))]);
         if(!storeSnap.exists)throw Object.assign(new Error("This shopping location is no longer available."),{status:409});
         const store=storeSnap.data();
         const settings=settingsSnap.data()||{};
         if(!independentShoppingFlags(settings).requestEnabled||!regionalServicePolicy(settings.assistCoverage||{},store,"eat").available)throw Object.assign(new Error("Spotly Assist requests are paused in this area."),{status:409});
         const canon=store.directoryBusinessId?await tx.get(db.collection("businesses").doc(store.directoryBusinessId)):null;
         const branch=store.sourceResearchBatchId&&store.directoryBranchId?await tx.get(db.collection("branches").doc(store.directoryBranchId)):null;
         if(!independentStoreSafe(store,canon?.exists?canon.data():null,branch?.exists?branch.data():null)){
           throw Object.assign(new Error("This restaurant has changed availability or ownership. Spotly must recheck the request."),{status:409});
         }
       }
       if(input.decision==="accept_quote" && (!Number.isFinite(Date.parse(quote.expiresAt)) || Date.parse(quote.expiresAt)<=Date.now()))throw Object.assign(new Error("The quote has expired; ask Spotly to check the price again."),{status:409});
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
   return Response.json({ok:true,state,requestRecorded:input.decision==="request_cancel",
     paymentCollected:false,dispatchCreated:false});
 }catch(error){
   if(error instanceof z.ZodError)return Response.json({ok:false,error:"Review your quote decision."},{status:422});
   return apiError(error);
 }
}

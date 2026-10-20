import {FieldValue} from "firebase-admin/firestore";
import {z} from "zod";
import {apiError,authenticateRequest,getAdminServices} from "@/lib/firebase-admin";
import {cost} from "@/lib/assist-fulfillment";
export const runtime="nodejs";
const schema=z.object({requestId:z.string().min(12).max(250),itemId:z.string().min(2).max(180),decision:z.enum(["approve","reject"])}).strict();
export async function POST(request){
 try{
  const actor=await authenticateRequest(request),body=schema.parse(await request.json()),{db}=getAdminServices();
  const ref=db.collection("independentShoppingRequests").doc(body.requestId),jobRef=db.collection("assistIndependentShoppingJobs").doc(body.requestId);
  let state;
  await db.runTransaction(async tx=>{
   const [snap,job]=await Promise.all([tx.get(ref),tx.get(jobRef)]);
   if(!snap.exists||snap.data().customerId!==actor.uid)throw Object.assign(new Error("Shopping request not found."),{status:404});
   if(!job.exists||job.data().state!=="shopping"||snap.data().paymentStatus!=="paid_held")throw Object.assign(new Error("This substitution can no longer be reviewed."),{status:409});
   const items=(job.data().items||[]).map(x=>({...x})),row=items.find(x=>x.itemId===body.itemId);
   if(!row||row.status!=="substitution_pending")throw Object.assign(new Error("No pending replacement for this item."),{status:409});
   if(body.decision==="approve"){
    row.status="substituted";row.actualQuantity=row.proposedQuantity;row.actualUnitPrice=row.proposedUnitPrice;
    const budget=cost(items.map(i=>["pending","substitution_pending"].includes(i.status)?{...i,status:"unavailable"}:i));
    if(budget>Number(job.data().authorizedSpend))throw Object.assign(new Error("The replacement exceeds the confirmed purchase allowance."),{status:409});
   }else{
    row.status="unavailable";row.actualQuantity=0;row.actualUnitPrice=0;
   }
   const pending=(snap.data().pendingSubstitutions||[]).filter(x=>x.itemId!==body.itemId);
   const now=FieldValue.serverTimestamp();
   tx.update(jobRef,{items,updatedAt:now});
   tx.update(ref,{pendingSubstitutions:pending,customerMessage:body.decision==="approve"?"Replacement approved. Your shopper will confirm its actual price.":"Replacement declined. Item removed from the basket.",updatedAt:now});
   tx.create(db.collection("assistShoppingEvents").doc(),{requestId:body.requestId,actorId:actor.uid,
     action:"substitution_"+body.decision,itemId:body.itemId,createdAt:now});
   state=row.status;
  });
  return Response.json({ok:true,state,noAdditionalCharge:true});
 }catch(e){if(e instanceof z.ZodError)return Response.json({ok:false,error:"Review your substitution decision."},{status:422});return apiError(e)}
}

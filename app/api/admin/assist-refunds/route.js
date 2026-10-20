import {createHash} from "node:crypto";
import {FieldValue} from "firebase-admin/firestore";
import {z} from "zod";
import {apiError,authenticateRequest,getAdminServices} from "@/lib/firebase-admin";
import {enforceRateLimit} from "@/lib/rate-limit-server";
import {notifyUser} from "@/lib/notification-server";
import {authorizedRefundCapacity,refundCents,refundReadyForConfirmation,refundSummary} from "@/lib/assist-refunds";

export const runtime="nodejs";
const roles=["super_admin","platform_admin","finance_admin"];
const fail=(message,status=409)=>{throw Object.assign(new Error(message),{status})};
const schema=z.object({
 requestId:z.string().regex(/^[A-Za-z0-9_-]{12,250}$/),
 refundType:z.enum(["balance","manual"]),
 action:z.enum(["submit_external_evidence","confirm_external_refund"]),
 externalReference:z.string().trim().max(180).optional(),
 evidenceUrl:z.string().url().max(850).optional(),
 note:z.string().trim().max(1400).default("")
}).strict();
const docs=(db,id)=>["balance","manual"].map(type=>db.collection("assistRefundRequests").doc(type+"_"+id));

export async function GET(request){
 try{
  await authenticateRequest(request,{roles});
  const {db}=getAdminServices();
  const snap=await db.collection("assistRefundRequests").limit(120).get();
  return Response.json({ok:true,refunds:snap.docs.map(d=>({
   id:d.id,requestId:d.data().requestId,amount:d.data().amount,currency:d.data().currency,
   status:d.data().status,reason:d.data().reason||"",requestedBy:d.data().requestedBy||null,
   executedBy:d.data().executedBy||null,confirmedBy:d.data().confirmedBy||null,
   externalReference:d.data().externalReference||null,evidenceUrl:d.data().evidenceUrl||null
  }))},{headers:{"Cache-Control":"private, no-store"}});
 }catch(error){return apiError(error);}
}

export async function POST(request){
 try{
  const actor=await authenticateRequest(request,{roles});
  await enforceRateLimit(request,{key:"assist-refund-reconciliation",limit:30,windowMs:3600000,identity:actor.uid});
  const input=schema.parse(await request.json());
  const {db,messaging,auth}=getAdminServices();
  const [balance,manual]=docs(db,input.requestId);
  const refundRef=input.refundType==="balance"?balance:manual;
  const requestRef=db.collection("independentShoppingRequests").doc(input.requestId);
  const configRef=db.collection("platformSettings").doc("global");
  let result;
  await db.runTransaction(async tx=>{
   const [requestSnap,configSnap,balanceSnap,manualSnap]=await Promise.all([
    tx.get(requestRef),tx.get(configRef),tx.get(balance),tx.get(manual)
   ]);
   if(!requestSnap.exists||requestSnap.data().model!=="independent_shopping")fail("Independent purchase not found.",404);
   if(configSnap.data()?.assistFinance?.refundReconciliationEnabled!==true)
    fail("Finance has not enabled externally verified refund reconciliation.",503);
   const refundDoc=input.refundType==="balance"?balanceSnap:manualSnap;
   if(!refundDoc.exists)fail("This refund request does not exist.",404);
   const d=refundDoc.data(),record=requestSnap.data(),others=[balanceSnap,manualSnap]
    .filter(s=>s.exists).map(s=>({id:s.id,...s.data()}));
   if(d.requestId!==input.requestId||d.currency!=="USD")fail("Refund ownership or currency does not match.");
   if(input.action==="submit_external_evidence"){
    if(d.status!=="awaiting_provider_execution")fail("Refund execution evidence has already been recorded.");
    if(!input.externalReference||input.externalReference.length<8||!input.evidenceUrl?.startsWith("https://")||input.note.length<20)
     fail("Provide a full provider/bank reference, HTTPS evidence link and detailed execution notes.",422);
    if(refundCents(d.amount)>refundCents(authorizedRefundCapacity(record,others,refundRef.id)))
     fail("Refund commitments exceed the captured customer funds.");
    const hash=createHash("sha256").update("assist-refund|"+input.externalReference).digest("hex");
    const uniqueRef=db.collection("assistRefundExternalReferences").doc(hash);
    const reserved=await tx.get(uniqueRef);
    if(reserved.exists)fail("This external refund reference has already been recorded.");
    const now=FieldValue.serverTimestamp();
    tx.create(uniqueRef,{refundId:refundRef.id,requestId:input.requestId,createdAt:now});
    tx.update(refundRef,{status:"external_evidence_submitted",externalReference:input.externalReference,
     evidenceUrl:input.evidenceUrl,executionNote:input.note,executedBy:actor.uid,executedAt:now,updatedAt:now});
    result={status:"external_evidence_submitted",refunded:false,requiresIndependentConfirmation:true};
   }else{
    const proof=refundReadyForConfirmation({...d,id:refundRef.id},actor.uid,others,record);
    const now=FieldValue.serverTimestamp();
    tx.update(refundRef,{status:"reconciled_external",confirmedBy:actor.uid,
     confirmedAt:now,reconciliationMethod:"independent_two_person_external_evidence",updatedAt:now});
    const updated=others.map(r=>r.id===refundRef.id?{...r,status:"reconciled_external"}:r);
    const summary=refundSummary(updated);
    tx.update(requestRef,{refundStatus:summary.status,refundReconciled:summary.reconciled,
     refundPending:summary.pending,updatedAt:now});
    tx.create(db.collection("assistMoneyLedger").doc("refund_"+refundRef.id),{
     requestId:input.requestId,refundId:refundRef.id,paymentIntentReference:record.paymentIntentReference,
     amount:proof.amount,currency:"USD",type:"externally_reconciled_refund",
     debitAccount:"independent_customer_funds_liability",creditAccount:"external_provider_refund_clearing",
     status:"externally_attested",externalReference:proof.externalReference,
     verifiedBy:[proof.executedBy,proof.confirmedBy],createdAt:now
    });
    result={status:"reconciled_external",refunded:true,externallyAttested:true,
     refundId:refundRef.id,customerId:record.customerId,amount:proof.amount};
   }
   tx.create(db.collection("auditLogs").doc(),{
    action:"assist.finance."+input.action,actorId:actor.uid,entityType:"assistRefund",
    entityId:refundRef.id,metadata:{requestId:input.requestId,status:result.status},createdAt:FieldValue.serverTimestamp()
   });
  });
  if(result.refunded&&result.customerId){
   await notifyUser({db,messaging,auth,userId:result.customerId,
    title:"Independent shopping refund update",
    body:"Spotly Finance has reconciled external refund evidence. Check your payment method or contact support if the credit is not visible.",
    workspace:"customer",href:"/shop-for-me",category:"assist_shopping",
    module:"spotly_assist",eventType:"assist.refund.external_reconciled",
    entityType:"independentShoppingRequest",entityId:input.requestId}).catch(()=>{});
  }
  return Response.json({ok:true,...result},{headers:{"Cache-Control":"private, no-store"}});
 }catch(error){
  if(error instanceof z.ZodError)return Response.json({ok:false,error:"Review the external refund reconciliation details."},{status:422});
  return apiError(error);
 }
}

import {createHash} from "node:crypto";
import {FieldValue} from "firebase-admin/firestore";
import {z} from "zod";
import {apiError,authenticateRequest,getAdminServices} from "@/lib/firebase-admin";
import {enforceRateLimit} from "@/lib/rate-limit-server";
import {notifyUser} from "@/lib/notification-server";
import {refundCents} from "@/lib/assist-refunds";
import {independentFinanceClosure} from "@/lib/assist-finance-close";

export const runtime="nodejs";
const roles=["super_admin","platform_admin","finance_admin"];
const fail=(m,s=409)=>{throw Object.assign(new Error(m),{status:s})};
const schema=z.object({
 requestId:z.string().regex(/^[A-Za-z0-9_-]{12,250}$/),
 action:z.enum(["reconcile_float","close_purchase"]),
 returnAmount:z.number().finite().min(0).max(100000).optional(),
 returnReference:z.string().trim().max(180).optional(),
 evidenceUrl:z.string().url().max(850).optional(),
 note:z.string().trim().max(1600).default("")
}).strict();

export async function GET(request){
 try{
  await authenticateRequest(request,{roles});
  const {db}=getAdminServices();
  const [float,closed]=await Promise.all([
   db.collection("assistShopperFloatTransfers").limit(100).get(),
   db.collection("assistFinanceClosures").limit(100).get()
  ]);
  return Response.json({ok:true,
   floatTransfers:float.docs.map(d=>({id:d.id,requestId:d.data().requestId,status:d.data().status,
     amount:d.data().amount,returnedAmount:d.data().returnedAmount??null,
     externalReference:d.data().externalReference,returnReference:d.data().returnReference||null,
     reconciledBy:d.data().reconciledBy||null})),
   closures:closed.docs.map(d=>({id:d.id,requestId:d.id,...d.data().summary,closedAt:d.data().closedAt?.toDate?.()?.toISOString?.()||null}))
  },{headers:{"Cache-Control":"private, no-store"}});
 }catch(error){return apiError(error);}
}

export async function POST(request){
 try{
  const actor=await authenticateRequest(request,{roles});
  await enforceRateLimit(request,{key:"assist-finance-close",limit:25,windowMs:3600000,identity:actor.uid});
  const body=schema.parse(await request.json());
  if(body.note.length<20)fail("Document the external transaction and Finance reconciliation.",422);
  const {db,messaging,auth}=getAdminServices();
  const req=db.collection("independentShoppingRequests").doc(body.requestId);
  const job=db.collection("assistIndependentShoppingJobs").doc(body.requestId);
  const float=db.collection("assistShopperFloatTransfers").doc(body.requestId);
  const closed=db.collection("assistFinanceClosures").doc(body.requestId);
  const refundDocs=["balance","manual"].map(kind=>db.collection("assistRefundRequests").doc(kind+"_"+body.requestId));
  let result;
  await db.runTransaction(async tx=>{
   const [r,j,f,old,global,balance,manual]=await Promise.all([
    tx.get(req),tx.get(job),tx.get(float),tx.get(closed),
    tx.get(db.collection("platformSettings").doc("global")),
    tx.get(refundDocs[0]),tx.get(refundDocs[1])
   ]);
   if(!r.exists||!j.exists||!f.exists||r.data().model!=="independent_shopping")
    fail("Funded independent shopping job and float are required.");
   if(global.data()?.assistFinance?.closeoutEnabled!==true)
    fail("External shopper float and finance closeout are not enabled for this operator.",503);
   if(old.exists)fail("This purchase is already financially closed.");
   if(j.data().state!=="delivered"||r.data().state!=="delivered"||
      r.data().paymentStatus!=="paid_held"||!j.data().receiptReviewedAt)
    fail("Only independently delivered, receipt-reviewed purchases can be closed.");
   const refunds=[balance,manual].filter(x=>x.exists).map(x=>({id:x.id,...x.data()}));
   const now=FieldValue.serverTimestamp();
   if(body.action==="reconcile_float"){
    if(f.data().status!=="externally_confirmed")fail("This float was already reconciled or is not confirmed.");
    if(!body.returnReference||body.returnReference.length<8||!body.evidenceUrl?.startsWith("https://")||
       body.returnAmount===undefined)fail("Provide evidence of the exact unused float returned.",422);
    if(f.data().verifiedBy===actor.uid)fail("A different Finance reviewer must reconcile the purchasing float.");
    if(refundCents(body.returnAmount)+refundCents(j.data().actualSpend)!==refundCents(f.data().amount))
     fail("Actual receipt spend and returned float do not balance the original transferred amount.");
    const referenceDoc=db.collection("assistFloatReturnExternalReferences").doc(
     createHash("sha256").update("float-return|"+body.returnReference).digest("hex"));
    if((await tx.get(referenceDoc)).exists)fail("External float-return reference has already been used.");
    tx.create(referenceDoc,{requestId:body.requestId,createdAt:now});
    tx.update(float,{status:"externally_reconciled",returnedAmount:body.returnAmount,
      returnReference:body.returnReference,returnEvidenceUrl:body.evidenceUrl,
      returnNote:body.note,reconciledBy:actor.uid,reconciledAt:now,updatedAt:now});
    result={status:"float_reconciled_external",customerFundsDisbursed:false};
   }else{
    if(actor.uid===f.data().reconciledBy||actor.uid===j.data().reviewedBy)
      fail("Purchase closeout requires a separate Finance reviewer.");
    const summary=independentFinanceClosure(r.data(),{...j.data(),requestId:body.requestId},
      f.data(),refunds);
    tx.create(closed,{requestId:body.requestId,summary,closedBy:actor.uid,
      closeoutNote:body.note,closedAt:now,status:"externally_reconciled"});
    if(summary.verifiedPurchase>0)tx.create(db.collection("assistMoneyLedger").doc("close_purchase_"+body.requestId),{
      requestId:body.requestId,currency:"USD",amount:summary.verifiedPurchase,
      type:"liability_purchase_allocation",debitAccount:"independent_customer_funds_liability",
      creditAccount:"independent_verified_purchase_clearing",status:"externally_attested",createdAt:now});
    if(summary.retainedServiceFees>0)tx.create(db.collection("assistMoneyLedger").doc("close_service_"+body.requestId),{
      requestId:body.requestId,currency:"USD",amount:summary.retainedServiceFees,
      type:"liability_service_fee_allocation",debitAccount:"independent_customer_funds_liability",
      creditAccount:"independent_assist_service_fee_income",status:"externally_attested",createdAt:now});
    tx.update(req,{financeStatus:"externally_reconciled",paymentStatus:"reconciled",
      financeClosedAt:now,refundPending:0,refundReconciled:summary.refunded,
      updatedAt:now});
    result={status:"externally_reconciled",customerId:r.data().customerId,summary};
   }
   tx.create(db.collection("auditLogs").doc(),{action:"assist.finance."+body.action,
     actorId:actor.uid,entityType:"independentShoppingRequest",entityId:body.requestId,
     metadata:{status:result.status},createdAt:now});
  });
  if(result.summary&&result.customerId){
   await notifyUser({db,messaging,auth,userId:result.customerId,
    title:"Independent shopping purchase reconciled",
    body:"Your delivery, spending and any externally documented refund are reconciled. Review Activity and your payment method.",
    workspace:"customer",href:"/shop-for-me",category:"assist_shopping",module:"spotly_assist",
    eventType:"assist.finance.closed",entityType:"independentShoppingRequest",entityId:body.requestId}).catch(()=>{});
  }
  return Response.json({ok:true,...result},{headers:{"Cache-Control":"private, no-store"}});
 }catch(error){
  if(error instanceof z.ZodError)return Response.json({ok:false,error:"Review the financial closure values and evidence."},{status:422});
  return apiError(error);
 }
}

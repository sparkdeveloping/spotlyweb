import {randomInt} from "node:crypto";
import {FieldValue} from "firebase-admin/firestore";
import {z} from "zod";
import {apiError,authenticateRequest,getAdminServices} from "@/lib/firebase-admin";
import {pinHash,canShop,cost} from "@/lib/assist-fulfillment";
import {independentStoreSafe} from "@/lib/assist-store-safety";
import {regionalServicePolicy} from "@/lib/v9-assist-regions";
export const runtime="nodejs";
const roles=["super_admin","platform_admin","operations_manager","finance_admin"];
const schema=z.object({
 action:z.enum(["record_float","assign","approve_receipt","request_refund"]),
 requestId:z.string().min(12).max(250),
 driverId:z.string().max(180).optional(),
 transferReference:z.string().max(180).optional(),
 transferEvidenceUrl:z.string().url().max(650).optional(),
 amount:z.number().finite().min(0).max(100000).optional(),
 note:z.string().trim().max(1200).default("")
}).strict();
const fail=(m,status=409)=>{throw Object.assign(new Error(m),{status})};
const finance=user=>user.profile?.roles?.some(r=>["finance_admin","super_admin","platform_admin"].includes(r));
export async function GET(request){
 try{
  await authenticateRequest(request,{roles});
  const {db}=getAdminServices();
  const [jobs,refunds,issues]=await Promise.all([
   db.collection("assistIndependentShoppingJobs").limit(100).get(),
   db.collection("assistRefundRequests").limit(50).get(),
   db.collection("assistFinanceIssues").limit(50).get()
  ]);
  return Response.json({ok:true,jobs:jobs.docs.map(d=>({id:d.id,driverId:d.data().driverId,requestId:d.data().requestId,state:d.data().state,
    storeName:d.data().storeName,actualSpend:d.data().actualSpend??null,authorizedSpend:d.data().authorizedSpend,
    receiptPath:d.data().receiptPath||null,updatedAt:d.data().updatedAt?.toDate?.()?.toISOString?.()||null})),
   refunds:refunds.docs.map(d=>({id:d.id,requestId:d.data().requestId,amount:d.data().amount,status:d.data().status})),
   financeIssues:issues.size},{headers:{"Cache-Control":"private, no-store"}});
 }catch(e){return apiError(e)}
}
export async function POST(request){
 try{
  const actor=await authenticateRequest(request,{roles}),input=schema.parse(await request.json());
  const {db}=getAdminServices(),ref=db.collection("independentShoppingRequests").doc(input.requestId),jobRef=db.collection("assistIndependentShoppingJobs").doc(input.requestId);
  const configRef=db.collection("platformSettings").doc("global");
  let result={};
  if(input.action==="record_float"){
   if(!finance(actor))fail("Only Spotly Finance can attest a confirmed external shopper float.",403);
   if(!input.transferReference||!input.transferEvidenceUrl||!input.amount||input.note.length<30)fail("Document the confirmed bank/provider transfer, reference, amount and evidence.",422);
   const floatRef=db.collection("assistShopperFloatTransfers").doc(input.requestId);
   await db.runTransaction(async tx=>{
    const [req,config,prior]=await Promise.all([tx.get(ref),tx.get(configRef),tx.get(floatRef)]);
    if(!req.exists||req.data().paymentStatus!=="paid_held")fail("Funds have not been captured and held for this purchase.");
    if(config.data()?.assistFinance?.manualFloatAttestationEnabled!==true)fail("Manual float attestation is disabled.",503);
    if(input.amount<Number(req.data().finalQuote?.merchandiseTotal||0))fail("Float must cover the authorized merchandise amount.");
    if(prior.exists)fail("This purchase already has a float record. Reconcile it rather than issuing another.");
    tx.create(floatRef,{requestId:input.requestId,status:"externally_confirmed",currency:"USD",amount:input.amount,
     externalReference:input.transferReference,evidenceUrl:input.transferEvidenceUrl,
     verifiedBy:actor.uid,verificationNote:input.note,createdAt:FieldValue.serverTimestamp()});
    tx.create(db.collection("auditLogs").doc(),{action:"assist.finance.float_attested",actorId:actor.uid,entityId:input.requestId,
     entityType:"assistShopperFloat",metadata:{transferReference:input.transferReference,amount:input.amount},createdAt:FieldValue.serverTimestamp()});
   });
   result={state:"float_attested",paymentChanged:false,shopperDispatched:false};
  }else if(input.action==="assign"){
   if(!input.driverId||input.note.length<12)fail("Choose an approved Driver and document the shopper assignment.",422);
   const floatRef=db.collection("assistShopperFloatTransfers").doc(input.requestId),presenceRef=db.collection("driverPresence").doc(input.driverId);
   const driverRef=db.collection("drivers").doc(input.driverId),appRef=db.collection("driverApplications").doc(input.driverId);
   const code=String(randomInt(100000,1000000));
   await db.runTransaction(async tx=>{
    const [req,config,float,prior,presence,driver,application]=await Promise.all([
      tx.get(ref),tx.get(configRef),tx.get(floatRef),tx.get(jobRef),tx.get(presenceRef),tx.get(driverRef),tx.get(appRef)]);
    if(!req.exists)fail("Customer request not found.",404);
    const record={...req.data(),id:ref.id},settings=config.data()||{};
    if(!canShop(record,settings,float.data()||{}))fail("Customer funding, verified float or independent Driver launch approval is missing.");
    if(prior.exists)fail("A shopper job already exists for this request.");
    if(!driver.exists||!application.exists||!["approved","ready","active"].includes(String(application.data().status||""))||driver.data().status==="suspended")
      fail("The selected Driver is not approved for work.");
    if(!presence.exists||presence.data().online!==true||presence.data().currentJobId||
      !presence.data().enabledCapabilities?.includes?.("shop_and_deliver"))
      fail("This Driver is not online, free and approved for Shop & Deliver.");
    if(float.data().verifiedBy===actor.uid)fail("A second operator must authorize assignment after Finance attests the float.");
    const storeRef=db.collection("independentShoppingStores").doc(record.storeId);
    const storeSnap=await tx.get(storeRef);if(!storeSnap.exists)fail("The store is no longer available.");
    const store=storeSnap.data();
    const business=store.directoryBusinessId?await tx.get(db.collection("businesses").doc(store.directoryBusinessId)):null;
    const branch=store.sourceResearchBatchId&&store.directoryBranchId?await tx.get(db.collection("branches").doc(store.directoryBranchId)):null;
    if(!independentStoreSafe(store,business?.exists?business.data():null,branch?.exists?branch.data():null)||
       !regionalServicePolicy(settings.assistCoverage||{},store,"eat").available)
      fail("Store ownership, launch or region availability has changed.");
    const now=FieldValue.serverTimestamp();
    tx.create(jobRef,{requestId:ref.id,driverId:input.driverId,storeId:record.storeId,storeName:record.storeName,
      state:"assigned",currency:"USD",authorizedSpend:Number(record.finalQuote.merchandiseTotal),
      financeFloatReference:float.data().externalReference,financeFloatVerifiedBy:float.data().verifiedBy,
      items:(record.items||[]).map(i=>({itemId:i.itemId,name:i.name,quantity:i.quantity,status:"pending",actualQuantity:0,actualUnitPrice:0})),
      customerPinHash:pinHash(ref.id,code),createdAt:now,updatedAt:now,assignedBy:actor.uid});
    tx.update(ref,{state:"shopper_assigned",dispatchStatus:"shopper_assigned",customerDeliveryPin:code,
      customerMessage:"A verified independent shopper has been assigned. Only share your handoff PIN in person.",
      updatedAt:now});
    tx.update(presenceRef,{currentJobId:jobRef.id,currentWorkType:"shop_and_deliver",updatedAt:now});
    tx.create(db.collection("assistShoppingEvents").doc(),{requestId:ref.id,driverId:input.driverId,actorId:actor.uid,
      action:"assigned",createdAt:now});
   });
   result={state:"shopper_assigned",paymentChanged:false,merchantOrderCreated:false};
  }else if(input.action==="approve_receipt"){
   if(input.note.length<12)fail("Record receipt reconciliation evidence.",422);
   await db.runTransaction(async tx=>{
    const [job,req,uploaded]=await Promise.all([tx.get(jobRef),tx.get(ref),tx.get(db.collection("assistReceiptUploads").doc(input.requestId))]);
    if(!job.exists||job.data().state!=="receipt_submitted"||!req.exists||req.data().paymentStatus!=="paid_held")
      fail("The job has no completed independent purchase receipt.");
    if(!uploaded.exists||uploaded.data().storagePath!==job.data().receiptPath)fail("The receipt upload no longer matches its reviewed job.");
    const spend=cost(job.data().items||[]);
    if(Math.abs(spend-Number(job.data().actualSpend))>0.01||spend>Number(job.data().authorizedSpend))
      fail("Actual item totals exceed authorization or do not match the receipt.");
    const now=FieldValue.serverTimestamp(),refund=Math.round((Number(job.data().authorizedSpend)-spend)*100)/100;
    tx.update(jobRef,{state:"collected",reviewedBy:actor.uid,receiptReviewNote:input.note,receiptReviewedAt:now,updatedAt:now});
    tx.update(ref,{state:"collected",dispatchStatus:"collected",actualMerchandiseSpend:spend,
      refundDue:refund,refundStatus:refund>0?"awaiting_provider_refund":"not_required",updatedAt:now});
    tx.create(db.collection("assistMoneyLedger").doc("purchase_"+input.requestId),{
      requestId:input.requestId,currency:"USD",amount:spend,type:"receipt_verified_purchase",
      debitAccount:"shopper_float_spend",creditAccount:"verified_third_party_purchase_cost",createdAt:now});
    if(refund>0)tx.set(db.collection("assistRefundRequests").doc("balance_"+input.requestId),
      {requestId:input.requestId,amount:refund,currency:"USD",status:"awaiting_provider_execution",
       reason:"unspent_merchandise_balance",createdAt:now},{merge:true});
    tx.create(db.collection("assistShoppingEvents").doc(),{requestId:input.requestId,actorId:actor.uid,
      action:"receipt_approved",actualSpend:spend,refundDue:refund,createdAt:now});
   });
   result={state:"collected",customerRefundIssued:false};
  }else{
   if(!finance(actor))fail("Only Spotly Finance may request independent purchase refunds.",403);
   if(!input.amount||input.note.length<12)fail("Record the amount and reason for the provider refund.",422);
   await db.runTransaction(async tx=>{
    const [req,old]=await Promise.all([tx.get(ref),tx.get(db.collection("assistRefundRequests").doc("manual_"+input.requestId))]);
    if(!req.exists||req.data().paymentStatus!=="paid_held")fail("No captured funds exist to refund.");
    if(input.amount>Number(req.data().fundedAmount||0))fail("Refund exceeds captured customer funds.");
    if(old.exists)fail("Refund already requested. Reconcile the provider result.");
    const now=FieldValue.serverTimestamp();
    tx.create(db.collection("assistRefundRequests").doc("manual_"+input.requestId),{
      requestId:input.requestId,amount:input.amount,currency:"USD",reason:input.note,
      status:"awaiting_provider_execution",createdAt:now,requestedBy:actor.uid});
    tx.update(ref,{refundStatus:"awaiting_provider_execution",updatedAt:now});
   });
   result={state:"refund_requested",customerRefundIssued:false,requiresProviderConfirmation:true};
  }
  return Response.json({ok:true,...result},{headers:{"Cache-Control":"private, no-store"}});
 }catch(e){if(e instanceof z.ZodError)return Response.json({ok:false,error:"Review the funded shopping job, staff authorization and evidence.",details:e.flatten()},{status:422});return apiError(e)}
}

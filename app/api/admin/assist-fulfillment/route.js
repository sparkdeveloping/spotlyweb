import { canonicalIndependentSource } from "@/lib/directory-shopping-server";
import { catalogueService } from "@/lib/spotly-catalogue";
import {randomInt} from "node:crypto";
import {FieldValue} from "firebase-admin/firestore";
import {z} from "zod";
import {apiError,authenticateRequest,getAdminServices} from "@/lib/firebase-admin";
import {pinHash,canShop,cost} from "@/lib/assist-fulfillment";
import {independentStoreSafe} from "@/lib/assist-store-safety";
import {regionalServicePolicy} from "@/lib/v9-assist-regions";
import {authorizedRefundCapacity,refundCents} from "@/lib/assist-refunds";
export const runtime="nodejs";
const roles=["super_admin","platform_admin","operations_manager","finance_admin"];
const schema=z.object({
 action:z.enum(["record_float","assign","approve_receipt","request_refund","resolve_incident","terminate_incident"]),
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
  const [jobs,refunds,issues,requests,shoppingIssues]=await Promise.all([
   db.collection("assistIndependentShoppingJobs").limit(100).get(),
   db.collection("assistRefundRequests").limit(50).get(),
   db.collection("assistFinanceIssues").limit(50).get(),
   db.collection("independentShoppingRequests").where("state","in",
    ["funded_awaiting_shopper","shopper_assigned","shopping","receipt_submitted","collected","en_route","exception_review"]).limit(100).get(),
   db.collection("assistShoppingIssues").where("status","==","open").limit(50).get()
  ]);
  return Response.json({ok:true,jobs:jobs.docs.map(d=>({id:d.id,driverId:d.data().driverId,requestId:d.data().requestId,state:d.data().state,
    storeName:d.data().storeName,actualSpend:d.data().actualSpend??null,authorizedSpend:d.data().authorizedSpend,
    receiptPath:d.data().receiptPath||null,updatedAt:d.data().updatedAt?.toDate?.()?.toISOString?.()||null})),
   requests:requests.docs.map(d=>({id:d.id,storeName:d.data().storeName,state:d.data().state,
     paymentStatus:d.data().paymentStatus||"not_initiated",total:d.data().finalQuote?.total||null,
     merchandiseTotal:d.data().finalQuote?.merchandiseTotal||null,dispatchStatus:d.data().dispatchStatus||"not_dispatched"})),
   refunds:refunds.docs.map(d=>({id:d.id,requestId:d.data().requestId,amount:d.data().amount,status:d.data().status})),
   financeIssues:issues.size,
   shoppingIssues:shoppingIssues.docs.map(d=>({id:d.id,requestId:d.data().requestId,status:d.data().status,
     note:d.data().note||"",previousState:d.data().previousState||"",driverId:d.data().driverId||""}))
  },{headers:{"Cache-Control":"private, no-store"}});
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
    if(prior.exists&&prior.data().state!=="rejected")
      fail("A shopper job already exists for this request; do not create duplicate assignments.");
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
    const branch=store.directoryBranchId?await tx.get(db.collection("branches").doc(store.directoryBranchId)):null;
    if(!independentStoreSafe(store,canonicalIndependentSource(business,store.directoryBusinessId),branch?.exists?branch.data():null)||
       !regionalServicePolicy(settings.assistCoverage||{},store,catalogueService(store)).available)
      fail("Store ownership, launch or region availability has changed.");
    const now=FieldValue.serverTimestamp();
    const jobData={requestId:ref.id,driverId:input.driverId,storeId:record.storeId,storeName:record.storeName,
      storeAddress:String(record.finalQuote?.collectionAddress||record.collectionAddress||store.address||""),
      sourceBusinessId:record.sourceBusinessId||store.directoryBusinessId||null,directoryBranchId:record.directoryBranchId||store.directoryBranchId||null,deliveryAddress:String(record.deliveryAddress||""),
      contactPhone:String(record.contactPhone||""),
      state:"assigned",currency:"USD",authorizedSpend:Number(record.finalQuote.merchandiseTotal),
      financeFloatReference:float.data().externalReference,financeFloatVerifiedBy:float.data().verifiedBy,
      items:(record.items||[]).map(i=>({itemId:i.itemId,name:i.name,quantity:i.quantity,status:"pending",actualQuantity:0,actualUnitPrice:0})),
      customerPinHash:pinHash(ref.id,code),createdAt:now,updatedAt:now,assignedBy:actor.uid};
    if(prior.exists)tx.set(jobRef,jobData);else tx.create(jobRef,jobData);
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
  }else if(input.action==="terminate_incident"){
   if(!actor.profile?.roles?.some(r=>["super_admin","platform_admin","operations_manager"].includes(r)))
     fail("Only Operations can halt an unresolved independent shopping job.",403);
   if(input.note.length<30)fail("Document the reason for termination, customer contact and financial handoff.",422);
   const issueRef=db.collection("assistShoppingIssues").doc(input.requestId);
   const presenceRefId=(await jobRef.get()).data()?.driverId;
   if(!presenceRefId)fail("Shopper assignment not found.");
   const presenceRef=db.collection("driverPresence").doc(presenceRefId);
   await db.runTransaction(async tx=>{
    const [job,req,issue,presence]=await Promise.all([
     tx.get(jobRef),tx.get(ref),tx.get(issueRef),tx.get(presenceRef)
    ]);
    if(!job.exists||!req.exists||!issue.exists||issue.data().status!=="open"||
       job.data().state!=="incident_paused"||req.data().paymentStatus!=="paid_held")
      fail("No matching funded, paused shopper incident exists.");
    if(actor.uid===issue.data().reportedBy)fail("A different operator must resolve the reported incident.");
    const now=FieldValue.serverTimestamp();
    tx.update(jobRef,{state:"terminated_finance_review",incidentResolution:input.note,
      terminatedAt:now,terminatedBy:actor.uid,updatedAt:now});
    tx.update(ref,{state:"financial_resolution_pending",dispatchStatus:"terminated_finance_review",
      customerMessage:"Shopping was stopped. Spotly Finance is reviewing the purchase funds and any refund due.",
      updatedAt:now});
    tx.update(issueRef,{status:"terminated_finance_review",resolvedBy:actor.uid,resolution:input.note,updatedAt:now});
    if(presence.exists&&presence.data().currentJobId===jobRef.id)
      tx.update(presenceRef,{currentJobId:FieldValue.delete(),currentWorkType:FieldValue.delete(),updatedAt:now});
    tx.set(db.collection("assistFinanceIssues").doc("failed_shopping_"+input.requestId),{
      requestId:input.requestId,status:"open",type:"terminated_shopping_funds_review",
      note:input.note,updatedAt:now,createdAt:now
    },{merge:true});
    tx.create(db.collection("auditLogs").doc(),{
      action:"assist.shopping.terminated_finance_review",actorId:actor.uid,
      entityType:"independentShoppingRequest",entityId:input.requestId,createdAt:now});
   });
   result={state:"financial_resolution_pending",refundIssued:false,financeReviewRequired:true};
  }else if(input.action==="resolve_incident"){
   if(!actor.profile?.roles?.some(r=>["super_admin","platform_admin","operations_manager"].includes(r)))
     fail("Only Operations can authorize resumption of independent shopping.",403);
   if(input.note.length<20)fail("Document the incident investigation and why resumption is safe.",422);
   const issueRef=db.collection("assistShoppingIssues").doc(input.requestId);
   const floatRef=db.collection("assistShopperFloatTransfers").doc(input.requestId);
   await db.runTransaction(async tx=>{
    const [job,req,issue,config,float]=await Promise.all([
     tx.get(jobRef),tx.get(ref),tx.get(issueRef),tx.get(configRef),tx.get(floatRef)
    ]);
    if(!job.exists||!req.exists||!issue.exists||issue.data().status!=="open"||
       job.data().state!=="incident_paused"||req.data().state!=="exception_review")
      fail("No matching paused independent shopping incident exists.");
    if(req.data().cancellationRequested)fail("Resolve the customer's cancellation before resuming work.");
    if(req.data().paymentStatus!=="paid_held"||config.data()?.assistFinance?.driverDispatchEnabled!==true||
       !float.exists||float.data().status!=="externally_confirmed"||
       Number(float.data().amount)<Number(job.data().authorizedSpend))
      fail("Funding, authorized float or the operating permission is missing.");
    if(actor.uid===issue.data().reportedBy)fail("The incident reporter cannot independently close this case.");
    const restored=job.data().pausedFromState;
    if(!["assigned","accepted","shopping","receipt_submitted","collected","en_route"].includes(restored))
      fail("The earlier state needs manual investigation and cannot be resumed.");
    const now=FieldValue.serverTimestamp();
    tx.update(jobRef,{state:restored,incidentResolvedBy:actor.uid,incidentResolution:input.note,
      pausedFromState:FieldValue.delete(),updatedAt:now});
    tx.update(ref,{state:restored==="assigned"?"shopper_assigned":restored,
      dispatchStatus:restored,customerMessage:"Operations reviewed the shopping issue and authorized work to resume.",
      updatedAt:now});
    tx.update(issueRef,{status:"resolved",resolvedBy:actor.uid,resolution:input.note,updatedAt:now});
    tx.create(db.collection("auditLogs").doc(),{
      action:"assist.shopping.incident_resolved",actorId:actor.uid,entityType:"assistShoppingIssue",
      entityId:input.requestId,metadata:{restored},createdAt:now});
   });
   result={state:"incident_resolved",customerRefundIssued:false};
  }else{
   if(!finance(actor))fail("Only Spotly Finance may request independent purchase refunds.",403);
   if(!input.amount||input.note.length<12)fail("Record the amount and reason for the provider refund.",422);
   refundCents(input.amount);
   await db.runTransaction(async tx=>{
    const [req,old,balance]=await Promise.all([tx.get(ref),
      tx.get(db.collection("assistRefundRequests").doc("manual_"+input.requestId)),
      tx.get(db.collection("assistRefundRequests").doc("balance_"+input.requestId))]);
    if(!req.exists||req.data().paymentStatus!=="paid_held")fail("No captured funds exist to refund.");
    if(!["delivered","cancelled_pending_refund","funded_awaiting_shopper","cannot_fulfil","financial_resolution_pending"].includes(req.data().state))
      fail("Manual refund review must wait until active shopping and delivery have been resolved.");
    const available=authorizedRefundCapacity(req.data(),balance.exists?[{id:balance.id,...balance.data()}]:[]);
    if(refundCents(input.amount)>refundCents(available))fail("Refund would exceed the remaining captured funds after existing refund commitments.");
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

import {FieldValue} from "firebase-admin/firestore";
import {z} from "zod";
import {apiError,authenticateRequest,getAdminServices} from "@/lib/firebase-admin";
import {notifyUsers} from "@/lib/driver-delivery-server";
export const runtime="nodejs";
const roles=["super_admin","platform_admin","operations_manager","regional_operations_manager"];
const schema=z.object({
 parcelJobId:z.string().min(3).max(180),
 action:z.enum(["arrange_return","mark_lost","resolve_uncollected","record_external_resolution","confirm_external_resolution"]),
 reason:z.string().trim().min(20).max(1200),
 externalReference:z.string().max(160).optional(),
 evidenceUrl:z.string().url().max(900).optional()
}).strict();
const terminal=new Set(["delivered","cancelled","failed","returned"]);
export async function POST(request){
 try{
  const actor=await authenticateRequest(request,{roles});
  const body=schema.parse(await request.json()),{db,messaging}=getAdminServices();
  if(body.action==="record_external_resolution"&&
     (!body.externalReference||!body.evidenceUrl?.startsWith("https://")))
    throw Object.assign(new Error("External recovery must have a provider/bank reference and HTTPS evidence."),{status:422});
  const ref=db.collection("parcelJobs").doc(body.parcelJobId),out={};
  await db.runTransaction(async tx=>{
   const snap=await tx.get(ref);
   if(!snap.exists)throw Object.assign(new Error("Send request was not found."),{status:404});
   const parcel=snap.data();
   const presenceRef=parcel.assignedDriverId?db.collection("driverPresence").doc(parcel.assignedDriverId):null;
   const presence=presenceRef?await tx.get(presenceRef):null;
   const reviewRef=db.collection("sendFinanceReviews").doc(body.parcelJobId);
   const reviewSnap=body.action==="confirm_external_resolution"?
     await tx.get(reviewRef):null;
   if(body.action==="confirm_external_resolution"){
     if(!reviewSnap?.exists||reviewSnap.data().status!=="awaiting_independent_confirmation"||
        reviewSnap.data().requestedBy===actor.uid||body.reason.length<40)
       throw Object.assign(new Error("A separate Finance operator must independently verify the Send settlement and record 40+ characters of evidence review."),{status:409});
     if(!terminal.has(parcel.state)||!["paid","refunded","cash_driver_attested"].includes(parcel.paymentStatus))
       throw Object.assign(new Error("Payment and parcel state must first be reconciled externally."),{status:409});
     const other=parcel.assignedDriverId?await tx.get(db.collection("sendFinanceReviews")
       .where("driverId","==",parcel.assignedDriverId).limit(101)):null;
     if(other?.size>=101)throw Object.assign(new Error("Driver has too many Send reviews for automatic clearance."),{status:409});
     const unresolved=other?.docs.some(doc=>doc.id!==body.parcelJobId&&doc.data().status!=="independently_closed")||false;
     const now=FieldValue.serverTimestamp();
     tx.update(reviewRef,{status:"independently_closed",confirmedBy:actor.uid,
       confirmationNote:body.reason,confirmedAt:now,updatedAt:now});
     tx.update(ref,{paymentReviewRequired:false,financeResolvedAt:now,
       financeResolutionStatus:"independently_closed",updatedAt:now});
     if(!unresolved&&parcel.assignedDriverId)
       tx.set(db.collection("drivers").doc(parcel.assignedDriverId),{
         sendFinanceHold:false,sendFinanceHoldClearedBy:actor.uid,sendFinanceHoldClearedAt:now},{merge:true});
   }
   const next=body.action==="arrange_return"?"return_in_progress":body.action==="mark_lost"?"failed":
     body.action==="resolve_uncollected"?"cancelled":parcel.state;
   if(body.action==="arrange_return"&&!["handoff_exception","collected","en_route","driver_arrived_dropoff","handoff_verification"].includes(parcel.state))
    throw Object.assign(new Error("A collected Send job needs a documented handoff failure before return."),{status:409});
   if(body.action==="mark_lost"&&!["collected","en_route","driver_arrived_dropoff","handoff_verification","handoff_exception","return_in_progress"].includes(parcel.state))
    throw Object.assign(new Error("Only a collected, undelivered parcel can be declared lost."),{status:409});
   if(body.action==="resolve_uncollected"&&!["requested","scheduled","awaiting_payment","searching_driver","driver_assigned","driver_to_pickup","driver_arrived_pickup","pickup_verification"].includes(parcel.state))
    throw Object.assign(new Error("Collected parcels must use a return or loss workflow."),{status:409});
   if(body.action==="record_external_resolution"&&
     (!terminal.has(parcel.state)||!parcel.paymentReviewRequired))
    throw Object.assign(new Error("Only a terminal Send with outstanding Finance review may be externally reconciled."),{status:409});
   if(body.action==="record_external_resolution"){
    if(parcel.financeResolvedAt)throw Object.assign(new Error("This Send reconciliation is already finalized."),{status:409});
    const evidenceRef=db.collection("sendFinanceExternalReferences").doc(body.externalReference);
    const evidence=await tx.get(evidenceRef);
    if(evidence.exists)throw Object.assign(new Error("This external reference was previously used."),{status:409});
    tx.create(evidenceRef,{parcelJobId:body.parcelJobId,externalReference:body.externalReference,
      evidenceUrl:body.evidenceUrl,recordedBy:actor.uid,createdAt:FieldValue.serverTimestamp()});
    tx.set(db.collection("sendFinanceReviews").doc(body.parcelJobId),{
      parcelJobId:body.parcelJobId,driverId:parcel.assignedDriverId||null,
      externalReference:body.externalReference,evidenceUrl:body.evidenceUrl,
      note:body.reason,requestedBy:actor.uid,status:"awaiting_independent_confirmation",
      createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()},{merge:true});
   }else if(body.action!=="confirm_external_resolution"){
    const now=FieldValue.serverTimestamp();
    const financeNeeded=parcel.paymentStatus==="paid"||body.action==="mark_lost"||body.action==="arrange_return";
    tx.update(ref,{state:next,exceptionCode:body.action,
      recoveryReason:body.reason,updatedAt:now,
      ...(financeNeeded?{paymentReviewRequired:true,driverEarningsStatus:"on_hold"}:{}),
      ...(body.action==="mark_lost"?{lostAt:now}:{}),
      ...(body.action==="arrange_return"?{returnStartedAt:now}:{})});
    if(parcel.orderId)tx.update(db.collection("orders").doc(parcel.orderId),{
      sendStatus:next,status:financeNeeded?"payment_exception":next,
      paymentReviewRequired:financeNeeded,updatedAt:now});
    if(financeNeeded){
      tx.set(db.collection("sendFinanceReviews").doc(body.parcelJobId),{
        parcelJobId:body.parcelJobId,driverId:parcel.assignedDriverId||null,
        status:"open",reason:body.reason,issueType:body.action,
        createdAt:now,updatedAt:now},{merge:true});
      if(parcel.assignedDriverId)tx.set(db.collection("drivers").doc(parcel.assignedDriverId),{
        sendFinanceHold:true,sendFinanceHoldAt:now},{merge:true});
    }
    if(next==="failed"||next==="cancelled"){
      if(presence?.exists&&presence.data().currentJobId===body.parcelJobId)
        tx.update(presenceRef,{currentJobId:null,currentWorkType:null,availabilityState:"online_current",updatedAt:now});
    }
    if(!terminal.has(next))tx.set(db.collection("adminQueueItems").doc("send_recovery_"+body.parcelJobId),{
      queue:"parcel-exceptions",type:"send_recovery",status:"open",priority:"high",
      parcelJobId:body.parcelJobId,entityId:body.parcelJobId,
      title:"Send recovery · customer and courier follow-up",createdAt:now,updatedAt:now},{merge:true});
   }
   tx.create(db.collection("parcelEvents").doc(),{
     parcelJobId:body.parcelJobId,type:"recovery."+body.action,actorType:"admin",
     actorId:actor.uid,previousState:parcel.state,state:next,note:body.reason,
     metadata:body.externalReference?{externalReference:body.externalReference}:{},
     createdAt:FieldValue.serverTimestamp()});
   tx.create(db.collection("auditLogs").doc(),{
     actorId:actor.uid,action:"send.recovery."+body.action,entityType:"parcelJob",
     entityId:body.parcelJobId,reason:body.reason,createdAt:FieldValue.serverTimestamp()});
   out.customerId=parcel.customerId;out.driverId=parcel.assignedDriverId;out.number=parcel.number;out.state=next;
  });
  await notifyUsers(db,messaging,[out.customerId,out.driverId].filter(Boolean),{
    title:"Send Operations update",body:"Your Send request needs an Operations recovery or financial review.",
    href:"/send",category:"send",workspace:"customer",module:"send"
  }).catch(()=>{});
  return Response.json({ok:true,state:out.state,refundIssued:false,
   manualFinancialReview:body.action!=="resolve_uncollected"});
 }catch(error){
  if(error instanceof z.ZodError)return Response.json({ok:false,error:"Add a detailed Send recovery decision."},{status:422});
  return apiError(error);
 }
}

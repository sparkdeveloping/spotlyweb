import {FieldValue} from "firebase-admin/firestore";
import {z} from "zod";
import {apiError,authenticateRequest,getAdminServices} from "@/lib/firebase-admin";
import {enforceRateLimit} from "@/lib/rate-limit-server";

export const runtime="nodejs";
const roles=["finance_admin","super_admin","platform_admin"];
const fail=(message,status=409)=>{throw Object.assign(new Error(message),{status})};
const schema=z.object({
 rideId:z.string().min(3).max(180),
 action:z.enum(["submit_resolution","confirm_resolution"]),
 decision:z.enum(["platform_absorbs","external_driver_recovery_verified","provider_dispute_cleared"]).optional(),
 evidenceUrl:z.string().url().max(850).optional(),
 note:z.string().trim().max(1600).optional()
}).strict();

export async function GET(request){
 try{
  await authenticateRequest(request,{roles});
  const rideId=new URL(request.url).searchParams.get("rideId");
  if(!rideId||!/^[\w-]{3,180}$/.test(rideId))return Response.json({ok:false,error:"Specify a Ride."},{status:422});
  const {db}=getAdminServices();
  const [ride,record]=await Promise.all([
   db.collection("rideTrips").doc(rideId).get(),db.collection("rideFinanceReviews").doc(rideId).get()
  ]);
  if(!ride.exists)return Response.json({ok:false,error:"Ride not found."},{status:404});
  return Response.json({ok:true,rideId,paymentStatus:ride.data().paymentStatus,
   reviewRequired:ride.data().paymentReviewRequired===true,
   review:record.exists?{status:record.data().status,decision:record.data().decision,
    submittedBy:record.data().submittedBy,confirmedBy:record.data().confirmedBy||null,
    evidenceUrl:record.data().evidenceUrl||null,note:record.data().note||""}:null
  },{headers:{"Cache-Control":"private, no-store"}});
 }catch(e){return apiError(e);}
}
export async function POST(request){
 try{
  const actor=await authenticateRequest(request,{roles});
  await enforceRateLimit(request,{key:"ride_finance_review",limit:20,windowMs:3600000,identity:actor.uid});
  const input=schema.parse(await request.json()),{db}=getAdminServices();
  const rideRef=db.collection("rideTrips").doc(input.rideId),reviewRef=db.collection("rideFinanceReviews").doc(input.rideId);
  let outcome;
  await db.runTransaction(async tx=>{
   const [rideSnap,reviewSnap]=await Promise.all([tx.get(rideRef),tx.get(reviewRef)]);
   if(!rideSnap.exists||!rideSnap.data().assignedDriverId)fail("Assigned ride was not found.",404);
   const ride=rideSnap.data();
   if(ride.paymentReviewRequired!==true)fail("This Ride has no outstanding financial exception.");
   const driverId=ride.assignedDriverId,driverRef=db.collection("drivers").doc(driverId);
   const driverSnap=await tx.get(driverRef);
   if(!driverSnap.exists)fail("Driver account must be reviewed.",404);
   const now=FieldValue.serverTimestamp();
   if(input.action==="submit_resolution"){
    if(reviewSnap.exists&&reviewSnap.data().status==="awaiting_second_review")fail("An independent Finance review is already awaiting confirmation.");
    if(!input.decision||!input.evidenceUrl?.startsWith("https://")||String(input.note||"").length<40)
     fail("Provide a decision, HTTPS payment/bank evidence and detailed reconciliation notes.",422);
    tx.set(reviewRef,{rideId:input.rideId,driverId,decision:input.decision,
      note:input.note,evidenceUrl:input.evidenceUrl,status:"awaiting_second_review",
      submittedBy:actor.uid,createdAt:now,updatedAt:now},{merge:true});
    outcome={status:"awaiting_second_review",driverPayoutReleased:false,refundIssued:false};
   }else{
    if(!reviewSnap.exists||reviewSnap.data().status!=="awaiting_second_review"||
       reviewSnap.data().submittedBy===actor.uid)
      fail("An independent second Finance reviewer must inspect this unresolved case.");
    if(!["paid","refunded","cash_driver_attested"].includes(ride.paymentStatus))
      fail("Pending payment or refund execution must be resolved before releasing Driver funds.");
    if(!input.note||input.note.length<40)
      fail("Document independent review of the actual provider/bank evidence.",422);
    const others=await tx.get(db.collection("rideFinanceReviews").where("driverId","==",driverId).limit(101));
    if(others.size>=101)fail("Driver finance history is too large for automatic clearance.");
    const outstanding=others.docs.some(doc=>doc.id!==input.rideId&&doc.data().status!=="independently_closed");
    const release=!outstanding;
    tx.update(reviewRef,{status:"independently_closed",confirmedBy:actor.uid,
      confirmationNote:input.note,confirmedAt:now,updatedAt:now});
    tx.update(rideRef,{paymentReviewRequired:false,
      financeResolutionStatus:"independently_closed",financeResolutionAt:now,updatedAt:now});
    if(release)tx.update(driverRef,{rideFinanceHold:false,
      rideFinanceHoldClearedBy:actor.uid,rideFinanceHoldClearedAt:now,updatedAt:now});
    outcome={status:"independently_closed",driverPayoutReleased:release,refundIssued:false};
   }
   tx.create(db.collection("auditLogs").doc(),{
    action:"ride.finance."+input.action,entityType:"rideFinanceReview",entityId:input.rideId,
    actorId:actor.uid,metadata:{status:outcome.status,driverId},createdAt:now});
  });
  return Response.json({ok:true,...outcome},{headers:{"Cache-Control":"private, no-store"}});
 }catch(e){
  if(e instanceof z.ZodError)return Response.json({ok:false,error:"Review Finance reconciliation evidence."},{status:422});
  return apiError(e);
 }
}

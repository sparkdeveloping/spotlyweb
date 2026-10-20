import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { notifyUsers } from "@/lib/driver-delivery-server";
import { creditParcelEarnings, recordCashParcelPlatformFee } from "@/lib/driver-money-server";
import { appendParcelEvent, DRIVER_PARCEL_TRANSITIONS } from "@/lib/parcel-server";
import { safeText } from "@/lib/server-helpers";
import {matchesParcelPin,expectedParcelProofPath} from "@/lib/send-security";

export const runtime = "nodejs";
const schema = z.object({ parcelJobId: z.string().min(3).max(180), action: z.enum(["start_to_pickup", "arrive_pickup", "begin_pickup_verification", "verify_pickup", "start_delivery", "arrive_dropoff", "begin_handoff", "complete","report_handoff_problem","confirm_return"]), code: z.string().max(12).optional(), proofPhotoUrl: z.string().url().max(1000).optional(),cashReceived:z.boolean().optional(),cashAmount:z.number().finite().min(0).max(100000).optional(), note: z.string().max(500).optional() });

export async function POST(request) {
  try {
    const user = await authenticateRequest(request); const body = schema.parse(await request.json()); const transition = DRIVER_PARCEL_TRANSITIONS[body.action]; if (!transition) throw Object.assign(new Error("That Send action is not supported."), { status: 400 });
    const [requiredState, nextState] = transition; const { db, messaging } = getAdminServices(); const ref = db.collection("parcelJobs").doc(body.parcelJobId); let notification = null;let pinError=null;
    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref); if (!snap.exists) throw Object.assign(new Error("The Send request was not found."), { status: 404 }); const parcel = snap.data();
      if (parcel.assignedDriverId !== user.uid) throw Object.assign(new Error("This Send request is not assigned to your Driver account."), { status: 403 });
      if(parcel.safetyReviewHold===true)throw Object.assign(new Error("Send is paused for a safety investigation. Contact Operations."),{status:409});
      if (parcel.state !== requiredState) throw Object.assign(new Error("Refresh the Send job and follow the current next action."), { status: 409 });
      const needsPin=body.action==="verify_pickup"||body.action==="complete"||body.action==="confirm_return";
      const pinKind=body.action==="complete"?"dropoff":"pickup";
      const pinRef=db.collection("parcelPinAttempts").doc(body.parcelJobId+"_"+pinKind);
      const pinSnap=needsPin?await transaction.get(pinRef):null;
      if(needsPin){
       const a=pinSnap?.data()||{};
       if((a.lockUntil?.toMillis?.()||0)>Date.now()){
        pinError="Too many wrong Send codes. Wait 10 minutes or contact support.";return;
       }
       if(!matchesParcelPin(parcel,pinKind,String(body.code||"").trim())){
        const count=(Number(a.count||0)||0)+1;
        transaction.set(pinRef,{count,lockUntil:count>=5?new Date(Date.now()+600000):null,
          lastAttemptAt:FieldValue.serverTimestamp(),driverId:user.uid},{merge:true});
        pinError="Incorrect Send handoff code. Verification attempts are limited.";return;
       }
       transaction.set(pinRef,{count:0,lockUntil:null,verifiedAt:FieldValue.serverTimestamp(),driverId:user.uid},{merge:true});
      }
      if(body.action==="complete"&&parcel.paymentMethod==="cash"&&
        (body.cashReceived!==true||!Number.isFinite(body.cashAmount)||
         Math.round(body.cashAmount*100)!==Math.round(Number(parcel.quote?.total||0)*100)))
        throw Object.assign(new Error("Confirm collection of the exact cash delivery price, or report an incident."),{status:409});
      if(body.proofPhotoUrl){
        const proof=new URL(body.proofPhotoUrl);
        const expected=expectedParcelProofPath(user.uid,body.parcelJobId);
        const encoded=new URLSearchParams(proof.search).get("name")||"";
        const objectPath=decodeURIComponent(proof.pathname.split("/o/")[1]||"");
        const candidate=encoded||objectPath;
        if(proof.protocol!=="https:"||proof.hostname!=="firebasestorage.googleapis.com"||
           !proof.pathname.includes("/v0/b/")||!candidate.startsWith(expected))
          throw Object.assign(new Error("Proof photo must be uploaded to this Driver's scoped Send storage."),{status:409});
      }
      if(body.action==="complete"&&parcel.proofPhotoRequired===true&&!body.proofPhotoUrl&&!parcel.proofPhotoUrl)
        throw Object.assign(new Error("Upload delivery proof before completing this Send request."),{status:409});
      const now = FieldValue.serverTimestamp(); const patch = { state: nextState, updatedAt: now };
      if (body.action === "arrive_pickup") patch.arrivedPickupAt = now;
      if (body.action === "verify_pickup") patch.collectedAt = now;
      if (body.action === "arrive_dropoff") patch.arrivedDropoffAt = now;
      if(body.action==="report_handoff_problem"){
       patch.exceptionCode="recipient_unreachable";patch.exceptionReportedAt=now;
       transaction.set(db.collection("adminQueueItems").doc("send_handoff_"+body.parcelJobId),{
        queue:"parcel-exceptions",type:"handoff_failed",parcelJobId:body.parcelJobId,
        entityId:body.parcelJobId,status:"open",priority:"high",
        title:"Recipient handoff failed · Parcel recovery required",createdAt:now,updatedAt:now},{merge:true});
      }
      if(body.action==="confirm_return"){
        patch.returnedAt=now;patch.exceptionCode="returned_to_sender";
        patch.paymentReviewRequired=true;patch.driverEarningsStatus="on_hold";
        transaction.set(db.collection("drivers").doc(user.uid),{sendFinanceHold:true,sendFinanceHoldAt:now},{merge:true});
        transaction.set(db.collection("sendFinanceReviews").doc(body.parcelJobId),{
          parcelJobId:body.parcelJobId,driverId:user.uid,status:"open",
          issueType:"returned_to_sender",createdAt:now,updatedAt:now},{merge:true});
      }
      if (body.proofPhotoUrl) patch.proofPhotoUrl = safeText(body.proofPhotoUrl, 1000);
      if (body.action === "complete"){
        patch.deliveredAt=now;
        if(parcel.paymentMethod==="cash"){
          patch.paymentStatus="cash_driver_attested";patch.cashAttestedBy=user.uid;
          patch.cashAttestedAt=now;patch.cashReceived=body.cashAmount;
        }else if(parcel.paymentStatus!=="paid")patch.driverEarningsStatus="awaiting_customer_payment";
      }
      transaction.set(ref, patch, { merge: true });
      if (parcel.orderId) { const orderPatch = { sendStatus: nextState, status: nextState === "delivered" ? "completed" : "in_progress", updatedAt: now }; if (nextState === "delivered"){
          orderPatch.completedAt=now;
          if(parcel.paymentMethod==="cash"){orderPatch.paymentStatus="cash_driver_attested";orderPatch.cashAttestedAt=now;}
        } transaction.set(db.collection("orders").doc(parcel.orderId), orderPatch, { merge: true }); }
      appendParcelEvent(transaction, db, { parcelJobId: body.parcelJobId, type: `parcel.${body.action}`, actorType: "driver", actorId: user.uid, previousState: parcel.state, state: nextState, note: safeText(body.note || "", 500), metadata: body.proofPhotoUrl ? { proofPhotoUrl: safeText(body.proofPhotoUrl, 1000) } : {} });
      if(["complete","confirm_return"].includes(body.action)){
        if(body.action==="confirm_return"){
         transaction.set(db.collection("adminQueueItems").doc("send_return_finance_"+body.parcelJobId),{
          queue:"parcel-exceptions",type:"returned_parcel_finance_review",
          parcelJobId:body.parcelJobId,entityId:body.parcelJobId,status:"open",priority:"high",
          title:"Returned Send · Money review needed",createdAt:now,updatedAt:now},{merge:true});
        }
        transaction.set(db.collection("driverPresence").doc(user.uid), { currentJobId: null, currentWorkType: null, availabilityState: "online_current", updatedAt: now }, { merge: true });
        if(body.action==="complete"){
          if(parcel.paymentMethod==="cash")
            await recordCashParcelPlatformFee(transaction,db,{driverId:user.uid,parcelJobId:body.parcelJobId,
              orderId:parcel.orderId||null,platformFee:parcel.quote?.platformFee??0,currency:parcel.currency||"USD"});
          else if(parcel.paymentStatus==="paid"){
            await creditParcelEarnings(transaction,db,{driverId:user.uid,parcelJobId:body.parcelJobId,
              orderId:parcel.orderId||null,amount:parcel.acceptedDriverPay??parcel.quote?.driverPay??0,currency:parcel.currency||"USD"});
            transaction.set(ref,{earningsCreditedAt:now,driverEarningsStatus:"available"},{merge:true});
          }
        }
        transaction.create(db.collection("auditLogs").doc(), { actorId: user.uid, action: "parcel.delivered", entityType: "parcelJob", entityId: body.parcelJobId, metadata: { orderId: parcel.orderId || null }, source: "send_network", createdAt: now });
      }
      notification = { customerId: parcel.customerId, number: parcel.number, action: body.action };
    });
    if(pinError)throw Object.assign(new Error(pinError),{status:409});
    const messages = { start_to_pickup: "Your Driver is on the way to the pickup.", arrive_pickup: "Your Driver has arrived at the pickup point.", verify_pickup: "Your parcel has been collected.", start_delivery: "Your parcel is on the way.", arrive_dropoff: "Your Driver has arrived at the recipient.", complete: "Your parcel was delivered.",report_handoff_problem:"Recipient handoff needs Operations support.",confirm_return:"Your parcel was returned to the sender." };
    if (notification && messages[notification.action]) await notifyUsers(db, messaging, [notification.customerId], { title: notification.number || "Send update", body: messages[notification.action], href: "/send", category: "send", workspace: "customer", module: "send" });
    return Response.json({ ok: true, state: nextState });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the Send action." }, { status: 400 });
    return apiError(error);
  }
}

import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { notifyUsers } from "@/lib/driver-delivery-server";
import { creditRideEarnings, recordCashRidePlatformFee } from "@/lib/driver-money-server";
import { appendRideEvent, DRIVER_RIDE_TRANSITIONS } from "@/lib/ride-server";
import { matchesRidePin } from "@/lib/ride-security";

export const runtime = "nodejs";
const schema = z.object({ rideId: z.string().min(3).max(180), action: z.enum(["start_to_pickup", "arrive_pickup", "begin_pickup_verification", "verify_pickup", "arrive_dropoff", "complete","report_no_show"]), code: z.string().max(12).optional(),cashReceived:z.boolean().optional(),cashAmount:z.number().finite().min(0).max(100000).optional() });

export async function POST(request) {
  try {
    const user = await authenticateRequest(request); const body = schema.parse(await request.json());
    const transition=body.action==="report_no_show"?["driver_arrived_pickup","no_show_review"]:DRIVER_RIDE_TRANSITIONS[body.action]; if (!transition) throw Object.assign(new Error("That ride action is not supported."), { status: 400 });
    const [requiredState, nextState] = transition; const { db, messaging } = getAdminServices(); const ref = db.collection("rideTrips").doc(body.rideId);
    let notification = null; let pinError=null;
    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref); if (!snap.exists) throw Object.assign(new Error("The ride was not found."), { status: 404 });
      const ride = snap.data(); if(ride.safetyReviewHold===true)throw Object.assign(new Error("A serious safety incident has paused this trip. Contact Operations before changing its state."),{status:409});
      if (ride.assignedDriverId !== user.uid) throw Object.assign(new Error("This ride is not assigned to your Driver account."), { status: 403 });
      if (ride.state !== requiredState &&
          !(body.action==="report_no_show"&&ride.state==="pickup_verification"))
        throw Object.assign(new Error("Refresh the ride and follow the current next action."), { status: 409 });
      if(body.action==="report_no_show"){
        const arrived=ride.arrivedPickupAt?.toMillis?.()||0;
        if(!arrived||Date.now()-arrived<5*60*1000)
         throw Object.assign(new Error("Wait at the pickup for five minutes and attempt to contact the rider before reporting a no-show."),{status:409});
        const now=FieldValue.serverTimestamp();
        transaction.set(ref,{state:"no_show_review",exceptionCode:"rider_no_show",
          noShowReportedAt:now,updatedAt:now},{merge:true});
        if(ride.orderId)transaction.set(db.collection("orders").doc(ride.orderId),{
         rideStatus:"no_show_review",status:"exception_review",updatedAt:now},{merge:true});
        transaction.set(db.collection("adminQueueItems").doc("ride_noshow_"+body.rideId),{
          queue:"ride-exceptions",type:"rider_no_show",status:"open",priority:"high",
          entityId:body.rideId,rideId:body.rideId,title:"Rider no-show · Operations decision needed",
          createdAt:now,updatedAt:now},{merge:true});
        transaction.create(db.collection("rideEvents").doc(),{rideId:body.rideId,
          type:"ride.no_show_reported",actorType:"driver",actorId:user.uid,
          state:"no_show_review",createdAt:now});
        notification={customerId:ride.customerId,number:ride.number,action:body.action};
        return;
      }
      const pinRef=db.collection("ridePinAttempts").doc(body.rideId);
      const attempts=body.action==="verify_pickup"?await transaction.get(pinRef):null;
      if(body.action==="verify_pickup"){
        const a=attempts?.data()||{};
        const lockUntil=a.lockUntil?.toMillis?.()||0;
        if(lockUntil>Date.now()){
          pinError="Too many attempts. Wait 10 minutes or contact Spotly Support.";
          return;
        }
        if(!matchesRidePin(ride,String(body.code||"").trim())){
          const count=(Number(a.count||0)||0)+1;
          transaction.set(pinRef,{count,
           lockUntil:count>=5?new Date(Date.now()+600000):null,
           lastAttemptAt:FieldValue.serverTimestamp(),driverId:user.uid},{merge:true});
          pinError="Pickup PIN mismatch. Verify the rider's code; too many incorrect attempts pause verification.";
          return;
        }
        transaction.set(pinRef,{count:0,lockUntil:null,
          verifiedAt:FieldValue.serverTimestamp(),driverId:user.uid},{merge:true});
      }
      if(body.action==="complete"&&ride.paymentMethod==="cash"){
        if(body.cashReceived!==true||!Number.isFinite(body.cashAmount)||
           Math.round(body.cashAmount*100)!==Math.round(Number(ride.quote?.total||0)*100))
          throw Object.assign(new Error("Confirm the exact cash fare was collected or report a payment incident."),{status:409});
      }
      const now = FieldValue.serverTimestamp(); const patch = { state: nextState, updatedAt: now };
      if (body.action === "arrive_pickup") patch.arrivedPickupAt = now;
      if (body.action === "verify_pickup") patch.startedAt = now;
      if (body.action === "arrive_dropoff") patch.arrivedDropoffAt = now;
      if (body.action === "complete") {
        patch.completedAt = now;
        if(ride.paymentMethod==="cash"){patch.paymentStatus="cash_driver_attested";patch.cashReceived=body.cashAmount;patch.cashAttestedAt=now;patch.cashAttestedBy=user.uid;}
        else if(ride.paymentStatus!=="paid")patch.driverEarningsStatus="awaiting_customer_payment";
      }
      transaction.set(ref, patch, { merge: true });
      if (ride.orderId) {
        const orderPatch = { rideStatus: nextState, status: nextState === "completed" ? "completed" : "in_progress", updatedAt: now };
        if (nextState === "completed") {
          orderPatch.completedAt=now;
          if(ride.paymentMethod==="cash"){orderPatch.paymentStatus="cash_driver_attested";orderPatch.cashAttestedAt=now;}
        }
        transaction.set(db.collection("orders").doc(ride.orderId), orderPatch, { merge: true });
      }
      await appendRideEvent(transaction, db, { rideId: body.rideId, type: `ride.${body.action}`, actorType: "driver", actorId: user.uid, previousState: ride.state, state: nextState });
      if (body.action === "complete") {
        transaction.set(db.collection("driverPresence").doc(user.uid), { currentJobId: null, currentWorkType: null, availabilityState: "online_current", updatedAt: now }, { merge: true });
        if (ride.paymentMethod === "cash") {
          await recordCashRidePlatformFee(transaction, db, { driverId: user.uid, rideId: body.rideId,
           orderId: ride.orderId || null, platformFee: ride.quote?.platformFee ?? 0, currency: ride.currency || "USD" });
        }else if(ride.paymentStatus==="paid"){
          await creditRideEarnings(transaction, db, {driverId:user.uid,rideId:body.rideId,
            orderId:ride.orderId||null,amount:ride.acceptedDriverPay??ride.quote?.driverPay??0,currency:ride.currency||"USD"});
          transaction.update(ref,{driverEarningsStatus:"available",earningsCreditedAt:now});
        }
        transaction.create(db.collection("auditLogs").doc(), { actorId: user.uid, action: "ride.completed", entityType: "rideTrip", entityId: body.rideId, metadata: { orderId: ride.orderId || null }, source: "ride_network", createdAt: now });
      }
      notification = { customerId: ride.customerId, number: ride.number, action: body.action };
    });
    if(pinError)throw Object.assign(new Error(pinError),{status:409});
    const messages = { start_to_pickup: "Your Driver is on the way to your pickup.", arrive_pickup: "Your Driver has arrived at the pickup point.", verify_pickup: "Your ride has started.", arrive_dropoff: "You have arrived at your destination.", complete: "Your ride is complete.",report_no_show:"Your Driver reported that they could not find you. Operations will review this request." };
    if (notification && messages[notification.action]) await notifyUsers(db, messaging, [notification.customerId], { title: notification.number || "Ride update", body: messages[notification.action], href: "/ride", category: "ride", workspace: "customer", module: "rides" });
    return Response.json({ ok: true, state: nextState });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the ride action." }, { status: 400 });
    return apiError(error);
  }
}

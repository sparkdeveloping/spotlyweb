import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { dispatchRide, estimateRide, makeRideNumber, makeRidePin, normalizeRidePoint, plainRide, publicRide, rideAvailability } from "@/lib/ride-server";
import { safeText } from "@/lib/server-helpers";
import {validateRideTerritory} from "@/lib/ride-geography";
import {getVerifiedRideRoute} from "@/lib/ride-routing";
import {sealRidePin} from "@/lib/ride-security";

export const runtime = "nodejs";
const point = z.object({ lat: z.number(), lng: z.number(), accuracy: z.number().optional(), country:z.enum(["ZW","MW"]), label: z.string().max(160).optional(), formattedAddress: z.string().max(500).optional(), area: z.string().max(120).optional(), city: z.string().max(120).optional() });
const requestSchema = z.object({ action: z.literal("request"), pickup: point, dropoff: point, serviceType: z.enum(["economy", "comfort", "xl"]).default("economy"), paymentMethod: z.enum(["cash", "paynow"]).default("cash"), quotedTotal:z.number().positive().max(100000), quotedCurrency:z.enum(["USD","ZWG"]), riderName: z.string().max(160).optional(), riderPhone: z.string().max(50).optional(), note: z.string().max(500).optional() });
const cancelSchema = z.object({ action: z.literal("cancel"), rideId: z.string().min(3).max(180), reason: z.string().min(3).max(500) });
const schema = z.discriminatedUnion("action", [requestSchema, cancelSchema]);

async function loadDriverBundle(db, ride) {
  if (!ride.assignedDriverId) return { driver: null, driverLocation: null };
  const [driverSnap, vehicleQuery, presenceSnap] = await Promise.all([
    db.collection("drivers").doc(ride.assignedDriverId).get(),
    db.collection("driverVehicles").where("driverId", "==", ride.assignedDriverId).limit(10).get(),
    db.collection("driverPresence").doc(ride.assignedDriverId).get()
  ]);
  const driver = driverSnap.exists ? { id: driverSnap.id, ...plainRide(driverSnap.data()) } : { id: ride.assignedDriverId };
  const vehicle = vehicleQuery.docs.map((item) => ({ id: item.id, ...plainRide(item.data()) })).find((item) => item.status === "approved") || null;
  driver.vehicle = vehicle ? { type: vehicle.type || "car", make: vehicle.make || "", model: vehicle.model || "", registration: vehicle.registration || "", color: vehicle.color || "" } : null;
  let driverLocation = null;
  if (presenceSnap.exists) {
    const presence = presenceSnap.data(); const updatedAt = presence.locationUpdatedAt?.toDate?.();
    if (presence.currentLocation && updatedAt && Date.now() - updatedAt.getTime() < 180000) driverLocation = { ...presence.currentLocation, updatedAt: updatedAt.toISOString() };
  }
  return { driver, driverLocation };
}

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    await enforceRateLimit(request,{key:"ride_customer_history",limit:30,windowMs:60000,identity:user.uid});
    const { db } = getAdminServices();
    const url = new URL(request.url); const rideId = url.searchParams.get("rideId");
    if (rideId) {
      const snap = await db.collection("rideTrips").doc(rideId).get();
      if (!snap.exists) throw Object.assign(new Error("The ride was not found."), { status: 404 });
      const ride = { id: snap.id, ...snap.data() };
      if (ride.customerId !== user.uid) throw Object.assign(new Error("You cannot view this ride."), { status: 403 });
      const bundle = await loadDriverBundle(db, ride);
      return Response.json({ ok: true, ride: publicRide(ride, { includePin: true, ...bundle }) });
    }
    const query = await db.collection("rideTrips").where("customerId", "==", user.uid).limit(60).get();
    const rides = query.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a,b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    const active = rides.find((item) => !["completed", "cancelled", "failed"].includes(item.state));
    let activePublic = null;
    if (active) activePublic = publicRide(active, { includePin: true, ...(await loadDriverBundle(db, active)) });
    return Response.json({ ok: true, activeRide: activePublic, rides: rides.map((item) => publicRide(item, { includePin: false })) });
  } catch (error) { return apiError(error); }
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    await enforceRateLimit(request, { key: "customer_rides_mutation", limit: 15, windowMs: 10 * 60_000, identity: user.uid });
    const body = schema.parse(await request.json());
    const { db, messaging } = getAdminServices();
    if (body.action === "cancel") {
      const ref = db.collection("rideTrips").doc(body.rideId);
      let assignedDriverId = null; let number = ""; let orderId = null;
      await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref); if (!snap.exists) throw Object.assign(new Error("The ride was not found."), { status: 404 });
        const ride = snap.data(); if (ride.customerId !== user.uid) throw Object.assign(new Error("You cannot cancel this ride."), { status: 403 });
        if (!["requested", "searching_driver", "driver_assigned", "driver_to_pickup", "driver_arrived_pickup", "pickup_verification"].includes(ride.state)) throw Object.assign(new Error("This ride can no longer be cancelled in the app. Contact Spotly Support."), { status: 409 });
        assignedDriverId = ride.assignedDriverId || null; number = ride.number || body.rideId; orderId = ride.orderId || null;
        const presenceRef=assignedDriverId?db.collection("driverPresence").doc(assignedDriverId):null;
        const presence=presenceRef?await transaction.get(presenceRef):null;
        const needsReview=ride.paymentStatus==="paid";
        if(needsReview&&ride.assignedDriverId){
          transaction.set(db.collection("drivers").doc(ride.assignedDriverId),{
            rideFinanceHold:true,rideFinanceHoldAt:FieldValue.serverTimestamp()},{merge:true});
          transaction.set(db.collection("rideFinanceReviews").doc(body.rideId),{
            rideId:body.rideId,driverId:ride.assignedDriverId,status:"open",
            issueType:"customer_cancelled_paid_trip",
            createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()},{merge:true});
        }
        if(needsReview)transaction.set(db.collection("adminQueueItems").doc("ride_payment_refund_"+body.rideId),{
          queue:"ride-exceptions",type:"captured_ride_cancelled",status:"open",priority:"high",
          rideId:body.rideId,entityId:body.rideId,title:"Customer cancelled paid Ride · Finance review",
          createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()
        },{merge:true});
        transaction.set(ref, {paymentReviewRequired:needsReview,state: "cancelled", cancellationReason: safeText(body.reason, 500), cancelledBy: "customer", cancelledAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        if (orderId) transaction.set(db.collection("orders").doc(orderId), {status:needsReview?"payment_exception":"cancelled",paymentReviewRequired:needsReview, rideStatus: "cancelled", cancellationReason: safeText(body.reason, 500), cancelledAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        if(presence?.exists&&presence.data().currentJobId===body.rideId)
          transaction.set(presenceRef,{currentJobId:null,currentWorkType:null,
            availabilityState:"online_current",updatedAt:FieldValue.serverTimestamp()},{merge:true});
        transaction.create(db.collection("rideEvents").doc(), { rideId: body.rideId, type: "ride.cancelled", actorType: "customer", actorId: user.uid, previousState: ride.state, state: "cancelled", note: safeText(body.reason, 500), createdAt: FieldValue.serverTimestamp() });
      });
      const offers = await db.collection("rideOffers").where("rideId", "==", body.rideId).limit(100).get();
      const batch = db.batch(); let has = false; offers.docs.forEach((doc) => { if (["offered", "viewed"].includes(doc.data().state)) { batch.set(doc.ref, { state: "withdrawn", updatedAt: FieldValue.serverTimestamp() }, { merge: true }); has = true; } }); if (has) await batch.commit();
      if (assignedDriverId) await import("@/lib/driver-delivery-server").then(({ notifyUsers }) => notifyUsers(db, messaging, [assignedDriverId], { title: "Ride cancelled", body: `${number} was cancelled by the rider.`, href: "/", category: "ride", workspace: "driver", module: "rides" }));
      return Response.json({ ok: true, rideId: body.rideId, state: "cancelled" });
    }

    const pickup = normalizeRidePoint(body.pickup); const dropoff = normalizeRidePoint(body.dropoff);
    if (!pickup || !dropoff) throw Object.assign(new Error("Set valid pickup and destination locations."), { status: 400 });
    const settingsSnap = await db.collection("platformSettings").doc("global").get(); const settings = settingsSnap.exists ? settingsSnap.data() : {};
    const availability = rideAvailability(settings, pickup); if (!availability.enabled) throw Object.assign(new Error(availability.reason), { status: 409 });
    if (!availability.config.paymentMethods.includes(body.paymentMethod)) throw Object.assign(new Error("Choose an available ride payment method."), { status: 409 });
    const active = await db.collection("rideTrips").where("customerId", "==", user.uid).where("state", "in", ["requested", "searching_driver", "driver_assigned", "driver_to_pickup", "driver_arrived_pickup", "pickup_verification", "no_show_review", "in_trip", "driver_arrived_dropoff"]).limit(1).get();
    if (!active.empty) throw Object.assign(new Error("Finish or cancel your active ride before requesting another one."), { status: 409 });
    validateRideTerritory(pickup,dropoff,settings.mobility||{});
    const route=await getVerifiedRideRoute(pickup,dropoff);
    const quote = estimateRide({ pickup, dropoff, serviceType: body.serviceType, settings,route });
    if(Math.round(Number(body.quotedTotal)*100)!==Math.round(Number(quote.total)*100)||
       body.quotedCurrency!==quote.currency)
      throw Object.assign(new Error("Ride pricing changed; refresh the estimate before accepting the fare."),{status:409});
    const rideRef = db.collection("rideTrips").doc(); const orderRef = db.collection("orders").doc();
    const number = makeRideNumber(); const pickupPinCiphertext=sealRidePin(makeRidePin()); const now = FieldValue.serverTimestamp();
    const riderName = safeText(body.riderName || user.profile?.displayName || user.name || "", 160); const riderPhone = safeText(body.riderPhone || user.profile?.phone || user.phone_number || "", 50);
    await db.runTransaction(async (transaction) => {
      transaction.create(rideRef, { number, customerId: user.uid, orderId: orderRef.id, state: "requested", serviceType: body.serviceType, pickup, dropoff, quote, currency: quote.currency, requiredVehicleTypes: quote.requiredVehicleTypes, paymentMethod: body.paymentMethod, paymentStatus: body.paymentMethod === "cash" ? "cash_due" : "unpaid", pickupPinCiphertext, country:pickup.country,riderName, riderPhone, riderNote: safeText(body.note || "", 500), requestedAt: now, createdAt: now, updatedAt: now });
      transaction.create(orderRef, { number, customerId: user.uid, customerName: riderName, businessName: "Spotly Ride", transactionType: "ride", fulfilment: "ride", rideTripId: rideRef.id, rideStatus: "requested", status: "requested", paymentMethod: body.paymentMethod, paymentStatus: body.paymentMethod === "cash" ? "cash_due" : "unpaid", currency: quote.currency, pickup, dropoff, items: [{ productId: `ride_${body.serviceType}`, name: `${quote.serviceLabel} ride`, quantity: 1, unitPrice: quote.total, lineTotal: quote.total }], totals: { subtotal: quote.total, serviceFee: quote.bookingFee, deliveryFee: 0, discount: 0, total: quote.total }, total: quote.total, createdAt: now, updatedAt: now });
      transaction.create(db.collection("rideEvents").doc(), { rideId: rideRef.id, type: "ride.requested", actorType: "customer", actorId: user.uid, state: "requested", metadata: { serviceType: body.serviceType, quotedFare: quote.total, currency: quote.currency }, createdAt: now });
    });
    const dispatch = await dispatchRide({ db, messaging, rideId: rideRef.id, actorId: user.uid })
      .catch(async error=>{
        await db.collection("adminQueueItems").doc("ride_dispatch_error_"+rideRef.id).set({
          queue:"ride-exceptions",type:"dispatch_execution_failed",status:"open",priority:"high",
          entityId:rideRef.id,rideId:rideRef.id,title:"Ride dispatch needs review",
          detail:String(error?.message||"Unknown dispatch failure").slice(0,350),
          createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()
        },{merge:true}).catch(()=>{});
        return {offered:0,requiresOperations:true};
      });
    return Response.json({ ok: true, rideId: rideRef.id, orderId: orderRef.id, number, state: "searching_driver", quote, dispatch });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the ride request details." }, { status: 400 });
    return apiError(error);
  }
}

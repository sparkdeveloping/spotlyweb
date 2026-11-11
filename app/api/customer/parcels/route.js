import { requireCustomerLaunchAccess } from "@/lib/customer-launch-server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { notifyUsers } from "@/lib/driver-delivery-server";
import { dispatchParcel, estimateParcel, makeParcelNumber, makeParcelPin, normalizeParcelPoint, parcelAvailability, parcelPaymentMethodsForCountry, plainParcel, publicParcel } from "@/lib/parcel-server";
import { safeText } from "@/lib/server-helpers";
import {sealParcelPin} from "@/lib/send-security";
import {validateSendTerritory} from "@/lib/send-territory";
import {getVerifiedRideRoute,assertRoadAccessConsent} from "@/lib/ride-routing";
import { sendCreateRequestSchema } from "@/lib/contracts/schemas";
import { requireServiceLive } from "@/lib/service-availability-server";
import { loadRealtimeDriverLocation } from "@/lib/customer-driver-tracking-server";
import { liveMobilityState, mobilityRequestFingerprint, mobilityRequestReferences, requireMatchingReplay } from "@/lib/mobility-request-integrity";

export const runtime = "nodejs";
const requestSchema = sendCreateRequestSchema;
const cancelSchema = z.object({ action: z.literal("cancel"), parcelJobId: z.string().min(3).max(180), reason: z.string().min(3).max(500) });
const schema = z.discriminatedUnion("action", [requestSchema, cancelSchema]);

async function loadDriverBundle(db, database, parcel) {
  if (!parcel.assignedDriverId) return { driver: null, driverLocation: null };
  const [driverSnap, vehicleQuery, presenceSnap] = await Promise.all([
    db.collection("drivers").doc(parcel.assignedDriverId).get(), db.collection("driverVehicles").where("driverId", "==", parcel.assignedDriverId).limit(10).get(), db.collection("driverPresence").doc(parcel.assignedDriverId).get()
  ]);
  const driver = driverSnap.exists ? { id: driverSnap.id, ...plainParcel(driverSnap.data()) } : { id: parcel.assignedDriverId };
  const vehicle = vehicleQuery.docs.map((item) => ({ id: item.id, ...plainParcel(item.data()) })).find((item) => item.status === "approved") || null;
  driver.vehicle = vehicle ? { type: vehicle.type || "car", make: vehicle.make || "", model: vehicle.model || "", registration: vehicle.registration || "", color: vehicle.color || "" } : null;
  let driverLocation = await loadRealtimeDriverLocation(database, { workId: parcel.id, driverId: parcel.assignedDriverId });
  if (!driverLocation && presenceSnap.exists) { const presence = presenceSnap.data(); const updatedAt = presence.locationUpdatedAt?.toDate?.(); if (presence.currentLocation && updatedAt && Date.now() - updatedAt.getTime() < 180000) driverLocation = { ...presence.currentLocation, updatedAt: updatedAt.toISOString(), source: "firestore_presence" }; }
  return { driver, driverLocation };
}

export async function GET(request) {
  try {
    const user = await authenticateRequest(request); const { db, database } = getAdminServices(); const url = new URL(request.url); const parcelJobId = url.searchParams.get("parcelJobId");
    if (parcelJobId) {
      const snap = await db.collection("parcelJobs").doc(parcelJobId).get(); if (!snap.exists) throw Object.assign(new Error("The Send request was not found."), { status: 404 });
      const parcel = { id: snap.id, ...snap.data() }; if (parcel.customerId !== user.uid) throw Object.assign(new Error("You cannot view this Send request."), { status: 403 });
      return Response.json({ ok: true, parcel: publicParcel(parcel, { includePins: true, ...(await loadDriverBundle(db, database, parcel)) }) });
    }
    const query = await db.collection("parcelJobs").where("customerId", "==", user.uid).limit(60).get();
    const parcels = query.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a,b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    const active = parcels.find((item) => !["delivered", "cancelled", "failed", "returned"].includes(item.state));
    return Response.json({ ok: true, activeParcel: active ? publicParcel(active, { includePins: true, ...(await loadDriverBundle(db, database, active)) }) : null, parcels: parcels.map((item) => publicParcel(item)) });
  } catch (error) { return apiError(error); }
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    await requireCustomerLaunchAccess(user, getAdminServices().db); await enforceRateLimit(request, { key: "customer_parcels_mutation", limit: 15, windowMs: 10 * 60_000, identity: user.uid });
    const body = schema.parse(await request.json()); const { db, messaging } = getAdminServices();
    if (body.action === "cancel") {
      const ref = db.collection("parcelJobs").doc(body.parcelJobId); let assignedDriverId = null; let number = ""; let orderId = null; let paymentStatus = "";
      await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref); if (!snap.exists) throw Object.assign(new Error("The Send request was not found."), { status: 404 });
        const parcel = snap.data(); if (parcel.customerId !== user.uid) throw Object.assign(new Error("You cannot cancel this Send request."), { status: 403 });
        if (!["requested", "scheduled", "awaiting_payment", "searching_driver", "driver_assigned", "driver_to_pickup", "driver_arrived_pickup", "pickup_verification"].includes(parcel.state)) throw Object.assign(new Error("This Send request can no longer be cancelled in the app. Contact Spotly Support."), { status: 409 });
        if (["refund_pending", "refunded"].includes(parcel.paymentStatus)) throw Object.assign(new Error("This Send cancellation is already in the refund workflow."), { status: 409 });
        assignedDriverId = parcel.assignedDriverId || null; number = parcel.number || body.parcelJobId; orderId = parcel.orderId || null; paymentStatus = parcel.paymentStatus || "";
        const presenceRef=assignedDriverId?db.collection("driverPresence").doc(assignedDriverId):null;
        const orderRef=orderId?db.collection("orders").doc(orderId):null;
        const [driverPresence,orderSnap]=await Promise.all([presenceRef?transaction.get(presenceRef):Promise.resolve(null),orderRef?transaction.get(orderRef):Promise.resolve(null)]);
        const order=orderSnap?.exists?orderSnap.data():{};
        const paid=parcel.paymentStatus==="paid"||order.paymentStatus==="paid";
        const refundRef=paid?db.collection("refundRequests").doc(`customer_cancel_send_${body.parcelJobId}`):null;
        const intentRef=paid&&order.paymentIntentReference?db.collection("paymentIntents").doc(order.paymentIntentReference):null;
        const [refundSnap]=paid?await Promise.all([transaction.get(refundRef),intentRef?transaction.get(intentRef):Promise.resolve(null)]):[null];
        const now = FieldValue.serverTimestamp(); const cancellationReason=safeText(body.reason,500);
        if(paid&&!refundSnap?.exists)transaction.create(refundRef,{orderId,parcelJobId:body.parcelJobId,paymentIntentReference:order.paymentIntentReference||null,amount:Number(parcel.quote?.total||order.total||0),currency:parcel.currency||order.currency||"USD",reason:cancellationReason,status:"refund_requested",requestedBy:user.uid,requestedByType:"customer",requestedAt:now,createdAt:now,updatedAt:now});
        if(intentRef)transaction.set(intentRef,{status:"refund_pending",refundRequestId:refundRef.id,updatedAt:now},{merge:true});
        paymentStatus=paid?"refund_pending":parcel.paymentStatus||"unpaid";
        transaction.set(ref, { state: "cancelled", paymentStatus, ...(paid?{refundRequestId:refundRef.id}:{}), cancellationReason, cancelledBy: "customer", cancelledAt: now, updatedAt: now }, { merge: true });
        if (orderRef) transaction.set(orderRef, { status: "cancelled", sendStatus: "cancelled", paymentStatus:paid?"refund_pending":order.paymentStatus||parcel.paymentStatus||"unpaid", ...(paid?{refundRequestId:refundRef.id}:{}), cancellationReason, cancelledAt: now, updatedAt: now }, { merge: true });
        if(assignedDriverId){
          // Read the presence record before all transaction writes.
          if(driverPresence?.exists&&driverPresence.data().currentJobId===body.parcelJobId)
            transaction.update(presenceRef,{currentJobId:null,currentWorkType:null,
              availabilityState:"online_current",updatedAt:now});
        }
        transaction.create(db.collection("parcelEvents").doc(), { parcelJobId: body.parcelJobId, type: "parcel.cancelled", actorType: "customer", actorId: user.uid, previousState: parcel.state, state: "cancelled", note: safeText(body.reason, 500), createdAt: now });
      });
      const offers = await db.collection("parcelOffers").where("parcelJobId", "==", body.parcelJobId).limit(100).get(); const batch = db.batch(); let has = false;
      offers.docs.forEach((doc) => { if (["offered", "viewed"].includes(doc.data().state)) { batch.set(doc.ref, { state: "withdrawn", updatedAt: FieldValue.serverTimestamp() }, { merge: true }); has = true; } }); if (has) await batch.commit();
      if (assignedDriverId) await notifyUsers(db, messaging, [assignedDriverId], { title: "Send cancelled", body: `${number} was cancelled by the sender.`, href: "/", category: "send", workspace: "driver", module: "send" });
      return Response.json({ ok: true, parcelJobId: body.parcelJobId, state: "cancelled", paymentStatus });
    }

    const {requestRef,activeRef}=mobilityRequestReferences(db,user.uid,"send",body.idempotencyKey);
    const fingerprint=mobilityRequestFingerprint(body);
    if(requestRef){
      const replay=requireMatchingReplay(await requestRef.get(),fingerprint);
      if(replay)return Response.json({ok:true,...replay,reused:true});
    }
    const pickup = normalizeParcelPoint(body.pickup); const dropoff = normalizeParcelPoint(body.dropoff); if (!pickup || !dropoff) throw Object.assign(new Error("Set valid pickup and drop-off locations."), { status: 400 });
    const settingsSnap = await db.collection("platformSettings").doc("global").get(); const settings = settingsSnap.exists ? settingsSnap.data() : {};
    requireServiceLive(settings, { service: "send", country: pickup.country, city: pickup.city });
    const availability = parcelAvailability(settings, pickup);
    if (!availability.enabled) throw Object.assign(new Error(availability.reason), { status: 409 });
    validateSendTerritory(pickup,dropoff,availability.config);
    if (!parcelPaymentMethodsForCountry(settings, pickup.country).includes(body.paymentMethod)) throw Object.assign(new Error("Choose an available Send payment method for this country."), { status: 409 });
    const active = await db.collection("parcelJobs").where("customerId", "==", user.uid).where("state", "in", ["requested", "scheduled", "awaiting_payment", "searching_driver", "driver_assigned", "driver_to_pickup", "driver_arrived_pickup", "pickup_verification", "collected", "en_route", "driver_arrived_dropoff", "handoff_verification","handoff_exception","return_in_progress"]).limit(1).get();
    if (!active.empty) throw Object.assign(new Error("Finish or cancel your active Send request before creating another one."), { status: 409 });
    const roadRoute=await getVerifiedRideRoute(pickup,dropoff);
    const roadAccessConsentVerified=assertRoadAccessConsent(roadRoute,body.roadAccessConsent);
    const quote = estimateParcel({ pickup, dropoff, parcelSize: body.parcelSize, settings,route:roadRoute });
    if(Math.round(quote.total*100)!==Math.round(body.quotedTotal*100)||quote.currency!==body.quotedCurrency)throw Object.assign(new Error("Send price changed; refresh the quote before booking."),{status:409}); if (body.estimatedWeightKg && Number(body.estimatedWeightKg) > Number(quote.maxKg || 100)) throw Object.assign(new Error(`This ${quote.parcelSizeLabel.toLowerCase()} parcel size supports up to ${quote.maxKg} kg. Choose a larger size.`), { status: 400 }); const parcelRef = db.collection("parcelJobs").doc(); const orderRef = db.collection("orders").doc();
    let scheduledPickupAt = null;
    if (body.pickupMode === "scheduled") {
      if (availability.config.scheduledEnabled === false) throw Object.assign(new Error("Scheduled Send requests are not enabled yet."), { status: 409 });
      const scheduledMs = Date.parse(body.scheduledPickupAt || "");
      if (!Number.isFinite(scheduledMs) || scheduledMs < Date.now() + 20 * 60_000) throw Object.assign(new Error("Schedule pickup at least 20 minutes from now."), { status: 400 });
      if (scheduledMs > Date.now() + 7 * 24 * 60 * 60_000) throw Object.assign(new Error("Scheduled Send pickup can be booked up to 7 days ahead."), { status: 400 });
      scheduledPickupAt = Timestamp.fromMillis(scheduledMs);
    }
    const number = makeParcelNumber(); const pickupPin = makeParcelPin(); const dropoffPin = makeParcelPin();
    const pickupPinCiphertext=sealParcelPin(pickupPin),dropoffPinCiphertext=sealParcelPin(dropoffPin); const now = FieldValue.serverTimestamp(); const state = body.paymentMethod === "paynow" ? "awaiting_payment" : scheduledPickupAt ? "scheduled" : "requested";
    const senderName = safeText(body.senderName, 160); const senderPhone = safeText(body.senderPhone, 50); const recipientName = safeText(body.recipientName, 160); const recipientPhone = safeText(body.recipientPhone, 50);
    const transactionResult=await db.runTransaction(async (transaction) => {
      const replaySnap=requestRef?await transaction.get(requestRef):null;
      const replay=requireMatchingReplay(replaySnap,fingerprint);
      if(replay)return {reused:true,response:replay};
      const lockSnap=await transaction.get(activeRef);
      if(lockSnap.exists&&lockSnap.data().entityId){
        const previous=await transaction.get(db.collection("parcelJobs").doc(lockSnap.data().entityId));
        if(previous.exists&&liveMobilityState(previous.data().state,"send"))
          throw Object.assign(new Error("Finish or cancel your active Send request before creating another one."),{status:409});
      }
      // Handoff PINs remain sealed inside the parcel; never return them from creation.
      const response={parcelJobId:parcelRef.id,orderId:orderRef.id,number,state,
        paymentRequired:body.paymentMethod==="paynow"};
      transaction.set(activeRef,{entityId:parcelRef.id,updatedAt:now});
      if(requestRef)transaction.create(requestRef,{fingerprint,response,createdAt:now,
        expiresAt:Timestamp.fromMillis(Date.now()+30*24*60*60_000)});
      transaction.create(parcelRef, { number, customerId: user.uid, orderId: orderRef.id, state, roadAccessConsentVerified, pickup, dropoff, parcelSize: body.parcelSize, parcelDescription: safeText(body.parcelDescription, 500), estimatedWeightKg: Number(body.estimatedWeightKg || 0) || null, declaredValue: Number(body.declaredValue || 0), instructions: safeText(body.instructions || "", 500), senderName, senderPhone, recipientName, recipientPhone, quote, currency: quote.currency, requiredVehicleTypes: quote.requiredVehicleTypes, proofPhotoRequired: quote.proofPhotoRequired === true, paymentMethod: body.paymentMethod, paymentStatus: body.paymentMethod === "cash" ? "cash_due" : "unpaid", pickupMode: scheduledPickupAt ? "scheduled" : "now", scheduledPickupAt, pickupPinCiphertext, dropoffPinCiphertext, country:pickup.country, requestedAt: now, createdAt: now, updatedAt: now });
      transaction.create(orderRef, { number, customerId: user.uid, customerName: senderName, businessName: "Spotly Send", transactionType: "send", fulfilment: "send", parcelJobId: parcelRef.id, sendStatus: state, status: body.paymentMethod === "paynow" ? "awaiting_payment" : scheduledPickupAt ? "accepted" : "requested", paymentMethod: body.paymentMethod, paymentStatus: body.paymentMethod === "cash" ? "cash_due" : "unpaid", pickupMode: scheduledPickupAt ? "scheduled" : "now", scheduledPickupAt, currency: quote.currency, pickup, dropoff, items: [{ productId: `send_${body.parcelSize}`, name: `${quote.parcelSizeLabel} parcel delivery`, variant: body.estimatedWeightKg ? `${Number(body.estimatedWeightKg)} kg` : "", quantity: 1, unitPrice: quote.total, lineTotal: quote.total }], totals: { subtotal: quote.total, serviceFee: quote.bookingFee, deliveryFee: 0, discount: 0, total: quote.total }, total: quote.total, createdAt: now, updatedAt: now });
      transaction.create(db.collection("parcelEvents").doc(), { parcelJobId: parcelRef.id, type: "parcel.requested", actorType: "customer", actorId: user.uid, previousState: null, state, metadata: { orderId: orderRef.id, paymentMethod: body.paymentMethod }, createdAt: now });
      return {reused:false,response};
    });
    if(transactionResult.reused)return Response.json({ok:true,...transactionResult.response,reused:true});
    if (body.paymentMethod === "cash" && !scheduledPickupAt)
      await dispatchParcel({ db, messaging, parcelJobId: parcelRef.id, actorId: user.uid })
       .catch(async err=>{await db.collection("adminQueueItems").doc("send_dispatch_failed_"+parcelRef.id).set({
         queue:"parcel-exceptions",type:"dispatch_execution_failed",entityId:parcelRef.id,parcelJobId:parcelRef.id,
         priority:"high",status:"open",title:"Send dispatch requires attention",
         detail:String(err?.message||"Unknown failure").slice(0,300),createdAt:FieldValue.serverTimestamp()
       },{merge:true}).catch(()=>{});});
    return Response.json({ ok: true, ...transactionResult.response });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the Send request details." }, { status: 400 });
    return apiError(error);
  }
}

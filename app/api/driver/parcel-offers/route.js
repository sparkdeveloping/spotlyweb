import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { notifyUsers } from "@/lib/driver-delivery-server";
import { appendParcelEvent, dispatchParcel } from "@/lib/parcel-server";

export const runtime = "nodejs";
const schema = z.object({ offerId: z.string().min(3).max(180), action: z.enum(["view", "accept", "decline"]) });

export async function POST(request) {
  try {
    const user = await authenticateRequest(request); const body = schema.parse(await request.json()); const { db, messaging } = getAdminServices(); const offerRef = db.collection("parcelOffers").doc(body.offerId);
    let parcelJobId = ""; let notification = null;
    await db.runTransaction(async (transaction) => {
      const offerSnap = await transaction.get(offerRef); if (!offerSnap.exists) throw Object.assign(new Error("This Send offer is no longer available."), { status: 404 });
      const offer = offerSnap.data(); if (offer.driverId !== user.uid) throw Object.assign(new Error("This offer is not assigned to your Driver account."), { status: 403 });
      if (offer.expiresAt?.toMillis?.() && offer.expiresAt.toMillis() <= Date.now()) { transaction.set(offerRef, { state: "expired", updatedAt: FieldValue.serverTimestamp() }, { merge: true }); throw Object.assign(new Error("This Send offer expired."), { status: 409 }); }
      parcelJobId = offer.parcelJobId; const parcelRef = db.collection("parcelJobs").doc(parcelJobId); const parcelSnap = await transaction.get(parcelRef); if (!parcelSnap.exists) throw Object.assign(new Error("The Send request is no longer available."), { status: 404 }); const parcel = parcelSnap.data();
      if (body.action === "view") { if (offer.state === "offered") transaction.set(offerRef, { state: "viewed", viewedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true }); return; }
      if (!["offered", "viewed"].includes(offer.state)) throw Object.assign(new Error("This Send offer is no longer available."), { status: 409 });
      if (body.action === "decline") { transaction.set(offerRef, { state: "declined", declinedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true }); appendParcelEvent(transaction, db, { parcelJobId, type: "offer.declined", actorType: "driver", actorId: user.uid, state: parcel.state }); return; }
      if (parcel.state !== "searching_driver" || parcel.assignedDriverId) throw Object.assign(new Error("Another Driver already accepted this Send request."), { status: 409 });
      const presenceRef = db.collection("driverPresence").doc(user.uid); const driverRef = db.collection("drivers").doc(user.uid); const [presenceSnap, driverSnap] = await Promise.all([transaction.get(presenceRef), transaction.get(driverRef)]); const presence = presenceSnap.exists ? presenceSnap.data() : null; const driver = driverSnap.exists ? driverSnap.data() : null;
      if (!driver || !["approved", "ready", "active"].includes(driver.status) || driver.complianceHold || driver.safetyHold || driver.suspendedAt) throw Object.assign(new Error("Your Driver account is not currently eligible to accept Send work."), { status: 409 });
      if (!presence?.online || presence.currentJobId) throw Object.assign(new Error("You must be online and free to accept this Send request."), { status: 409 });
      const now = FieldValue.serverTimestamp(); transaction.set(offerRef, { state: "accepted", acceptedAt: now, updatedAt: now }, { merge: true });
      transaction.set(parcelRef, { state: "driver_assigned", assignedDriverId: user.uid, assignedVehicleId: offer.vehicleId || null, assignedAt: now, acceptedDriverPay: Number(offer.pay ?? parcel.quote?.driverPay ?? 0), updatedAt: now }, { merge: true });
      if (parcel.orderId) transaction.set(db.collection("orders").doc(parcel.orderId), { assignedDriverId: user.uid, sendStatus: "driver_assigned", status: "accepted", updatedAt: now }, { merge: true });
      transaction.set(presenceRef, { currentJobId: parcelJobId, currentWorkType: "send", availabilityState: "on_send", updatedAt: now }, { merge: true });
      appendParcelEvent(transaction, db, { parcelJobId, type: "offer.accepted", actorType: "driver", actorId: user.uid, previousState: parcel.state, state: "driver_assigned", metadata: { offerId: body.offerId, pay: Number(offer.pay ?? parcel.quote?.driverPay ?? 0) } });
      transaction.create(db.collection("auditLogs").doc(), { actorId: user.uid, action: "parcel.offer.accepted", entityType: "parcelJob", entityId: parcelJobId, metadata: { offerId: body.offerId }, source: "send_network", createdAt: now });
      notification = { customerId: parcel.customerId, number: parcel.number };
    });
    if (body.action === "accept" && notification) {
      const siblings = await db.collection("parcelOffers").where("parcelJobId", "==", parcelJobId).limit(100).get(); const batch = db.batch(); let changed = false;
      siblings.docs.forEach((item) => { if (item.id !== body.offerId && ["offered", "viewed"].includes(item.data().state)) { batch.set(item.ref, { state: "withdrawn", updatedAt: FieldValue.serverTimestamp() }, { merge: true }); changed = true; } }); if (changed) await batch.commit();
      await notifyUsers(db, messaging, [notification.customerId], { title: "Courier assigned", body: `A Driver has been assigned to ${notification.number || "your Send request"}.`, href: "/send", category: "send", workspace: "customer", module: "send" });
    }
    if (body.action === "decline" && parcelJobId) await dispatchParcel({ db, messaging, parcelJobId, actorId: user.uid });
    return Response.json({ ok: true, action: body.action, parcelJobId: parcelJobId || null });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the Send offer action." }, { status: 400 });
    return apiError(error);
  }
}

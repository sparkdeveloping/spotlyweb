import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { appendAudit, appendDeliveryEvent, deliveryTransitionAllowed, dispatchDelivery, notifyUsers } from "@/lib/driver-delivery-server";

export const runtime = "nodejs";
const schema = z.object({ offerId: z.string().min(3).max(180), action: z.enum(["view", "accept", "decline"]) });

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const body = schema.parse(await request.json());
    const { db, messaging } = getAdminServices();
    const offerRef = db.collection("deliveryOffers").doc(body.offerId);
    let jobId = "";
    let notification = null;
    await db.runTransaction(async (transaction) => {
      const offerSnap = await transaction.get(offerRef);
      if (!offerSnap.exists) throw Object.assign(new Error("This delivery offer is no longer available."), { status: 404 });
      const offer = offerSnap.data();
      if (offer.driverId !== user.uid) throw Object.assign(new Error("This offer is not assigned to your Driver account."), { status: 403 });
      if (offer.expiresAt?.toMillis?.() && offer.expiresAt.toMillis() <= Date.now()) {
        transaction.set(offerRef, { state: "expired", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        throw Object.assign(new Error("This delivery offer expired."), { status: 409 });
      }
      jobId = offer.deliveryJobId;
      const jobRef = db.collection("deliveryJobs").doc(jobId);
      const jobSnap = await transaction.get(jobRef);
      if (!jobSnap.exists) throw Object.assign(new Error("The delivery is no longer available."), { status: 404 });
      const job = jobSnap.data();
      if (body.action === "view") {
        if (offer.state === "offered") transaction.set(offerRef, { state: "viewed", viewedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        return;
      }
      if (!["offered", "viewed"].includes(offer.state)) throw Object.assign(new Error("This delivery offer is no longer available."), { status: 409 });
      if (body.action === "decline") {
        transaction.set(offerRef, { state: "declined", declinedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        await appendDeliveryEvent(transaction, db, { jobId, orderId: job.orderId, type: "offer.declined", actorType: "driver", actorId: user.uid, state: job.state });
        return;
      }
      if (!["searching_driver", "awaiting_dispatch"].includes(job.state) || job.assignedDriverId) throw Object.assign(new Error("Another Driver already accepted this delivery."), { status: 409 });
      if (!deliveryTransitionAllowed(job.state, "driver_assigned") && job.state !== "awaiting_dispatch") throw Object.assign(new Error("This delivery can no longer be assigned."), { status: 409 });
      const presenceRef = db.collection("driverPresence").doc(user.uid);
      const driverRef = db.collection("drivers").doc(user.uid);
      const [presenceSnap, driverSnap] = await Promise.all([transaction.get(presenceRef), transaction.get(driverRef)]);
      const currentDriver = driverSnap.exists ? driverSnap.data() : null;
      if (!currentDriver || !["approved", "ready", "active"].includes(currentDriver.status) || currentDriver.complianceHold || currentDriver.safetyHold || currentDriver.suspendedAt) throw Object.assign(new Error("Your Driver account is not currently eligible to accept deliveries."), { status: 409 });
      if (!presenceSnap.exists || presenceSnap.data().online !== true || presenceSnap.data().currentJobId) throw Object.assign(new Error("You must be online and free to accept this delivery."), { status: 409 });
      transaction.set(offerRef, { state: "accepted", acceptedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      transaction.set(jobRef, { state: "driver_assigned", assignedDriverId: user.uid, assignedAt: FieldValue.serverTimestamp(), acceptedDriverPay: Number(offer.pay ?? job.quotedDriverPay ?? 0), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      transaction.set(presenceRef, { currentJobId: jobId, availabilityState: "on_delivery", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      await appendDeliveryEvent(transaction, db, { jobId, orderId: job.orderId, type: "offer.accepted", actorType: "driver", actorId: user.uid, previousState: job.state, state: "driver_assigned", metadata: { offerId: body.offerId, pay: Number(offer.pay ?? job.quotedDriverPay ?? 0) } });
      await appendAudit(transaction, db, { actorId: user.uid, action: "delivery.offer.accepted", entityType: "deliveryJob", entityId: jobId, metadata: { offerId: body.offerId } });
      notification = { businessId: job.businessId, customerId: job.customerId, number: job.number };
    });
    if (body.action === "accept" && notification) {
      const siblingOffers = await db.collection("deliveryOffers").where("deliveryJobId", "==", jobId).limit(100).get();
      const batch = db.batch();
      let changed = false;
      siblingOffers.docs.forEach((item) => {
        if (item.id !== body.offerId && ["offered", "viewed"].includes(item.data().state)) { batch.set(item.ref, { state: "withdrawn", withdrawnAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true }); changed = true; }
      });
      if (changed) await batch.commit();
      await notifyUsers(db, messaging, [notification.customerId], { title: "Driver assigned", body: `A Driver has been assigned to ${notification.number || "your delivery"}.`, href: "/marketplace?view=orders", category: "delivery" });
    }
    if (body.action === "decline" && jobId) await dispatchDelivery({ db, messaging, deliveryJobId: jobId, actorId: user.uid });
    return Response.json({ ok: true, action: body.action, deliveryJobId: jobId || null });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the delivery offer action." }, { status: 400 });
    return apiError(error);
  }
}

import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { notifyUsers } from "@/lib/driver-delivery-server";
import { creditParcelEarnings, recordCashParcelPlatformFee } from "@/lib/driver-money-server";
import { appendParcelEvent, DRIVER_PARCEL_TRANSITIONS } from "@/lib/parcel-server";
import { safeText } from "@/lib/server-helpers";

export const runtime = "nodejs";
const schema = z.object({ parcelJobId: z.string().min(3).max(180), action: z.enum(["start_to_pickup", "arrive_pickup", "begin_pickup_verification", "verify_pickup", "start_delivery", "arrive_dropoff", "begin_handoff", "complete"]), code: z.string().max(12).optional(), proofPhotoUrl: z.string().url().max(1000).optional(), note: z.string().max(500).optional() });

export async function POST(request) {
  try {
    const user = await authenticateRequest(request); const body = schema.parse(await request.json()); const transition = DRIVER_PARCEL_TRANSITIONS[body.action]; if (!transition) throw Object.assign(new Error("That Send action is not supported."), { status: 400 });
    const [requiredState, nextState] = transition; const { db, messaging } = getAdminServices(); const ref = db.collection("parcelJobs").doc(body.parcelJobId); let notification = null;
    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref); if (!snap.exists) throw Object.assign(new Error("The Send request was not found."), { status: 404 }); const parcel = snap.data();
      if (parcel.assignedDriverId !== user.uid) throw Object.assign(new Error("This Send request is not assigned to your Driver account."), { status: 403 });
      if (parcel.state !== requiredState) throw Object.assign(new Error("Refresh the Send job and follow the current next action."), { status: 409 });
      if (body.action === "verify_pickup" && String(body.code || "").trim() !== String(parcel.pickupPin || "")) throw Object.assign(new Error("The pickup PIN is not correct. Ask the sender for the 4-digit PIN again."), { status: 409 });
      if (body.action === "complete" && String(body.code || "").trim() !== String(parcel.dropoffPin || "")) throw Object.assign(new Error("The delivery PIN is not correct. Ask the recipient for the 4-digit PIN again."), { status: 409 });
      if (body.action === "complete" && parcel.proofPhotoRequired === true && !body.proofPhotoUrl && !parcel.proofPhotoUrl) throw Object.assign(new Error("Add a proof-of-delivery photo before completing this Send request."), { status: 409 });
      const now = FieldValue.serverTimestamp(); const patch = { state: nextState, updatedAt: now };
      if (body.action === "arrive_pickup") patch.arrivedPickupAt = now;
      if (body.action === "verify_pickup") patch.collectedAt = now;
      if (body.action === "arrive_dropoff") patch.arrivedDropoffAt = now;
      if (body.proofPhotoUrl) patch.proofPhotoUrl = safeText(body.proofPhotoUrl, 1000);
      if (body.action === "complete") { patch.deliveredAt = now; if (parcel.paymentMethod === "cash") patch.paymentStatus = "paid"; }
      transaction.set(ref, patch, { merge: true });
      if (parcel.orderId) { const orderPatch = { sendStatus: nextState, status: nextState === "delivered" ? "completed" : "in_progress", updatedAt: now }; if (nextState === "delivered") { orderPatch.completedAt = now; if (parcel.paymentMethod === "cash") orderPatch.paymentStatus = "paid"; } transaction.set(db.collection("orders").doc(parcel.orderId), orderPatch, { merge: true }); }
      appendParcelEvent(transaction, db, { parcelJobId: body.parcelJobId, type: `parcel.${body.action}`, actorType: "driver", actorId: user.uid, previousState: parcel.state, state: nextState, note: safeText(body.note || "", 500), metadata: body.proofPhotoUrl ? { proofPhotoUrl: safeText(body.proofPhotoUrl, 1000) } : {} });
      if (body.action === "complete") {
        transaction.set(db.collection("driverPresence").doc(user.uid), { currentJobId: null, currentWorkType: null, availabilityState: "online_current", updatedAt: now }, { merge: true });
        if (parcel.paymentMethod === "cash") await recordCashParcelPlatformFee(transaction, db, { driverId: user.uid, parcelJobId: body.parcelJobId, orderId: parcel.orderId || null, platformFee: parcel.quote?.platformFee ?? 0, currency: parcel.currency || "USD" });
        else await creditParcelEarnings(transaction, db, { driverId: user.uid, parcelJobId: body.parcelJobId, orderId: parcel.orderId || null, amount: parcel.acceptedDriverPay ?? parcel.quote?.driverPay ?? 0, currency: parcel.currency || "USD" });
        transaction.create(db.collection("auditLogs").doc(), { actorId: user.uid, action: "parcel.delivered", entityType: "parcelJob", entityId: body.parcelJobId, metadata: { orderId: parcel.orderId || null }, source: "send_network", createdAt: now });
      }
      notification = { customerId: parcel.customerId, number: parcel.number, action: body.action };
    });
    const messages = { start_to_pickup: "Your Driver is on the way to the pickup.", arrive_pickup: "Your Driver has arrived at the pickup point.", verify_pickup: "Your parcel has been collected.", start_delivery: "Your parcel is on the way.", arrive_dropoff: "Your Driver has arrived at the recipient.", complete: "Your parcel was delivered." };
    if (notification && messages[notification.action]) await notifyUsers(db, messaging, [notification.customerId], { title: notification.number || "Send update", body: messages[notification.action], href: "/send", category: "send", workspace: "customer", module: "send" });
    return Response.json({ ok: true, state: nextState });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the Send action." }, { status: 400 });
    return apiError(error);
  }
}

import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { notifyUsers } from "@/lib/driver-delivery-server";
import { creditRideEarnings, recordCashRidePlatformFee } from "@/lib/driver-money-server";
import { appendRideEvent, DRIVER_RIDE_TRANSITIONS } from "@/lib/ride-server";

export const runtime = "nodejs";
const schema = z.object({ rideId: z.string().min(3).max(180), action: z.enum(["start_to_pickup", "arrive_pickup", "begin_pickup_verification", "verify_pickup", "arrive_dropoff", "complete"]), code: z.string().max(12).optional() });

export async function POST(request) {
  try {
    const user = await authenticateRequest(request); const body = schema.parse(await request.json());
    const transition = DRIVER_RIDE_TRANSITIONS[body.action]; if (!transition) throw Object.assign(new Error("That ride action is not supported."), { status: 400 });
    const [requiredState, nextState] = transition; const { db, messaging } = getAdminServices(); const ref = db.collection("rideTrips").doc(body.rideId);
    let notification = null;
    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref); if (!snap.exists) throw Object.assign(new Error("The ride was not found."), { status: 404 });
      const ride = snap.data(); if (ride.assignedDriverId !== user.uid) throw Object.assign(new Error("This ride is not assigned to your Driver account."), { status: 403 });
      if (ride.state !== requiredState) throw Object.assign(new Error("Refresh the ride and follow the current next action."), { status: 409 });
      if (body.action === "verify_pickup" && String(body.code || "").trim() !== String(ride.pickupPin || "")) throw Object.assign(new Error("The pickup PIN is not correct. Ask the rider for the 4-digit PIN again."), { status: 409 });
      const now = FieldValue.serverTimestamp(); const patch = { state: nextState, updatedAt: now };
      if (body.action === "arrive_pickup") patch.arrivedPickupAt = now;
      if (body.action === "verify_pickup") patch.startedAt = now;
      if (body.action === "arrive_dropoff") patch.arrivedDropoffAt = now;
      if (body.action === "complete") { patch.completedAt = now; if (ride.paymentMethod === "cash") patch.paymentStatus = "paid"; }
      transaction.set(ref, patch, { merge: true });
      if (ride.orderId) {
        const orderPatch = { rideStatus: nextState, status: nextState === "completed" ? "completed" : "in_progress", updatedAt: now };
        if (nextState === "completed") { orderPatch.completedAt = now; if (ride.paymentMethod === "cash") orderPatch.paymentStatus = "paid"; }
        transaction.set(db.collection("orders").doc(ride.orderId), orderPatch, { merge: true });
      }
      await appendRideEvent(transaction, db, { rideId: body.rideId, type: `ride.${body.action}`, actorType: "driver", actorId: user.uid, previousState: ride.state, state: nextState });
      if (body.action === "complete") {
        transaction.set(db.collection("driverPresence").doc(user.uid), { currentJobId: null, currentWorkType: null, availabilityState: "online_current", updatedAt: now }, { merge: true });
        if (ride.paymentMethod === "cash") await recordCashRidePlatformFee(transaction, db, { driverId: user.uid, rideId: body.rideId, orderId: ride.orderId || null, platformFee: ride.quote?.platformFee ?? 0, currency: ride.currency || "USD" });
        else await creditRideEarnings(transaction, db, { driverId: user.uid, rideId: body.rideId, orderId: ride.orderId || null, amount: ride.acceptedDriverPay ?? ride.quote?.driverPay ?? 0, currency: ride.currency || "USD" });
        transaction.create(db.collection("auditLogs").doc(), { actorId: user.uid, action: "ride.completed", entityType: "rideTrip", entityId: body.rideId, metadata: { orderId: ride.orderId || null }, source: "ride_network", createdAt: now });
      }
      notification = { customerId: ride.customerId, number: ride.number, action: body.action };
    });
    const messages = { start_to_pickup: "Your Driver is on the way to your pickup.", arrive_pickup: "Your Driver has arrived at the pickup point.", verify_pickup: "Your ride has started.", arrive_dropoff: "You have arrived at your destination.", complete: "Your ride is complete." };
    if (notification && messages[notification.action]) await notifyUsers(db, messaging, [notification.customerId], { title: notification.number || "Ride update", body: messages[notification.action], href: "/ride", category: "ride", workspace: "customer", module: "rides" });
    return Response.json({ ok: true, state: nextState });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the ride action." }, { status: 400 });
    return apiError(error);
  }
}

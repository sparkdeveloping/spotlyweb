import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { appendAudit, appendDeliveryEvent, driverMayTransition, makeCode, notifyUsers } from "@/lib/driver-delivery-server";
import { creditDeliveryEarnings } from "@/lib/driver-money-server";
import { safeText } from "@/lib/server-helpers";

export const runtime = "nodejs";
const schema = z.object({
  deliveryJobId: z.string().min(3).max(180),
  action: z.enum(["start_to_pickup", "arrive_pickup", "begin_pickup_verification", "verify_pickup", "start_delivery", "arrive_customer", "begin_handoff", "complete"]),
  code: z.string().max(12).optional()
});

const ACTION_TO_STATE = {
  start_to_pickup: "driver_to_pickup",
  arrive_pickup: "driver_arrived_pickup",
  begin_pickup_verification: "pickup_verification",
  verify_pickup: "collected",
  start_delivery: "en_route",
  arrive_customer: "driver_arrived_customer",
  begin_handoff: "handoff_verification",
  complete: "delivered"
};

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const body = schema.parse(await request.json());
    const { db, messaging } = getAdminServices();
    const jobRef = db.collection("deliveryJobs").doc(body.deliveryJobId);
    let resultState = "";
    let notify = null;
    await db.runTransaction(async (transaction) => {
      const jobSnap = await transaction.get(jobRef);
      if (!jobSnap.exists) throw Object.assign(new Error("The delivery was not found."), { status: 404 });
      const job = jobSnap.data();
      if (job.assignedDriverId !== user.uid) throw Object.assign(new Error("This delivery is not assigned to your Driver account."), { status: 403 });
      const nextState = ACTION_TO_STATE[body.action];
      if (!driverMayTransition(job.state, nextState)) throw Object.assign(new Error("That delivery step is not available right now. Refresh and follow the current next action."), { status: 409 });
      if (body.action === "verify_pickup") {
        const supplied = String(body.code || "").trim();
        if (!supplied || supplied !== String(job.pickupCode || "")) throw Object.assign(new Error("The pickup code is not correct. Ask the business to check the code and try again."), { status: 409 });
      }
      if (body.action === "complete") {
        const supplied = String(body.code || "").trim();
        if (!supplied || supplied !== String(job.customerPin || "")) throw Object.assign(new Error("We could not confirm this delivery. Ask the customer for the 4-digit delivery PIN again."), { status: 409 });
      }
      const patch = { state: nextState, updatedAt: FieldValue.serverTimestamp() };
      if (body.action === "arrive_pickup") patch.arrivedPickupAt = FieldValue.serverTimestamp();
      if (body.action === "verify_pickup") patch.collectedAt = FieldValue.serverTimestamp();
      if (body.action === "arrive_customer") patch.arrivedCustomerAt = FieldValue.serverTimestamp();
      if (body.action === "complete") patch.deliveredAt = FieldValue.serverTimestamp();
      transaction.set(jobRef, patch, { merge: true });
      await appendDeliveryEvent(transaction, db, { jobId: body.deliveryJobId, orderId: job.orderId, type: `delivery.${body.action}`, actorType: "driver", actorId: user.uid, previousState: job.state, state: nextState });
      if (body.action === "verify_pickup" && job.orderId) transaction.set(db.collection("orders").doc(job.orderId), { deliveryStatus: "collected", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      if (body.action === "complete") {
        if (job.orderId) transaction.set(db.collection("orders").doc(job.orderId), { deliveryStatus: "delivered", status: "completed", completedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        transaction.set(db.collection("driverPresence").doc(user.uid), { currentJobId: null, availabilityState: "online_current", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        await creditDeliveryEarnings(transaction, db, { driverId: user.uid, deliveryJobId: body.deliveryJobId, orderId: job.orderId, amount: job.acceptedDriverPay ?? job.quotedDriverPay ?? 0, currency: job.currency || "USD" });
        await appendAudit(transaction, db, { actorId: user.uid, action: "delivery.completed", entityType: "deliveryJob", entityId: body.deliveryJobId, metadata: { orderId: job.orderId || null } });
      }
      resultState = nextState;
      notify = { customerId: job.customerId, businessId: job.businessId, number: job.number, action: body.action };
    });
    const messageMap = {
      start_to_pickup: "Your Driver is going to the business.", arrive_pickup: "Your Driver arrived at the business.", verify_pickup: "Your Driver collected the order.",
      start_delivery: "Your order is on the way.", arrive_customer: "Your Driver has arrived.", complete: "Your delivery is complete."
    };
    if (notify && messageMap[notify.action]) await notifyUsers(db, messaging, [notify.customerId], { title: notify.number || "Delivery update", body: messageMap[notify.action], href: "/marketplace?view=orders", category: "delivery" });
    return Response.json({ ok: true, state: resultState });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the delivery action." }, { status: 400 });
    return apiError(error);
  }
}

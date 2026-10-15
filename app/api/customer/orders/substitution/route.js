import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { appendDeliveryEvent, notifyUsers } from "@/lib/driver-delivery-server";

export const runtime = "nodejs";

const schema = z.object({
  orderId: z.string().min(3).max(180),
  productId: z.string().min(1).max(180),
  decision: z.enum(["approve", "reject"])
});

function round(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : 0;
}

function itemTotal(item = {}) {
  if (!["found", "replaced"].includes(item.status)) return 0;
  return round(Math.max(0, Number(item.actualQuantity || 0)) * Math.max(0, Number(item.actualUnitPrice || 0)));
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const body = schema.parse(await request.json());
    const { db, messaging, auth } = getAdminServices();
    const orderRef = db.collection("orders").doc(body.orderId);
    let driverId = "";
    let result = null;
    await db.runTransaction(async (transaction) => {
      const orderSnap = await transaction.get(orderRef);
      if (!orderSnap.exists) throw Object.assign(new Error("The order was not found."), { status: 404 });
      const order = orderSnap.data() || {};
      if (order.customerId !== user.uid) throw Object.assign(new Error("You cannot decide substitutions for this order."), { status: 403 });
      if (!order.deliveryJobId) throw Object.assign(new Error("This order does not have an active Driver shopping job."), { status: 409 });
      const jobRef = db.collection("deliveryJobs").doc(order.deliveryJobId);
      const jobSnap = await transaction.get(jobRef);
      if (!jobSnap.exists) throw Object.assign(new Error("The Driver shopping job was not found."), { status: 404 });
      const job = jobSnap.data() || {};
      if (job.fulfilmentMode !== "driver_shops" || !["shopping", "shopping_review"].includes(job.state)) throw Object.assign(new Error("This substitution is no longer waiting for a decision."), { status: 409 });
      const items = Array.isArray(job.shopping?.items) ? job.shopping.items.map((item) => ({ ...item })) : [];
      const index = items.findIndex((item) => String(item.productId) === String(body.productId));
      if (index < 0 || items[index].status !== "substitution_pending") throw Object.assign(new Error("This replacement is no longer waiting for your approval."), { status: 409 });
      const current = items[index];
      if (body.decision === "approve") {
        items[index] = {
          ...current,
          status: "replaced",
          actualQuantity: round(current.proposedQuantity),
          actualUnitPrice: round(current.proposedUnitPrice),
          replacementName: String(current.proposedReplacementName || "").slice(0, 180),
          substitutionDecision: "approved",
          substitutionDecidedAt: new Date().toISOString(),
          substitutionDecidedBy: user.uid,
          updatedAt: new Date().toISOString()
        };
      } else {
        items[index] = {
          ...current,
          status: "unavailable",
          actualQuantity: 0,
          actualUnitPrice: 0,
          replacementName: "",
          substitutionDecision: "rejected",
          substitutionDecidedAt: new Date().toISOString(),
          substitutionDecidedBy: user.uid,
          updatedAt: new Date().toISOString()
        };
      }
      const projectedSubtotal = round(items.reduce((sum, item) => sum + itemTotal(item), 0));
      const maxAuthorized = round(order.shopping?.maxAuthorizedMerchandise ?? job.shopping?.maxAuthorizedMerchandise ?? 0);
      if (projectedSubtotal > maxAuthorized + 0.001) throw Object.assign(new Error("This replacement no longer fits within the funded shopping limit. Reject it and let the Driver choose another option."), { status: 409 });
      transaction.set(jobRef, { state: "shopping", shopping: { ...job.shopping, state: "shopping", items, projectedSubtotal }, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      transaction.set(orderRef, { deliveryStatus: "shopping", "shopping.state": "shopping", "shopping.projectedSubtotal": projectedSubtotal, "shopping.updatedAt": FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      await appendDeliveryEvent(transaction, db, { jobId: jobSnap.id, orderId: orderSnap.id, type: body.decision === "approve" ? "shopping.substitution.approved" : "shopping.substitution.rejected", actorType: "customer", actorId: user.uid, previousState: job.state, state: "shopping", metadata: { productId: body.productId, replacementName: current.proposedReplacementName || "", projectedSubtotal } });
      driverId = job.assignedDriverId || "";
      result = { decision: body.decision, productId: body.productId, projectedSubtotal };
    });
    if (driverId) await notifyUsers(db, messaging, [driverId], { title: body.decision === "approve" ? "Customer approved the replacement" : "Customer declined the replacement", body: body.decision === "approve" ? "Continue shopping with the approved replacement." : "The item was marked unavailable. Continue the basket.", href: "/active", category: "delivery", auth });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the substitution decision." }, { status: 400 });
    return apiError(error);
  }
}

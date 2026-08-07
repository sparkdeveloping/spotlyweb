import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requireBusinessPermission } from "@/lib/access-control-server";
import { releaseReservationInTransaction } from "@/lib/order-reservations-server";
import { safeText } from "@/lib/server-helpers";

export const runtime = "nodejs";

const schema = z.object({
  orderId: z.string().min(3).max(180),
  changes: z.object({
    status: z.string().min(2).max(80).optional(),
    paymentStatus: z.enum(["paid"]).optional(),
    paidAt: z.string().optional(),
    businessNotes: z.array(z.object({ body: z.string().max(1000), at: z.string().optional(), actorId: z.string().optional(), actorName: z.string().optional() })).max(100).optional(),
    substitutions: z.array(z.record(z.string(), z.any())).max(100).optional(),
    cancellationReason: z.string().max(500).optional(),
    checkedInAt: z.string().optional(),
    kioskMode: z.string().max(80).optional()
  }),
  note: z.string().max(1000).optional()
});

const ALLOWED_STATUS_TRANSITIONS = new Map([
  ["new", new Set(["accepted", "cancelled"])],
  ["requested", new Set(["confirmed", "cancelled"])],
  ["submitted", new Set(["accepted", "confirmed", "cancelled"])],
  ["confirmed", new Set(["issued", "ready", "checked_in", "cancelled"])],
  ["accepted", new Set(["preparing", "cancelled"])],
  ["preparing", new Set(["ready_for_pickup", "cancelled"])],
  ["ready_for_pickup", new Set(["picked_up"])],
  ["ready", new Set(["checked_in", "completed"])],
  ["issued", new Set(["checked_in", "cancelled"])],
  ["arrived", new Set(["checked_in"])],
  ["checked_in", new Set(["completed", "checked_out"])],
  ["open", new Set(["replied", "resolved", "closed"])],
  ["replied", new Set(["resolved", "closed"])],
  ["awaiting_payment", new Set(["cancelled"])],
  ["payment_review", new Set(["confirmed", "cancelled"])]
]);

function transitionAllowed(current, next) {
  return !next || current === next || ALLOWED_STATUS_TRANSITIONS.get(current)?.has(next) === true;
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const body = schema.parse(await request.json());
    const { db } = getAdminServices();
    const orderRef = db.collection("orders").doc(body.orderId);
    const snapshot = await orderRef.get();
    if (!snapshot.exists) throw Object.assign(new Error("The order was not found."), { status: 404 });
    const order = snapshot.data();
    await requireBusinessPermission(db, user, order.businessId, "orders.update", { branchId: order.branchId, allowRoles: ["organization_owner", "business_owner", "business_manager", "branch_manager"] });

    const nextStatus = body.changes.status;
    if (!transitionAllowed(order.status || "submitted", nextStatus)) throw Object.assign(new Error("That order status transition is not allowed."), { status: 409 });
    if (body.changes.paymentStatus === "paid") {
      if (!["cash", "bank_transfer"].includes(order.paymentMethod)) throw Object.assign(new Error("Paynow and mobile-money payments can only be confirmed by the payment provider."), { status: 409 });
      if (["paid", "refunded"].includes(order.paymentStatus)) throw Object.assign(new Error("This payment is already finalized."), { status: 409 });
    }

    const note = safeText(body.note || "", 1000);
    const terminalCancel = nextStatus === "cancelled";
    await db.runTransaction(async (transaction) => {
      const freshSnapshot = await transaction.get(orderRef);
      if (!freshSnapshot.exists) throw Object.assign(new Error("The order no longer exists."), { status: 404 });
      const fresh = freshSnapshot.data();
      if (!transitionAllowed(fresh.status || "submitted", nextStatus)) throw Object.assign(new Error("The order changed while you were working. Refresh and try again."), { status: 409 });

      const changes = { ...body.changes, updatedAt: FieldValue.serverTimestamp(), updatedBy: user.uid };
      if (body.changes.paymentStatus === "paid") changes.paidAt = FieldValue.serverTimestamp();
      const timelineEntry = { status: nextStatus || fresh.status, note, at: new Date().toISOString(), actorId: user.uid, actorName: user.name || user.email || "Business team" };
      changes.timeline = FieldValue.arrayUnion(timelineEntry);

      if (terminalCancel) {
        if (["paid", "refund_pending", "refunded"].includes(fresh.paymentStatus)) throw Object.assign(new Error("Paid orders must use the refund workflow instead of merchant cancellation."), { status: 409 });
        await releaseReservationInTransaction(transaction, db, orderRef, fresh, {
          reason: "merchant_rejected",
          actorId: user.uid,
          nextStatus: "cancelled",
          source: "business_order_update",
          orderPatch: { ...changes, cancellationReason: safeText(body.changes.cancellationReason || note || "Cancelled by business", 500) }
        });
      } else {
        transaction.set(orderRef, changes, { merge: true });
        transaction.create(db.collection("orderEvents").doc(), {
          orderId: body.orderId,
          type: body.changes.paymentStatus === "paid" ? "manual_payment_confirmed" : "order_updated",
          previousStatus: fresh.status || null,
          status: nextStatus || fresh.status,
          actorType: "business_user",
          actorId: user.uid,
          source: "business_workspace",
          note,
          metadata: { paymentStatus: body.changes.paymentStatus || null },
          createdAt: FieldValue.serverTimestamp()
        });
      }

      if (fresh.customerId) {
        transaction.create(db.collection("notifications").doc(), {
          userId: fresh.customerId,
          businessId: fresh.businessId,
          orderId: body.orderId,
          title: `Order ${fresh.number || body.orderId.slice(0, 8)}`,
          body: note || `Your order is now ${String(nextStatus || fresh.status).replaceAll("_", " ")}.`,
          href: `/marketplace?order=${body.orderId}`,
          category: "order",
          read: false,
          createdAt: FieldValue.serverTimestamp()
        });
      }
    });

    return Response.json({ ok: true, orderId: body.orderId, status: nextStatus || order.status });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the order update details.", details: error.flatten() }, { status: 400 });
    return apiError(error);
  }
}

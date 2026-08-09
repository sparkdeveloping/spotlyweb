import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requirePlatformPermission } from "@/lib/access-control-server";
import { canTransitionPayment } from "@/lib/payment-state";
import { releaseReservationInTransaction } from "@/lib/order-reservations-server";
import { safeText } from "@/lib/server-helpers";
import { merchantNetAmount, moneyEntryId, postLedgerEntry, refundLedgerEffects } from "@/lib/business-money-server";

export const runtime = "nodejs";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("request"), orderId: z.string().min(3).max(180), amount: z.number().positive(), reason: z.string().min(5).max(500) }),
  z.object({ action: z.literal("mark_processing"), refundId: z.string().min(3).max(180), providerReference: z.string().max(200).optional() }),
  z.object({ action: z.literal("mark_refunded"), refundId: z.string().min(3).max(180), providerReference: z.string().min(2).max(200) }),
  z.object({ action: z.literal("mark_failed"), refundId: z.string().min(3).max(180), reason: z.string().min(3).max(500) })
]);

function audit(transaction, db, user, action, entityId, metadata) {
  transaction.create(db.collection("auditLogs").doc(), { action, entityType: "refundRequest", entityId, actorId: user.uid, actorEmail: user.email || "", metadata, createdAt: FieldValue.serverTimestamp() });
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    requirePlatformPermission(user, "finance.refund", { roles: ["finance_admin"] });
    const body = schema.parse(await request.json());
    const { db } = getAdminServices();

    if (body.action === "request") {
      const orderRef = db.collection("orders").doc(body.orderId);
      const refundRef = db.collection("refundRequests").doc();
      await db.runTransaction(async (transaction) => {
        const orderSnapshot = await transaction.get(orderRef);
        if (!orderSnapshot.exists) throw Object.assign(new Error("The order was not found."), { status: 404 });
        const order = orderSnapshot.data();
        const total = Number(order.totals?.total ?? order.total ?? 0);
        if (order.paymentStatus !== "paid") throw Object.assign(new Error("Only captured payments can enter the refund workflow."), { status: 409 });
        if (body.amount > total + 0.001) throw Object.assign(new Error("The refund cannot exceed the captured order total."), { status: 422 });
        if (Math.abs(body.amount - total) > 0.01) throw Object.assign(new Error("Partial refunds are not enabled in the controlled pilot. Use a full refund or resolve the adjustment through reconciliation."), { status: 422 });
        if (!canTransitionPayment("paid", "refund_pending")) throw Object.assign(new Error("This payment cannot enter the refund workflow."), { status: 409 });
        const intentRef = order.paymentIntentReference ? db.collection("paymentIntents").doc(order.paymentIntentReference) : null;
        if (intentRef) await transaction.get(intentRef);

        transaction.create(refundRef, {
          orderId: body.orderId,
          paymentIntentReference: order.paymentIntentReference || null,
          amount: Number(body.amount.toFixed(2)),
          currency: order.currency || "USD",
          reason: safeText(body.reason, 500),
          status: "refund_requested",
          requestedBy: user.uid,
          requestedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
        transaction.set(orderRef, { paymentStatus: "refund_pending", refundRequestId: refundRef.id, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        if (intentRef) transaction.set(intentRef, { status: "refund_pending", refundRequestId: refundRef.id, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        transaction.create(db.collection("orderEvents").doc(), { orderId: body.orderId, type: "refund_requested", previousStatus: order.status || null, status: order.status || null, actorType: "admin", actorId: user.uid, source: "manual_refund", metadata: { refundId: refundRef.id, amount: body.amount, currency: order.currency || "USD" }, createdAt: FieldValue.serverTimestamp() });
        audit(transaction, db, user, "refund.requested", refundRef.id, { orderId: body.orderId, amount: body.amount, currency: order.currency || "USD" });
      });
      return Response.json({ ok: true, refundId: refundRef.id, status: "refund_requested" });
    }

    const refundRef = db.collection("refundRequests").doc(body.refundId);
    await db.runTransaction(async (transaction) => {
      const refundSnapshot = await transaction.get(refundRef);
      if (!refundSnapshot.exists) throw Object.assign(new Error("The refund request was not found."), { status: 404 });
      const refund = refundSnapshot.data();
      const orderRef = db.collection("orders").doc(refund.orderId);
      const orderSnapshot = await transaction.get(orderRef);
      if (!orderSnapshot.exists) throw Object.assign(new Error("The order was not found."), { status: 404 });
      const order = orderSnapshot.data();
      const intentRef = refund.paymentIntentReference ? db.collection("paymentIntents").doc(refund.paymentIntentReference) : null;
      if (intentRef) await transaction.get(intentRef);

      if (body.action === "mark_processing") {
        if (!["refund_requested", "refund_failed"].includes(refund.status)) throw Object.assign(new Error("This refund cannot move to processing."), { status: 409 });
        transaction.set(refundRef, { status: "refund_processing", providerReference: body.providerReference || refund.providerReference || "", processingBy: user.uid, processingAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        transaction.set(orderRef, { paymentStatus: "refund_pending", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        if (intentRef) transaction.set(intentRef, { status: "refund_pending", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        audit(transaction, db, user, "refund.processing", body.refundId, { orderId: refund.orderId });
        return;
      }

      if (body.action === "mark_failed") {
        if (!["refund_requested", "refund_processing"].includes(refund.status)) throw Object.assign(new Error("This refund is not currently processing."), { status: 409 });
        transaction.set(refundRef, { status: "refund_failed", failureReason: safeText(body.reason, 500), failedBy: user.uid, failedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        transaction.set(orderRef, { paymentStatus: "refund_failed", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        if (intentRef) transaction.set(intentRef, { status: "refund_failed", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        audit(transaction, db, user, "refund.failed", body.refundId, { orderId: refund.orderId, reason: safeText(body.reason, 500) });
        return;
      }

      if (!["refund_requested", "refund_processing"].includes(refund.status)) throw Object.assign(new Error("This refund cannot be marked complete."), { status: 409 });
      const fulfilled = ["picked_up", "completed", "checked_in", "checked_out", "delivered"].includes(order.status);
      if (!fulfilled && order.inventoryReservationStatus !== "released") {
        await releaseReservationInTransaction(transaction, db, orderRef, { ...order, paymentStatus: "refunded" }, {
          reason: "refund_before_fulfilment", actorId: user.uid, nextStatus: "refunded", source: "manual_refund",
          orderPatch: { paymentStatus: "refunded", refundedAt: FieldValue.serverTimestamp(), refundRequestId: body.refundId }
        });
      } else {
        transaction.set(orderRef, { paymentStatus: "refunded", refundedAt: FieldValue.serverTimestamp(), refundRequestId: body.refundId, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      }
      if (intentRef) transaction.set(intentRef, { status: "refunded", refundedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      const merchantRefund = merchantNetAmount(order);
      if (order.businessId && merchantRefund > 0) {
        postLedgerEntry(transaction, db, { id: moneyEntryId("refund", body.refundId), businessId: order.businessId, orderId: refund.orderId, paymentIntentId: refund.paymentIntentReference || null, refundId: body.refundId, currency: order.currency || "USD", amount: merchantRefund, direction: "debit", type: "refund", effects: refundLedgerEffects(merchantRefund, order.merchantSettlementStatus), reference: body.providerReference, source: "manual_refund", createdBy: user.uid });
        transaction.set(orderRef, { merchantSettlementStatus: "refunded", merchantSettlementUpdatedAt: FieldValue.serverTimestamp() }, { merge: true });
      }
      transaction.set(refundRef, { status: "refunded", providerReference: body.providerReference, completedBy: user.uid, refundedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      transaction.create(db.collection("orderEvents").doc(), { orderId: refund.orderId, type: "refund_completed", previousStatus: order.status || null, status: fulfilled ? order.status : "refunded", actorType: "admin", actorId: user.uid, source: "manual_refund", metadata: { refundId: body.refundId, amount: refund.amount, providerReference: body.providerReference }, createdAt: FieldValue.serverTimestamp() });
      audit(transaction, db, user, "refund.completed", body.refundId, { orderId: refund.orderId, amount: refund.amount, providerReference: body.providerReference });
    });
    return Response.json({ ok: true, refundId: body.refundId, status: body.action === "mark_refunded" ? "refunded" : body.action.replace("mark_", "refund_") });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the refund details.", details: error.flatten() }, { status: 400 });
    return apiError(error);
  }
}

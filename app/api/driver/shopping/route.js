import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { appendAudit, appendDeliveryEvent, notifyUsers } from "@/lib/driver-delivery-server";
import { postPaymentCapturedLedger } from "@/lib/business-money-server";
import { shoppingReconciliation } from "@/lib/order-money";
import { safeText } from "@/lib/server-helpers";

export const runtime = "nodejs";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), deliveryJobId: z.string().min(3).max(180) }),
  z.object({
    action: z.literal("item"),
    deliveryJobId: z.string().min(3).max(180),
    productId: z.string().min(1).max(180),
    status: z.enum(["found", "replaced", "unavailable"]),
    actualQuantity: z.number().min(0).max(500).optional(),
    actualUnitPrice: z.number().min(0).max(100000).optional(),
    replacementName: z.string().max(180).optional(),
    note: z.string().max(500).optional()
  }),
  z.object({ action: z.literal("review"), deliveryJobId: z.string().min(3).max(180) }),
  z.object({ action: z.literal("edit"), deliveryJobId: z.string().min(3).max(180) }),
  z.object({
    action: z.literal("finalize"),
    deliveryJobId: z.string().min(3).max(180),
    receiptStoragePath: z.string().min(10).max(900),
    receiptReference: z.string().max(180).optional()
  })
]);

function round(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : 0;
}

function itemTotal(item = {}) {
  if (!["found", "replaced"].includes(item.status)) return 0;
  return round(Math.max(0, Number(item.actualQuantity || 0)) * Math.max(0, Number(item.actualUnitPrice || 0)));
}

function shoppingTotal(items = []) {
  return round(items.reduce((sum, item) => sum + itemTotal(item), 0));
}

function validateReceiptPath(path, driverId, deliveryJobId) {
  const prefix = `driver-deliveries/${driverId}/${deliveryJobId}/receipts/`;
  if (!String(path || "").startsWith(prefix) || String(path).includes("..")) {
    throw Object.assign(new Error("Upload the store receipt from this delivery before checkout."), { status: 422 });
  }
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const body = schema.parse(await request.json());
    const { db, messaging, auth } = getAdminServices();
    const jobRef = db.collection("deliveryJobs").doc(body.deliveryJobId);
    let response = null;
    let notification = null;

    await db.runTransaction(async (transaction) => {
      const jobSnap = await transaction.get(jobRef);
      if (!jobSnap.exists) throw Object.assign(new Error("The delivery was not found."), { status: 404 });
      const job = jobSnap.data();
      if (job.assignedDriverId !== user.uid) throw Object.assign(new Error("This shopping delivery is not assigned to your Driver account."), { status: 403 });
      if (job.fulfilmentMode !== "driver_shops" || job.shopping?.state === "funding_pending") throw Object.assign(new Error("This delivery is not ready for in-store shopping."), { status: 409 });
      if (!job.orderId) throw Object.assign(new Error("This shopping delivery is missing its order reference."), { status: 409 });
      const orderRef = db.collection("orders").doc(job.orderId);
      const orderSnap = await transaction.get(orderRef);
      if (!orderSnap.exists) throw Object.assign(new Error("The customer order was not found."), { status: 404 });
      const order = orderSnap.data();
      if (order.paymentStatus !== "paid") throw Object.assign(new Error("Customer payment is not confirmed yet. Do not buy the items."), { status: 409 });

      const items = Array.isArray(job.shopping?.items) ? job.shopping.items.map((item) => ({ ...item })) : [];
      const maxAuthorized = round(order.shopping?.maxAuthorizedMerchandise ?? job.shopping?.maxAuthorizedMerchandise ?? 0);

      if (body.action === "start") {
        if (job.state !== "driver_arrived_pickup") throw Object.assign(new Error("Arrive at the store before starting shopping."), { status: 409 });
        transaction.set(jobRef, { state: "shopping", "shopping.state": "shopping", "shopping.startedAt": FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        transaction.set(orderRef, { deliveryStatus: "shopping", "shopping.state": "shopping", "shopping.startedAt": FieldValue.serverTimestamp(), "shopping.updatedAt": FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        await appendDeliveryEvent(transaction, db, { jobId: body.deliveryJobId, orderId: job.orderId, type: "shopping.started", actorType: "driver", actorId: user.uid, previousState: job.state, state: "shopping" });
        response = { state: "shopping" };
        notification = { customerId: job.customerId, title: job.number || "Shopping started", body: "Your Driver is now shopping for your order." };
        return;
      }

      if (body.action === "item") {
        if (!['shopping', 'shopping_review'].includes(job.state)) throw Object.assign(new Error("Start shopping before updating items."), { status: 409 });
        const index = items.findIndex((item) => String(item.productId) === String(body.productId));
        if (index < 0) throw Object.assign(new Error("That item is not part of this customer order."), { status: 404 });
        const current = items[index];
        const actualQuantity = body.status === "unavailable" ? 0 : Number(body.actualQuantity ?? current.requestedQuantity ?? 1);
        const actualUnitPrice = body.status === "unavailable" ? 0 : Number(body.actualUnitPrice ?? current.estimatedUnitPrice ?? 0);
        if (["found", "replaced"].includes(body.status) && (actualQuantity <= 0 || actualUnitPrice < 0)) throw Object.assign(new Error("Add the actual quantity and shelf price for this item."), { status: 422 });
        if (body.status === "replaced" && !String(body.replacementName || "").trim()) throw Object.assign(new Error("Name the replacement so the customer can recognize it."), { status: 422 });
        items[index] = {
          ...current,
          status: body.status,
          actualQuantity: round(actualQuantity),
          actualUnitPrice: round(actualUnitPrice),
          replacementName: body.status === "replaced" ? safeText(body.replacementName, 180) : "",
          note: safeText(body.note, 500),
          updatedAt: new Date().toISOString()
        };
        const projected = shoppingTotal(items);
        if (projected > maxAuthorized + 0.001) throw Object.assign(new Error(`This change would exceed the customer-funded shopping limit by ${round(projected - maxAuthorized).toFixed(2)}. Choose a cheaper replacement or mark an item unavailable.`), { status: 422 });
        transaction.set(jobRef, { state: "shopping", shopping: { ...job.shopping, state: "shopping", items, projectedSubtotal: projected }, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        transaction.set(orderRef, { deliveryStatus: "shopping", "shopping.state": "shopping", "shopping.projectedSubtotal": projected, "shopping.updatedAt": FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        await appendDeliveryEvent(transaction, db, { jobId: body.deliveryJobId, orderId: job.orderId, type: `shopping.item.${body.status}`, actorType: "driver", actorId: user.uid, previousState: job.state, state: "shopping", metadata: { productId: body.productId, projectedSubtotal: projected } });
        response = { state: "shopping", projectedSubtotal: projected, remaining: round(maxAuthorized - projected), items };
        return;
      }

      if (body.action === "edit") {
        if (job.state !== "shopping_review") throw Object.assign(new Error("The basket is not currently in checkout review."), { status: 409 });
        transaction.set(jobRef, { state: "shopping", "shopping.state": "shopping", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        transaction.set(orderRef, { deliveryStatus: "shopping", "shopping.state": "shopping", "shopping.updatedAt": FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        await appendDeliveryEvent(transaction, db, { jobId: body.deliveryJobId, orderId: job.orderId, type: "shopping.review_reopened", actorType: "driver", actorId: user.uid, previousState: job.state, state: "shopping" });
        response = { state: "shopping", items };
        return;
      }

      if (body.action === "review") {
        if (job.state !== "shopping") throw Object.assign(new Error("Shopping is not currently in progress."), { status: 409 });
        const pending = items.filter((item) => item.status === "pending");
        if (pending.length) throw Object.assign(new Error(`${pending.length} item${pending.length === 1 ? " still needs" : "s still need"} a found, replacement, or unavailable result.`), { status: 422 });
        const actualSubtotal = shoppingTotal(items);
        if (actualSubtotal > maxAuthorized + 0.001) throw Object.assign(new Error("The basket is above the funded shopping limit. Adjust the basket before checkout."), { status: 422 });
        transaction.set(jobRef, { state: "shopping_review", "shopping.state": "shopping_review", "shopping.projectedSubtotal": actualSubtotal, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        transaction.set(orderRef, { deliveryStatus: "shopping_review", "shopping.state": "shopping_review", "shopping.projectedSubtotal": actualSubtotal, "shopping.updatedAt": FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        await appendDeliveryEvent(transaction, db, { jobId: body.deliveryJobId, orderId: job.orderId, type: "shopping.review_ready", actorType: "driver", actorId: user.uid, previousState: job.state, state: "shopping_review", metadata: { actualSubtotal } });
        response = { state: "shopping_review", actualSubtotal, remaining: round(maxAuthorized - actualSubtotal), items };
        return;
      }

      validateReceiptPath(body.receiptStoragePath, user.uid, body.deliveryJobId);
      if (job.state !== "shopping_review") {
        if (["collected", "en_route", "driver_arrived_customer", "handoff_verification", "delivered"].includes(job.state) && order.shopping?.state === "checked_out") {
          response = { state: job.state, idempotent: true, adjustmentId: order.shopping?.adjustmentId || null };
          return;
        }
        throw Object.assign(new Error("Review the completed basket before checking out."), { status: 409 });
      }
      if (items.some((item) => item.status === "pending")) throw Object.assign(new Error("Resolve every shopping item before checkout."), { status: 422 });
      const actualSubtotal = shoppingTotal(items);
      const reconciliation = shoppingReconciliation({ order: { id: orderSnap.id, ...order }, actualSubtotal, actualTax: 0 });
      if (reconciliation.topUpRequired > 0.001) throw Object.assign(new Error("The basket exceeds the customer-funded amount. Reduce the basket before checkout; Spotly will not ask you to pay the difference."), { status: 422 });

      const finalizedOrder = {
        id: orderSnap.id,
        ...order,
        shopping: { ...order.shopping, state: "checked_out", actualSubtotal: reconciliation.subtotal, actualTax: reconciliation.tax },
        totals: { ...order.totals, finalSubtotal: reconciliation.subtotal, finalTax: reconciliation.tax, finalTotal: reconciliation.finalTotal, platformCommission: reconciliation.platformCommission, merchantGross: reconciliation.merchantGross, merchantNet: reconciliation.merchantNet }
      };
      postPaymentCapturedLedger(transaction, db, finalizedOrder, order.paymentIntentReference || `order:${orderSnap.id}`, "driver_shopping_receipt");

      const adjustmentId = reconciliation.unusedReserve > 0.009 ? `shopping_${orderSnap.id}` : null;
      if (adjustmentId) {
        transaction.create(db.collection("customerMoneyAdjustments").doc(adjustmentId), {
          orderId: orderSnap.id,
          customerId: order.customerId,
          paymentIntentReference: order.paymentIntentReference || null,
          type: "shopping_unused_reserve",
          amount: reconciliation.unusedReserve,
          currency: order.currency || "USD",
          status: "refund_required",
          reason: "Unused Driver shopping reserve after store receipt reconciliation",
          source: "driver_shopping",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
      }

      transaction.set(jobRef, {
        state: "collected",
        collectedAt: FieldValue.serverTimestamp(),
        shopping: { ...job.shopping, state: "checked_out", items, actualSubtotal: reconciliation.subtotal, finalTotal: reconciliation.finalTotal, unusedReserve: reconciliation.unusedReserve, receiptStoragePath: body.receiptStoragePath, receiptReference: safeText(body.receiptReference, 180), checkedOutAt: new Date().toISOString() },
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      transaction.set(orderRef, {
        deliveryStatus: "collected",
        merchantSettlementStatus: "pending",
        merchantSettlementUpdatedAt: FieldValue.serverTimestamp(),
        totals: finalizedOrder.totals,
        shopping: { ...order.shopping, state: "checked_out", actualSubtotal: reconciliation.subtotal, actualTax: reconciliation.tax, finalTotal: reconciliation.finalTotal, unusedReserve: reconciliation.unusedReserve, topUpRequired: 0, receiptStoragePath: body.receiptStoragePath, receiptReference: safeText(body.receiptReference, 180), adjustmentId, refundStatus: adjustmentId ? "refund_required" : "not_required", checkedOutAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      await appendDeliveryEvent(transaction, db, { jobId: body.deliveryJobId, orderId: job.orderId, type: "shopping.checked_out", actorType: "driver", actorId: user.uid, previousState: job.state, state: "collected", metadata: { actualSubtotal: reconciliation.subtotal, finalTotal: reconciliation.finalTotal, unusedReserve: reconciliation.unusedReserve, adjustmentId } });
      await appendAudit(transaction, db, { actorId: user.uid, action: "shopping.receipt_reconciled", entityType: "deliveryJob", entityId: body.deliveryJobId, metadata: { orderId: job.orderId, actualSubtotal: reconciliation.subtotal, unusedReserve: reconciliation.unusedReserve, adjustmentId } });
      response = { state: "collected", reconciliation, adjustmentId };
      notification = {
        customerId: job.customerId,
        title: job.number || "Shopping complete",
        body: reconciliation.unusedReserve > 0.009
          ? `Your Driver checked out. ${reconciliation.unusedReserve.toFixed(2)} ${order.currency || "USD"} of unused shopping reserve is queued to be returned.`
          : "Your Driver checked out and is ready to bring your order."
      };
    });

    if (notification?.customerId) await notifyUsers(db, messaging, [notification.customerId], { title: notification.title, body: notification.body, href: "/marketplace?view=orders", category: "delivery", auth });
    return Response.json({ ok: true, ...response });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the shopping update.", details: error.flatten() }, { status: 400 });
    return apiError(error);
  }
}

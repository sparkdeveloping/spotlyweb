import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { canTransitionPayment, paymentCallbackKey } from "@/lib/payment-state";
import { releaseReservationInTransaction } from "@/lib/order-reservations-server";
import { postPaymentCapturedLedger } from "@/lib/business-money-server";
import { notifyUser } from "@/lib/notification-server";
import { dispatchDelivery } from "@/lib/driver-delivery-server";

function requestedState(normalized) { return normalized.paid ? "paid" : normalized.state || "pending"; }
function terminalFailure(state) { return ["failed", "expired", "cancelled"].includes(state); }

export async function applyProviderPaymentUpdate(db, intentReference, normalized, { source = "paynow_callback", messaging = null, auth = null } = {}) {
  const intentRef = db.collection("paymentIntents").doc(intentReference);
  const callbackRef = db.collection("paymentCallbacks").doc(paymentCallbackKey({
    reference: normalized.reference || intentReference,
    providerReference: normalized.providerReference,
    providerStatus: normalized.providerStatus,
    amount: normalized.amount
  }));

  const result = await db.runTransaction(async (transaction) => {
    const callbackSnapshot = await transaction.get(callbackRef);
    if (callbackSnapshot.exists) return { deduplicated: true, ...callbackSnapshot.data().result };

    const intentSnapshot = await transaction.get(intentRef);
    if (!intentSnapshot.exists) throw Object.assign(new Error("The payment intent was not found."), { status: 404 });
    const intent = intentSnapshot.data();
    const orderRef = db.collection("orders").doc(intent.orderId);
    const orderSnapshot = await transaction.get(orderRef);
    if (!orderSnapshot.exists) throw Object.assign(new Error("The order was not found."), { status: 404 });
    const order = orderSnapshot.data();

    const expectedAmount = Number(intent.amount || 0);
    const amountMismatch = normalized.amount > 0 && Math.abs(normalized.amount - expectedAmount) > 0.01;
    const current = intent.status || order.paymentStatus || "unpaid";
    const requested = amountMismatch ? "amount_mismatch" : requestedState(normalized);
    const allowed = canTransitionPayment(current, requested);
    const next = allowed ? requested : current;
    const now = FieldValue.serverTimestamp();
    const anomaly = amountMismatch || !allowed || normalized.providerStatus === "disputed";

    const orderPatch = { paymentStatus: next, providerPaymentStatus: normalized.providerStatus || "unknown", updatedAt: now };
    if (next === "paid") {
      orderPatch.paidAt = order.paidAt || now;
      if (order.status === "awaiting_payment") orderPatch.status = "confirmed";
      if (["cancelled", "void", "rejected"].includes(order.status)) orderPatch.status = "payment_exception";
    }

    let released = false;
    if (allowed && terminalFailure(next) && !["paid", "refund_pending", "refunded"].includes(current) && order.inventoryReservationStatus !== "released" && ["awaiting_payment", "submitted"].includes(order.status)) {
      await releaseReservationInTransaction(transaction, db, orderRef, order, {
        reason: next === "expired" ? "payment_expired" : "payment_failed",
        actorId: "paynow",
        nextStatus: next === "expired" ? "expired" : "payment_failed",
        source,
        orderPatch
      });
      released = true;
    }

    if (anomaly || (next === "paid" && ["cancelled", "void", "rejected"].includes(order.status))) {
      transaction.create(db.collection("paymentReconciliationIssues").doc(), {
        orderId: intent.orderId,
        paymentIntentReference: intentReference,
        businessId: order.businessId || null,
        type: amountMismatch ? "amount_mismatch" : !allowed ? "invalid_state_transition" : normalized.providerStatus === "disputed" ? "provider_dispute" : "paid_after_terminal_order_state",
        currentState: current,
        requestedState: requested,
        expectedAmount,
        providerAmount: normalized.amount || 0,
        currency: intent.currency || order.currency || "USD",
        providerStatus: normalized.providerStatus || "unknown",
        providerReference: normalized.providerReference || intent.providerReference || "",
        status: "open",
        createdAt: now,
        updatedAt: now
      });
    }

    transaction.set(intentRef, {
      status: next,
      providerStatus: normalized.providerStatus || "unknown",
      providerReference: normalized.providerReference || intent.providerReference || "",
      providerAmount: normalized.amount || 0,
      lastSource: source,
      checkedAt: now,
      updatedAt: now,
      ...(next === "paid" && current !== "paid" ? { paidAt: now } : {})
    }, { merge: true });
    if (!released) transaction.set(orderRef, orderPatch, { merge: true });

    if (allowed && current !== next) {
      if (next === "paid") {
        const driverShopping = order.shopping?.mode === "driver_shops";
        if (driverShopping) {
          transaction.set(orderRef, { merchantSettlementStatus: "awaiting_shopping_reconciliation", merchantSettlementUpdatedAt: now, "shopping.state": "funded", "shopping.fundedAt": now, "shopping.updatedAt": now, deliveryStatus: "awaiting_dispatch" }, { merge: true });
          if (order.deliveryJobId) transaction.set(db.collection("deliveryJobs").doc(order.deliveryJobId), { "shopping.state": "funded", state: "awaiting_dispatch", fundedAt: now, updatedAt: now }, { merge: true });
        } else {
          postPaymentCapturedLedger(transaction, db, { id: intent.orderId, ...order }, intentReference, source);
          transaction.set(orderRef, { merchantSettlementStatus: "pending", merchantSettlementUpdatedAt: now }, { merge: true });
        }
      }
      transaction.create(db.collection("orderEvents").doc(), {
        orderId: intent.orderId,
        type: next === "paid" ? "payment_confirmed" : "payment_status_updated",
        previousStatus: order.status || null,
        status: orderPatch.status || order.status || null,
        actorType: "provider",
        actorId: "paynow",
        source,
        metadata: { paymentPreviousState: current, paymentState: next, reference: intentReference, providerReference: normalized.providerReference || "" },
        createdAt: now
      });
    }

    const result = { deduplicated: false, orderId: intent.orderId, previousState: current, state: next, requestedState: requested, transitionApplied: allowed, amountMismatch, reservationReleased: released, driverShoppingDeliveryJobId: next === "paid" && order.shopping?.mode === "driver_shops" ? order.deliveryJobId || null : null };
    transaction.create(callbackRef, { provider: "paynow", paymentIntentReference: intentReference, orderId: intent.orderId, providerStatus: normalized.providerStatus || "unknown", providerReference: normalized.providerReference || "", result, processedAt: now });
    return result;
  });

  if (!result.deduplicated && result.transitionApplied && result.previousState !== result.state && result.state === "paid" && result.driverShoppingDeliveryJobId) {
    await dispatchDelivery({ db, messaging, deliveryJobId: result.driverShoppingDeliveryJobId, actorId: "paynow" }).catch(async (error) => {
      await db.collection("deliveryReconciliationIssues").add({ deliveryJobId: result.driverShoppingDeliveryJobId, orderId: result.orderId, type: "driver_shopping_dispatch_failed", status: "open", error: String(error?.message || "Dispatch failed").slice(0, 500), createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }).catch(() => null);
    });
  }

  if (!result.deduplicated && result.transitionApplied && result.previousState !== result.state) {
    const orderSnapshot = await db.collection("orders").doc(result.orderId).get().catch(() => null);
    const order = orderSnapshot?.exists ? orderSnapshot.data() : null;
    const customerId = order?.customerId;
    if (customerId) {
      const number = order?.orderNumber || order?.number || result.orderId;
      const paid = result.state === "paid";
      const failed = ["failed", "expired", "cancelled", "amount_mismatch"].includes(result.state);
      if (paid || failed) {
        await notifyUser({
          db, messaging, auth, userId: customerId,
          title: paid ? "Payment confirmed" : "Payment needs attention",
          body: paid ? `Payment for order ${number} is confirmed. Your receipt and live order status are now available in Spotly.` : `Payment for order ${number} was not completed. Your basket is safe while Spotly shows the next available payment action.`,
          href: `/account?order=${encodeURIComponent(result.orderId)}`,
          category: "payment", workspace: "customer", module: "money",
          eventType: paid ? "payment.confirmed" : "payment.attention", importance: paid ? "high" : "normal",
          businessId: order?.businessId || null, entityType: "order", entityId: result.orderId,
          email: true, forceOperationalEmail: paid
        }).catch(() => null);
      }
    }
  }
  return result;
}

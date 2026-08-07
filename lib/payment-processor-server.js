import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { canTransitionPayment, paymentCallbackKey } from "@/lib/payment-state";
import { releaseReservationInTransaction } from "@/lib/order-reservations-server";

function requestedState(normalized) { return normalized.paid ? "paid" : normalized.state || "pending"; }
function terminalFailure(state) { return ["failed", "expired", "cancelled"].includes(state); }

export async function applyProviderPaymentUpdate(db, intentReference, normalized, { source = "paynow_callback" } = {}) {
  const intentRef = db.collection("paymentIntents").doc(intentReference);
  const callbackRef = db.collection("paymentCallbacks").doc(paymentCallbackKey({
    reference: normalized.reference || intentReference,
    providerReference: normalized.providerReference,
    providerStatus: normalized.providerStatus,
    amount: normalized.amount
  }));

  return db.runTransaction(async (transaction) => {
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

    const result = { deduplicated: false, orderId: intent.orderId, previousState: current, state: next, requestedState: requested, transitionApplied: allowed, amountMismatch, reservationReleased: released };
    transaction.create(callbackRef, { provider: "paynow", paymentIntentReference: intentReference, orderId: intent.orderId, providerStatus: normalized.providerStatus || "unknown", providerReference: normalized.providerReference || "", result, processedAt: now });
    return result;
  });
}

import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { canTransitionPayment, paymentCallbackKey } from "@/lib/payment-state";
import { releaseReservationInTransaction } from "@/lib/order-reservations-server";
import { postPaymentCapturedLedger } from "@/lib/business-money-server";
import { notifyUser } from "@/lib/notification-server";
import { dispatchDelivery } from "@/lib/driver-delivery-server";
import { dispatchParcel } from "@/lib/parcel-server";
import { qualifyReferralForCustomer } from "@/lib/referral-server";
import {creditRideEarnings} from "@/lib/driver-money-server";

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
    const rideRef=order.transactionType==="ride"&&order.rideTripId?
      db.collection("rideTrips").doc(order.rideTripId):null;
    const rideSnap=rideRef?await transaction.get(rideRef):null;
    const ride=rideSnap?.exists?rideSnap.data():null;

    const expectedAmount = Number(intent.amount || 0);
    const amountMismatch=normalized.paid?
      !Number.isFinite(Number(normalized.amount))||Math.round(Number(normalized.amount)*100)!==Math.round(expectedAmount*100):
      normalized.amount>0&&Math.round(Number(normalized.amount)*100)!==Math.round(expectedAmount*100);
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
    if (rideRef && ride) {
      const ridePaymentPatch={paymentStatus:next,providerPaymentStatus:normalized.providerStatus||"unknown",updatedAt:now};
      if(next==="paid")ridePaymentPatch.paidAt=ride.paidAt||now;
      if(next==="paid"&&["cancelled","failed"].includes(ride.state)){
        ridePaymentPatch.paymentReviewRequired=true;
        transaction.set(db.collection("paymentReconciliationIssues").doc("ride_late_capture_"+order.rideTripId),{
         orderId:intent.orderId,rideId:order.rideTripId,paymentIntentReference:intentReference,
         type:"ride_captured_after_terminal_state",status:"open",createdAt:now,updatedAt:now
        },{merge:true});
      }
      if(next==="paid"&&current!=="paid"&&ride.state==="completed"&&ride.assignedDriverId&&
         !ride.earningsCreditedAt&&!ride.paymentReviewRequired){
        await creditRideEarnings(transaction,db,{driverId:ride.assignedDriverId,rideId:order.rideTripId,
         orderId:intent.orderId,amount:ride.acceptedDriverPay??ride.quote?.driverPay??0,
         currency:ride.currency||"USD"});
        ridePaymentPatch.earningsCreditedAt=now;
        ridePaymentPatch.driverEarningsStatus="available";
      }
      if(["refunded","amount_mismatch"].includes(next)||normalized.providerStatus==="disputed"){
        ridePaymentPatch.paymentReviewRequired=true;
        transaction.set(db.collection("paymentReconciliationIssues").doc("ride_payment_review_"+order.rideTripId),{
         orderId:intent.orderId,rideId:order.rideTripId,paymentIntentReference:intentReference,
         type:"ride_payment_provider_exception",status:"open",providerStatus:normalized.providerStatus||"unknown",
         createdAt:now,updatedAt:now},{merge:true});
      }
      transaction.set(rideRef,ridePaymentPatch,{merge:true});
    }
    if (order.transactionType === "send" && order.parcelJobId) {
      const parcelPaymentPatch = { paymentStatus: next, providerPaymentStatus: normalized.providerStatus || "unknown", updatedAt: now };
      if (next === "paid") { const scheduledMs = order.scheduledPickupAt?.toMillis?.() || 0; parcelPaymentPatch.paidAt = order.paidAt || now; parcelPaymentPatch.state = scheduledMs > Date.now() + 10 * 60_000 ? "scheduled" : "searching_driver"; }
      if (terminalFailure(next)) parcelPaymentPatch.state = "failed";
      transaction.set(db.collection("parcelJobs").doc(order.parcelJobId), parcelPaymentPatch, { merge: true });
      if (next === "paid") { const scheduledMs = order.scheduledPickupAt?.toMillis?.() || 0; const sendStatus = scheduledMs > Date.now() + 10 * 60_000 ? "scheduled" : "searching_driver"; transaction.set(orderRef, { sendStatus, status: sendStatus === "scheduled" ? "accepted" : "requested", merchantSettlementStatus: "not_applicable", platformSettlementStatus: "captured", updatedAt: now }, { merge: true }); }
    }

    if (allowed && current !== next) {
      if (next === "paid") {
        const driverShopping = order.shopping?.mode === "driver_shops";
        if (driverShopping) {
          transaction.set(orderRef, { merchantSettlementStatus: "awaiting_shopping_reconciliation", merchantSettlementUpdatedAt: now, "shopping.state": "funded", "shopping.fundedAt": now, "shopping.updatedAt": now, deliveryStatus: "awaiting_dispatch" }, { merge: true });
          if (order.deliveryJobId) transaction.set(db.collection("deliveryJobs").doc(order.deliveryJobId), { "shopping.state": "funded", state: "awaiting_dispatch", fundedAt: now, updatedAt: now }, { merge: true });
        } else if (order.transactionType === "ride") {
          transaction.set(orderRef, { merchantSettlementStatus: "not_applicable", platformSettlementStatus: "captured", merchantSettlementUpdatedAt: now }, { merge: true });
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

    const result = { deduplicated: false, orderId: intent.orderId, previousState: current, state: next, requestedState: requested, transitionApplied: allowed, amountMismatch, reservationReleased: released, driverShoppingDeliveryJobId: next === "paid" && order.shopping?.mode === "driver_shops" ? order.deliveryJobId || null : null, parcelJobId: next === "paid" && order.transactionType === "send" ? order.parcelJobId || null : null, parcelDispatchNow: next === "paid" && order.transactionType === "send" && !((order.scheduledPickupAt?.toMillis?.() || 0) > Date.now() + 10 * 60_000) };
    transaction.create(callbackRef, { provider: "paynow", paymentIntentReference: intentReference, orderId: intent.orderId, providerStatus: normalized.providerStatus || "unknown", providerReference: normalized.providerReference || "", result, processedAt: now });
    return result;
  });

  if (!result.deduplicated && result.transitionApplied && result.previousState !== result.state && result.state === "paid" && result.driverShoppingDeliveryJobId) {
    await dispatchDelivery({ db, messaging, deliveryJobId: result.driverShoppingDeliveryJobId, actorId: "paynow" }).catch(async (error) => {
      await db.collection("deliveryReconciliationIssues").add({ deliveryJobId: result.driverShoppingDeliveryJobId, orderId: result.orderId, type: "driver_shopping_dispatch_failed", status: "open", error: String(error?.message || "Dispatch failed").slice(0, 500), createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }).catch(() => null);
    });
  }
  if (!result.deduplicated && result.transitionApplied && result.previousState !== result.state && result.state === "paid" && result.parcelJobId && result.parcelDispatchNow) {
    await dispatchParcel({ db, messaging, parcelJobId: result.parcelJobId, actorId: "paynow" }).catch(async (error) => {
      await db.collection("deliveryReconciliationIssues").add({ parcelJobId: result.parcelJobId, orderId: result.orderId, type: "parcel_dispatch_failed", status: "open", error: String(error?.message || "Dispatch failed").slice(0, 500), createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }).catch(() => null);
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
      const isRide = order?.transactionType === "ride";
      const isSend = order?.transactionType === "send";
      const isScheduledSend = isSend && order?.sendStatus === "scheduled";
      if (paid) await qualifyReferralForCustomer(db, customerId, result.orderId).catch(() => null);
      if (paid || failed) {
        await notifyUser({
          db, messaging, auth, userId: customerId,
          title: paid ? "Payment confirmed" : "Payment needs attention",
          body: paid ? (isRide ? `Payment for ride ${number} is confirmed. Your receipt is available in Activity.` : isSend ? (isScheduledSend ? `Payment for ${number} is confirmed. Your scheduled pickup is confirmed.` : `Payment for ${number} is confirmed. Spotly is finding a courier now.`) : `Payment for order ${number} is confirmed. Your receipt and live order status are now available in Spotly.`) : (isRide ? `Payment for ride ${number} was not completed. Open Activity to try again.` : isSend ? `Payment for ${number} was not completed. Open Activity to try again.` : `Payment for order ${number} was not completed. Your basket is safe while Spotly shows the next available payment action.`),
          href: `/?view=activity&order=${encodeURIComponent(result.orderId)}`,
          category: "payment", workspace: "customer", module: isRide ? "rides" : isSend ? "send" : "money",
          eventType: paid ? "payment.confirmed" : "payment.attention", importance: paid ? "high" : "normal",
          businessId: order?.businessId || null, entityType: "order", entityId: result.orderId,
          email: true, forceOperationalEmail: paid
        }).catch(() => null);
      }
    }
  }
  return result;
}

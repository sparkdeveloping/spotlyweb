import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { cancellationDeadlineMs } from "@/lib/book-live-domain";
import { releaseReservationInTransaction } from "@/lib/order-reservations-server";
import { revokeTicketEntitlementsInTransaction } from "@/lib/ticket-entitlements-server";
import { safeText } from "@/lib/server-helpers";
import { enforceRateLimit } from "@/lib/rate-limit-server";

export const runtime = "nodejs";

const schema = z.object({ orderId: z.string().min(3).max(180), reason: z.string().min(3).max(500) }).strict();
const CANCELLABLE = new Set(["awaiting_payment", "submitted", "new", "requested", "accepted", "confirmed", "scheduled", "issued", "ready"]);

export async function POST(request) {
  try {
    const rate = await enforceRateLimit(request, { key: "customer-book-live-cancel", limit: 20, windowMs: 60_000 });
    const user = await authenticateRequest(request);
    const body = schema.parse(await request.json());
    const { db } = getAdminServices();
    const orderRef = db.collection("orders").doc(body.orderId);
    const refundRef = db.collection("refundRequests").doc(`customer_cancel_${body.orderId}`);

    const result = await db.runTransaction(async (transaction) => {
      const orderSnapshot = await transaction.get(orderRef);
      if (!orderSnapshot.exists) throw Object.assign(new Error("The reservation was not found."), { status: 404 });
      const order = orderSnapshot.data() || {};
      if (order.customerId !== user.uid) throw Object.assign(new Error("You can only cancel your own reservation."), { status: 403 });
      const kind = String(order.transactionType || "");
      if (!["appointment", "booking", "ticket"].includes(kind)) throw Object.assign(new Error("Use the standard cancellation flow for this activity."), { status: 409 });
      if (!CANCELLABLE.has(String(order.status || ""))) throw Object.assign(new Error("This reservation can no longer be cancelled online."), { status: 409 });
      const productId = order.items?.[0]?.productId;
      const productRef = productId ? db.collection("products").doc(productId) : null;
      const productSnapshot = productRef ? await transaction.get(productRef) : null;
      const product = productSnapshot?.exists ? productSnapshot.data() || {} : {};
      const deadline = cancellationDeadlineMs({ kind, product, order });
      const organizerCancelledEvent = kind === "ticket" && order.event?.cancelled === true;
      if (!organizerCancelledEvent && Number.isFinite(deadline) && Date.now() >= deadline) throw Object.assign(new Error("Online cancellation has closed for this reservation. Contact Spotly Support for help."), { status: 409 });

      const paid = order.paymentStatus === "paid";
      const total = Number(order.totals?.total ?? order.total ?? 0);
      const intentRef = paid && order.paymentIntentReference ? db.collection("paymentIntents").doc(order.paymentIntentReference) : null;
      const refundSnapshot = paid ? await transaction.get(refundRef) : null;
      if (intentRef) await transaction.get(intentRef);

      const cancellationReason = safeText(body.reason, 500);
      const orderPatch = {
        cancellationReason,
        cancelledBy: user.uid,
        cancelledAt: FieldValue.serverTimestamp(),
        ...(paid ? { paymentStatus: "refund_pending", refundRequestId: refundRef.id } : {})
      };
      await releaseReservationInTransaction(transaction, db, orderRef, order, {
        reason: paid ? "refund_before_fulfilment" : "customer_cancelled",
        actorId: user.uid,
        nextStatus: "cancelled",
        source: "customer_book_live_cancel",
        orderPatch
      });
      if (kind === "ticket") revokeTicketEntitlementsInTransaction(transaction, db, orderRef, order, { reason: "customer_cancelled" });

      if (paid) {
        if (!refundSnapshot?.exists) {
          transaction.create(refundRef, {
            orderId: body.orderId,
            paymentIntentReference: order.paymentIntentReference || null,
            amount: Number(total.toFixed(2)),
            currency: order.currency || "USD",
            reason: cancellationReason,
            status: "refund_requested",
            requestedBy: user.uid,
            requestedByType: "customer",
            requestedAt: FieldValue.serverTimestamp(),
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          });
        }
        if (intentRef) transaction.set(intentRef, { status: "refund_pending", refundRequestId: refundRef.id, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      }

      transaction.create(db.collection("notifications").doc(), { userId: user.uid, businessId: order.businessId || "", orderId: body.orderId, title: paid ? "Cancellation received · refund pending" : "Reservation cancelled", body: paid ? `Spotly recorded the cancellation for ${order.number || body.orderId.slice(0, 8)} and opened the refund workflow.` : `${order.number || body.orderId.slice(0, 8)} is cancelled.`, href: `/?view=activity&order=${body.orderId}`, category: kind, workspace: "customer", module: kind === "ticket" ? "events" : "book", eventType: `${kind}.cancelled`, read: false, createdAt: FieldValue.serverTimestamp() });
      return { kind, status: "cancelled", paymentStatus: paid ? "refund_pending" : order.paymentStatus || "not_required", refundId: paid ? refundRef.id : null };
    });

    return Response.json({ ok: true, orderId: body.orderId, ...result }, { headers: { "X-RateLimit-Remaining": String(rate.remaining) } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Enter a cancellation reason." }, { status: 400 });
    return apiError(error);
  }
}

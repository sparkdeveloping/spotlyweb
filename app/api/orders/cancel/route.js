import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { releaseReservationInTransaction } from "@/lib/order-reservations-server";
import { safeText } from "@/lib/server-helpers";

export const runtime = "nodejs";
const schema = z.object({ orderId: z.string().min(3).max(180), reason: z.string().min(3).max(500) });
const CANCELLABLE = new Set(["awaiting_payment", "submitted", "new", "requested", "confirmed", "accepted"]);

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const body = schema.parse(await request.json());
    const { db } = getAdminServices();
    const orderRef = db.collection("orders").doc(body.orderId);
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(orderRef);
      if (!snapshot.exists) throw Object.assign(new Error("The order was not found."), { status: 404 });
      const order = snapshot.data();
      if (order.customerId !== user.uid) throw Object.assign(new Error("You can only cancel your own order."), { status: 403 });
      if (!CANCELLABLE.has(order.status)) throw Object.assign(new Error("This order can no longer be cancelled online."), { status: 409 });
      if (["paid", "refund_pending", "refunded"].includes(order.paymentStatus)) throw Object.assign(new Error("This paid order requires a refund request. Contact support."), { status: 409 });
      if (order.pickup?.date && order.pickup?.slot) {
        const branchRef = db.collection("branches").doc(order.branchId);
        const branchSnapshot = await transaction.get(branchRef);
        const branch = branchSnapshot.exists ? branchSnapshot.data() : {};
        const cutoffMinutes = Math.max(0, Number(branch.pickup?.cancellationCutoffMinutes ?? branch.cancellationCutoffMinutes ?? 60));
        const start = String(order.pickup.slot).match(/(\d{1,2}):(\d{2})/)?.slice(1);
        if (start) {
          const pickupAt = new Date(`${order.pickup.date}T${start[0].padStart(2, "0")}:${start[1]}:00+02:00`).getTime();
          if (Number.isFinite(pickupAt) && Date.now() > pickupAt - cutoffMinutes * 60_000) {
            throw Object.assign(new Error(`Online cancellation closes ${cutoffMinutes} minutes before pickup. Contact support for help.`), { status: 409 });
          }
        }
      }
      await releaseReservationInTransaction(transaction, db, orderRef, order, {
        reason: "customer_cancelled",
        actorId: user.uid,
        nextStatus: "cancelled",
        source: "customer_cancel",
        orderPatch: { cancellationReason: safeText(body.reason, 500), cancelledBy: user.uid, cancelledAt: FieldValue.serverTimestamp() }
      });
    });
    return Response.json({ ok: true, orderId: body.orderId, status: "cancelled" });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Enter a cancellation reason." }, { status: 400 });
    return apiError(error);
  }
}

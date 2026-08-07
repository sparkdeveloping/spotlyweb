import { FieldValue } from "firebase-admin/firestore";
import { apiError, getAdminServices } from "@/lib/firebase-admin";
import { createPaynow, normalizePaynowStatus } from "@/lib/paynow-server";
import { releaseOrderReservation } from "@/lib/order-reservations-server";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const raw = await request.text();
    const currencyHint = new URL(request.url).searchParams.get("currency") === "ZWG" ? "ZWG" : "USD";
    const paynow = await createPaynow(currencyHint);
    const parsed = paynow.parseStatusUpdate(raw);
    const normalized = normalizePaynowStatus(parsed);
    if (!normalized.reference) throw Object.assign(new Error("The Paynow result did not include a merchant reference."), { status: 400 });

    const { db } = getAdminServices();
    const intentRef = db.collection("paymentIntents").doc(normalized.reference);
    const intentSnapshot = await intentRef.get();
    if (!intentSnapshot.exists) throw Object.assign(new Error("The payment intent was not found."), { status: 404 });
    const intent = intentSnapshot.data();

    if (normalized.amount && Math.abs(normalized.amount - Number(intent.amount)) > 0.01) {
      await intentRef.set({ status: "amount_mismatch", providerStatus: normalized.providerStatus, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return new Response("Amount mismatch", { status: 409 });
    }

    const orderRef = db.collection("orders").doc(intent.orderId);
    await db.runTransaction(async (transaction) => {
      transaction.set(intentRef, {
        status: normalized.state,
        providerStatus: normalized.providerStatus,
        providerReference: normalized.providerReference || "",
        webhookReceivedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      const orderUpdate = {
        paymentStatus: normalized.paid ? "paid" : normalized.state,
        paidAt: normalized.paid ? FieldValue.serverTimestamp() : null,
        updatedAt: FieldValue.serverTimestamp()
      };
      if (normalized.paid) orderUpdate.status = "confirmed";
      transaction.set(orderRef, orderUpdate, { merge: true });
      transaction.create(db.collection("orderEvents").doc(), {
        orderId: intent.orderId,
        type: normalized.paid ? "payment_confirmed" : "payment_status_updated",
        status: normalized.state,
        actorId: "paynow",
        metadata: { reference: normalized.reference, providerReference: normalized.providerReference },
        createdAt: FieldValue.serverTimestamp()
      });
    });

    if (["failed", "cancelled", "expired"].includes(normalized.state)) {
      await releaseOrderReservation(intent.orderId, { reason: normalized.state === "expired" ? "payment_expired" : "payment_failed", status: normalized.state === "expired" ? "expired" : "payment_failed", actorId: "paynow" }).catch(() => null);
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    return apiError(error);
  }
}

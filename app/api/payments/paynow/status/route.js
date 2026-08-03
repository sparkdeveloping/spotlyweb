import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { createPaynow, normalizePaynowStatus } from "@/lib/paynow-server";

export const runtime = "nodejs";

const schema = z.object({ orderId: z.string().min(3).max(180) });

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const body = schema.parse(await request.json());
    const { db } = getAdminServices();
    const orderRef = db.collection("orders").doc(body.orderId);
    const orderSnapshot = await orderRef.get();
    if (!orderSnapshot.exists) throw Object.assign(new Error("The order was not found."), { status: 404 });
    const order = orderSnapshot.data();
    const allowed = order.customerId === user.uid || user.profile?.roles?.some((role) => ["super_admin", "admin", "finance_admin", "support_agent"].includes(role));
    if (!allowed) throw Object.assign(new Error("You cannot inspect this payment."), { status: 403 });

    if (!order.paymentIntentReference) {
      return Response.json({ ok: true, orderId: body.orderId, state: order.paymentStatus || "unpaid" });
    }

    const intentRef = db.collection("paymentIntents").doc(order.paymentIntentReference);
    const intentSnapshot = await intentRef.get();
    if (!intentSnapshot.exists) throw Object.assign(new Error("The payment record was not found."), { status: 404 });
    const intent = intentSnapshot.data();
    const paynow = await createPaynow(intent.currency);
    const providerStatus = await paynow.pollTransaction(intent.pollUrl);
    const normalized = normalizePaynowStatus(providerStatus);

    if (normalized.amount && Math.abs(normalized.amount - Number(intent.amount)) > 0.01) {
      await intentRef.set({ status: "amount_mismatch", providerStatus: normalized.providerStatus, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      throw Object.assign(new Error("The payment amount did not match the order total."), { status: 409 });
    }

    await db.runTransaction(async (transaction) => {
      transaction.set(intentRef, {
        status: normalized.state,
        providerStatus: normalized.providerStatus,
        providerReference: normalized.providerReference || intent.providerReference || "",
        checkedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      transaction.set(orderRef, {
        paymentStatus: normalized.paid ? "paid" : normalized.state,
        paidAt: normalized.paid ? FieldValue.serverTimestamp() : order.paidAt || null,
        status: normalized.paid && order.status === "awaiting_payment" ? "confirmed" : order.status,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    });

    return Response.json({ ok: true, orderId: body.orderId, ...normalized });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "The order identifier is invalid." }, { status: 400 });
    return apiError(error);
  }
}

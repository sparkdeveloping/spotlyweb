import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { createPaynow, paynowChargeLines } from "@/lib/paynow-server";
import { appUrl, normalizeZimbabwePhone } from "@/lib/server-helpers";
import { hasPlatformPermission, isPlatformAdmin } from "@/lib/access-control-server";

export const runtime = "nodejs";

const schema = z.object({
  orderId: z.string().min(3).max(180),
  channel: z.enum(["web", "ecocash", "onemoney"]).default("web"),
  phone: z.string().max(40).optional(),
  client: z.enum(["web", "ios"]).default("web")
});

function livePending(state) { return ["initiated", "pending"].includes(state); }

export async function POST(request) {
  let lockRef = null;
  let reference = null;
  let recoveryOrderId = null;
  let providerAccepted = false;
  try {
    const user = await authenticateRequest(request);
    const body = schema.parse(await request.json());
    recoveryOrderId = body.orderId;
    const { db } = getAdminServices();
    const orderRef = db.collection("orders").doc(body.orderId);
    const lock = db.collection("paymentInitiationLocks").doc(body.orderId);
    lockRef = lock;

    const prepared = await db.runTransaction(async (transaction) => {
      const orderSnapshot = await transaction.get(orderRef);
      if (!orderSnapshot.exists) throw Object.assign(new Error("The order was not found."), { status: 404 });
      const order = orderSnapshot.data();
      const allowed = order.customerId === user.uid || isPlatformAdmin(user) || hasPlatformPermission(user, "finance.payments") || user.profile?.roles?.includes("finance_admin");
      if (!allowed) throw Object.assign(new Error("You cannot pay for this order."), { status: 403 });
      if (["paid", "refund_pending", "refunded"].includes(order.paymentStatus)) throw Object.assign(new Error("This order no longer requires payment."), { status: 409 });

      if (order.paymentIntentReference && livePending(order.paymentStatus)) {
        const existingRef = db.collection("paymentIntents").doc(order.paymentIntentReference);
        const existingSnapshot = await transaction.get(existingRef);
        if (existingSnapshot.exists) {
          const existing = existingSnapshot.data();
          if (existing.status === "pending" && (existing.redirectUrl || existing.instructions)) {
            return { reuse: true, intent: { reference: existingRef.id, ...existing } };
          }
          if (existing.status === "initiated") throw Object.assign(new Error("Payment setup is already in progress. Try again in a moment."), { status: 409 });
        }
      }

      const lockSnapshot = await transaction.get(lock);
      if (lockSnapshot.exists) {
        const value = lockSnapshot.data();
        const lease = value.leaseUntil?.toDate?.() || (value.leaseUntil ? new Date(value.leaseUntil) : null);
        if (value.state === "creating" && lease && lease.getTime() > Date.now()) throw Object.assign(new Error("Payment setup is already in progress. Try again in a moment."), { status: 409 });
      }

      const currency = order.currency === "ZWG" ? "ZWG" : "USD";
      const total = Number(order.totals?.total ?? order.total ?? 0);
      if (!Number.isFinite(total) || total <= 0) throw Object.assign(new Error("The order total is invalid."), { status: 422 });
      reference = `SPOTLY-${body.orderId.slice(0, 18)}-${Date.now().toString(36).toUpperCase()}`;
      const intentRef = db.collection("paymentIntents").doc(reference);
      transaction.create(intentRef, {
        provider: "paynow",
        reference,
        orderId: body.orderId,
        customerId: user.uid,
        customerEmail: user.email || "",
        businessId: order.businessId || null,
        branchId: order.branchId || null,
        currency,
        amount: total,
        breakdown: order.totals || { total },
        channel: body.channel,
        client: body.client,
        phone: body.phone ? normalizeZimbabwePhone(body.phone) : "",
        status: "initiated",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
      transaction.set(orderRef, { paymentMethod: body.channel === "web" ? "paynow" : body.channel, paymentStatus: "initiated", paymentIntentReference: reference, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      transaction.set(lock, { state: "creating", reference, leaseUntil: new Date(Date.now() + 120000), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return { reuse: false, order: { id: body.orderId, ...order }, currency, total, reference };
    });

    if (prepared.reuse) {
      const intent = prepared.intent;
      return Response.json({ ok: true, reused: true, orderId: body.orderId, reference: intent.reference, channel: intent.channel, redirectUrl: intent.redirectUrl || null, instructions: intent.instructions || null, status: intent.status || "pending" });
    }

    const paynow = await createPaynow(prepared.currency);
    const baseUrl = appUrl(request);
    paynow.resultUrl = `${baseUrl}/api/payments/paynow/result?currency=${prepared.currency}`;
    paynow.returnUrl = `${baseUrl}/payment/return?orderId=${encodeURIComponent(body.orderId)}&client=${encodeURIComponent(body.client)}`;
    const payment = paynow.createPayment(prepared.reference, user.email || prepared.order.customerEmail || "customer@spotly.co.zw");
    for (const line of paynowChargeLines(prepared.order)) payment.add(line.name, line.amount);

    const response = body.channel === "web"
      ? await paynow.send(payment)
      : await paynow.sendMobile(payment, normalizeZimbabwePhone(body.phone), body.channel);
    if (!response?.success) throw Object.assign(new Error(response?.error || "Paynow declined the payment request."), { status: 502 });
    providerAccepted = true;

    const intentRef = db.collection("paymentIntents").doc(prepared.reference);
    await db.runTransaction(async (transaction) => {
      const [orderSnapshot, intentSnapshot, lockSnapshot] = await Promise.all([transaction.get(orderRef), transaction.get(intentRef), transaction.get(lock)]);
      if (!orderSnapshot.exists || !intentSnapshot.exists) throw Object.assign(new Error("The payment record could not be finalized."), { status: 409 });
      if (!lockSnapshot.exists || lockSnapshot.data().reference !== prepared.reference) throw Object.assign(new Error("The payment initiation lock changed unexpectedly."), { status: 409 });
      const order = orderSnapshot.data();
      if (["paid", "refund_pending", "refunded"].includes(order.paymentStatus)) throw Object.assign(new Error("The order payment was already finalized."), { status: 409 });
      transaction.set(intentRef, {
        status: "pending",
        pollUrl: response.pollUrl || "",
        redirectUrl: response.redirectUrl || "",
        instructions: response.instructions || "",
        providerReference: response.paynowReference || "",
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      transaction.set(orderRef, { paymentStatus: "pending", paymentIntentReference: prepared.reference, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      transaction.set(lock, { state: "ready", reference: prepared.reference, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      transaction.create(db.collection("orderEvents").doc(), {
        orderId: body.orderId,
        type: "payment_initiated",
        previousStatus: order.status || null,
        status: order.status || null,
        actorType: "customer",
        actorId: user.uid,
        source: "paynow_initiate",
        metadata: { provider: "paynow", reference: prepared.reference, channel: body.channel, client: body.client, amount: prepared.total, currency: prepared.currency },
        createdAt: FieldValue.serverTimestamp()
      });
    });

    return Response.json({ ok: true, reused: false, orderId: body.orderId, reference: prepared.reference, channel: body.channel, redirectUrl: response.redirectUrl || null, instructions: response.instructions || null, status: "pending" });
  } catch (error) {
    if (lockRef && reference) {
      try {
        const { db } = getAdminServices();
        const orderRef = recoveryOrderId ? db.collection("orders").doc(recoveryOrderId) : null;
        if (providerAccepted) {
          await db.collection("paymentIntents").doc(reference).set({ initiationFinalizeError: String(error?.message || "Payment initiation could not be finalized").slice(0, 300), updatedAt: FieldValue.serverTimestamp() }, { merge: true }).catch(() => null);
          await db.collection("paymentReconciliationIssues").add({ orderId: recoveryOrderId, paymentIntentReference: reference, type: "initiation_finalize_error", status: "open", createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }).catch(() => null);
          await lockRef.set({ state: "provider_accepted", reference, updatedAt: FieldValue.serverTimestamp() }, { merge: true }).catch(() => null);
        } else {
          await db.collection("paymentIntents").doc(reference).set({ status: "failed", initiationError: String(error?.message || "Payment initiation failed").slice(0, 300), updatedAt: FieldValue.serverTimestamp() }, { merge: true }).catch(() => null);
          await lockRef.set({ state: "failed", reference, updatedAt: FieldValue.serverTimestamp() }, { merge: true }).catch(() => null);
          if (orderRef) await orderRef.set({ paymentStatus: "unpaid", paymentIntentReference: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }, { merge: true }).catch(() => null);
        }
      } catch {}
    }
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "The payment request is incomplete.", details: error.flatten() }, { status: 400 });
    return apiError(error);
  }
}

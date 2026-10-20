import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { createPaynow, normalizePaynowStatus } from "@/lib/paynow-server";
import { applyProviderPaymentUpdate } from "@/lib/payment-processor-server";
import {trustedPaynowUrl} from "@/lib/assist-payment-url";
import { hasPlatformPermission, isPlatformAdmin } from "@/lib/access-control-server";

export const runtime = "nodejs";
const schema = z.object({ orderId: z.string().min(3).max(180) });

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const body = schema.parse(await request.json());
    const { db, messaging, auth } = getAdminServices();
    const orderRef = db.collection("orders").doc(body.orderId);
    const orderSnapshot = await orderRef.get();
    if (!orderSnapshot.exists) throw Object.assign(new Error("The order was not found."), { status: 404 });
    const order = orderSnapshot.data();
    const allowed = order.customerId === user.uid || isPlatformAdmin(user) || hasPlatformPermission(user, "finance.read") || hasPlatformPermission(user, "orders.read");
    if (!allowed) throw Object.assign(new Error("You cannot inspect this payment."), { status: 403 });

    const activity = { transactionType: order.transactionType || null, fulfilment: order.fulfilment || null, businessName: order.businessName || "", number: order.number || order.orderNumber || "" };
    if (!order.paymentIntentReference) return Response.json({ ok: true, orderId: body.orderId, state: order.paymentStatus || "unpaid", ...activity });
    const intentSnapshot = await db.collection("paymentIntents").doc(order.paymentIntentReference).get();
    if (!intentSnapshot.exists) throw Object.assign(new Error("The payment record was not found."), { status: 404 });
    const intent = intentSnapshot.data();
    if (!intent.pollUrl) return Response.json({ ok: true, orderId: body.orderId, state: intent.status || order.paymentStatus || "initiated", providerStatus: intent.providerStatus || "", ...activity });

    if(!trustedPaynowUrl(intent.pollUrl))throw Object.assign(new Error("Payment polling URL requires Finance review."),{status:409});
    const paynow = await createPaynow(intent.currency);
    const providerStatus = await paynow.pollTransaction(intent.pollUrl);
    const normalized = normalizePaynowStatus(providerStatus);
    normalized.reference = normalized.reference || order.paymentIntentReference;
    const applied = await applyProviderPaymentUpdate(db, order.paymentIntentReference, normalized, { source: "paynow_status_poll", messaging, auth });
    return Response.json({ ok: true, orderId: body.orderId, ...normalized, state: applied.state, transitionApplied: applied.transitionApplied, amountMismatch: applied.amountMismatch, deduplicated: applied.deduplicated, ...activity });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "The order identifier is invalid." }, { status: 400 });
    return apiError(error);
  }
}

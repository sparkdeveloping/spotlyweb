import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { createPaynow } from "@/lib/paynow-server";
import { appUrl, normalizeZimbabwePhone, safeText } from "@/lib/server-helpers";

export const runtime = "nodejs";

const schema = z.object({
  orderId: z.string().min(3).max(180),
  channel: z.enum(["web", "ecocash", "onemoney"]).default("web"),
  phone: z.string().max(40).optional()
});

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const body = schema.parse(await request.json());
    const { db } = getAdminServices();
    const orderRef = db.collection("orders").doc(body.orderId);
    const orderSnapshot = await orderRef.get();
    if (!orderSnapshot.exists) throw Object.assign(new Error("The order was not found."), { status: 404 });

    const order = orderSnapshot.data();
    const allowed = order.customerId === user.uid || user.profile?.roles?.some((role) => ["super_admin", "admin", "finance_admin"].includes(role));
    if (!allowed) throw Object.assign(new Error("You cannot pay for this order."), { status: 403 });
    if (["paid", "refunded"].includes(order.paymentStatus)) {
      throw Object.assign(new Error("This order no longer requires payment."), { status: 409 });
    }

    const currency = order.currency === "ZWG" ? "ZWG" : "USD";
    const total = Number(order.totals?.total ?? order.total ?? 0);
    if (!Number.isFinite(total) || total <= 0) throw Object.assign(new Error("The order total is invalid."), { status: 422 });

    const reference = `SPOTLY-${body.orderId.slice(0, 18)}-${Date.now().toString(36).toUpperCase()}`;
    const paynow = await createPaynow(currency);
    const baseUrl = appUrl(request);
    paynow.resultUrl = `${baseUrl}/api/payments/paynow/result?currency=${currency}`;
    paynow.returnUrl = `${baseUrl}/payment/return?orderId=${encodeURIComponent(body.orderId)}`;

    const payment = paynow.createPayment(reference, user.email || order.customerEmail || "customer@spotly.co.zw");
    const items = Array.isArray(order.items) && order.items.length ? order.items : [{ name: `Spotly order ${body.orderId}`, lineTotal: total }];
    for (const item of items) {
      const lineTotal = Number(item.lineTotal ?? Number(item.unitPrice || 0) * Number(item.quantity || 1));
      if (lineTotal > 0) payment.add(safeText(item.name || "Order item", 120), Number(lineTotal.toFixed(2)));
    }

    const response = body.channel === "web"
      ? await paynow.send(payment)
      : await paynow.sendMobile(payment, normalizeZimbabwePhone(body.phone), body.channel);

    if (!response?.success) {
      throw Object.assign(new Error(response?.error || "Paynow declined the payment request."), { status: 502 });
    }

    const intentRef = db.collection("paymentIntents").doc(reference);
    await db.runTransaction(async (transaction) => {
      transaction.set(intentRef, {
        provider: "paynow",
        reference,
        orderId: body.orderId,
        customerId: user.uid,
        customerEmail: user.email || "",
        businessId: order.businessId || null,
        branchId: order.branchId || null,
        currency,
        amount: total,
        channel: body.channel,
        phone: body.phone ? normalizeZimbabwePhone(body.phone) : "",
        pollUrl: response.pollUrl,
        providerReference: response.paynowReference || "",
        status: "initiated",
        instructions: response.instructions || "",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
      transaction.set(orderRef, {
        paymentMethod: body.channel === "web" ? "paynow" : body.channel,
        paymentStatus: "pending",
        paymentIntentReference: reference,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      transaction.create(db.collection("orderEvents").doc(), {
        orderId: body.orderId,
        type: "payment_initiated",
        status: "pending",
        actorId: user.uid,
        metadata: { provider: "paynow", reference, channel: body.channel },
        createdAt: FieldValue.serverTimestamp()
      });
    });

    return Response.json({
      ok: true,
      orderId: body.orderId,
      reference,
      channel: body.channel,
      redirectUrl: response.redirectUrl || null,
      instructions: response.instructions || null,
      status: "pending"
    });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "The payment request is incomplete.", details: error.flatten() }, { status: 400 });
    return apiError(error);
  }
}

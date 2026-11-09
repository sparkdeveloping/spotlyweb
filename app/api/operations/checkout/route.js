import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { requireOperationGrant } from "@/lib/operations-grants-server";
import { normalizeCountryCode } from "@/lib/country-engine";
import { marketplaceProfile } from "@/lib/marketplace-taxonomy";
import { branchPaymentMethods } from "@/lib/pickup-availability";
import { buildOrderTotals } from "@/lib/order-money";
import { safeText } from "@/lib/server-helpers";

export const runtime = "nodejs";

const schema = z.object({
  businessId: z.string().min(1).max(180),
  branchId: z.string().min(1).max(180),
  currency: z.enum(["USD", "ZWG", "MWK"]),
  fulfilment: z.enum(["pickup", "delivery"]).default("pickup"),
  paymentMethod: z.string().min(1).max(40),
  simulatePayment: z.boolean().default(false),
  items: z.array(z.object({ productId: z.string().min(1).max(180), quantity: z.number().int().min(1).max(99) })).min(1).max(60)
}).strict();

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    await enforceRateLimit(request, { key: "operations-checkout", limit: 24, windowMs: 60_000, identity: user.uid });
    const body = schema.parse(await request.json());
    const { db } = getAdminServices();
    const requested = new Map(body.items.map((item) => [item.productId, item.quantity]));
    const [businessSnap, branchSnap, ...productSnaps] = await Promise.all([
      db.collection("businesses").doc(body.businessId).get(),
      db.collection("branches").doc(body.branchId).get(),
      ...[...requested.keys()].map((id) => db.collection("products").doc(id).get())
    ]);
    if (!businessSnap.exists) throw Object.assign(new Error("Choose a real Spotly business for this Operations run."), { status: 404 });
    if (!branchSnap.exists || branchSnap.data()?.businessId !== body.businessId) throw Object.assign(new Error("Choose a real location for this Operations run."), { status: 422 });
    const business = businessSnap.data() || {};
    const branch = branchSnap.data() || {};
    const country = normalizeCountryCode(branch.country || business.country);
    const service = marketplaceProfile(business).service;
    if (!["eat", "shop"].includes(service)) throw Object.assign(new Error("Operations checkout currently supports Bite and Shopper catalogues."), { status: 409 });
    await requireOperationGrant(db, user.uid, { type: "service_operations", service, country, city: branch.city || business.city || "" });
    if (body.simulatePayment) await requireOperationGrant(db, user.uid, { type: "payment_sandbox", service, country, city: branch.city || business.city || "" });

    const paymentMethods = branchPaymentMethods(branch);
    if (!paymentMethods.includes(body.paymentMethod)) throw Object.assign(new Error("Use a payment method actually configured for this location."), { status: 422 });
    if (body.fulfilment === "delivery" && (!branch.delivery?.enabled || branch.delivery?.paused || !(branch.fulfilment || []).includes("delivery"))) {
      throw Object.assign(new Error("Delivery is not configured for this real location."), { status: 409 });
    }
    if (body.fulfilment === "pickup" && branch.fulfilment?.length && !branch.fulfilment.includes("pickup")) {
      throw Object.assign(new Error("Pickup is not configured for this real location."), { status: 409 });
    }

    const lines = productSnaps.map((snapshot) => {
      if (!snapshot.exists) throw Object.assign(new Error("One selected product no longer exists."), { status: 409 });
      const product = snapshot.data() || {};
      const quantity = requested.get(snapshot.id);
      if (product.businessId !== body.businessId || product.status === "archived" || product.available === false || product.active === false || (product.branchIds?.length && !product.branchIds.includes(body.branchId))) {
        throw Object.assign(new Error(`${safeText(product.name || "A product", 80)} is not configured for this location.`), { status: 409 });
      }
      const unitPrice = Number(product.prices?.[body.currency] ?? (product.currency === body.currency || !product.currency ? product.price : undefined));
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) throw Object.assign(new Error(`${safeText(product.name || "A product", 80)} has no valid ${body.currency} price.`), { status: 409 });
      return { productId: snapshot.id, name: safeText(product.name, 160), quantity, unitPrice, lineTotal: Number((unitPrice * quantity).toFixed(2)) };
    });
    const subtotal = Number(lines.reduce((sum, line) => sum + line.lineTotal, 0).toFixed(2));
    const deliveryFee = body.fulfilment === "delivery" ? Number(Math.max(0, Number(branch.delivery?.fee || 0)).toFixed(2)) : 0;
    const totals = buildOrderTotals({ subtotal, deliveryFee, commissionPercent: 0 });
    const ref = db.collection("operationsRuns").doc();
    await ref.create({
      kind: "checkout", mode: "operations", operations: true, customerId: user.uid,
      service, country, city: branch.city || business.city || "", businessId: body.businessId, branchId: body.branchId,
      businessName: safeText(business.name || "Business", 160), branchName: safeText(branch.branchName || branch.name || "Location", 160),
      items: lines, currency: body.currency, fulfilment: body.fulfilment, paymentMethod: body.paymentMethod,
      paymentSimulation: body.simulatePayment ? { requested: true, status: "simulated_success", providerCalled: false, fundsMoved: false } : { requested: false, status: "not_run", providerCalled: false, fundsMoved: false },
      totals, state: body.simulatePayment ? "payment_simulated" : "validated",
      financialIsolation: true, inventoryIsolation: true, productionCollectionsUntouched: true,
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
    });
    return Response.json({ ok: true, operations: true, runId: ref.id, state: body.simulatePayment ? "payment_simulated" : "validated", service, totals, payment: body.simulatePayment ? { simulated: true, charged: false, providerCalled: false } : { simulated: false, charged: false, providerCalled: false } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the Operations checkout details." }, { status: 400 });
    return apiError(error);
  }
}

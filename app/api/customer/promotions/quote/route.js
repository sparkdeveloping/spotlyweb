import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { safeText } from "@/lib/server-helpers";
import { quoteBusinessPromotion } from "@/lib/promotion-server";

export const runtime = "nodejs";

const schema = z.object({
  businessId: z.string().min(1).max(180),
  branchId: z.string().min(1).max(180),
  currency: z.enum(["USD", "ZWG"]).default("USD"),
  code: z.string().max(40).optional(),
  items: z.array(z.object({ productId: z.string().min(1).max(180), quantity: z.number().int().min(1).max(99) })).min(1).max(60)
});

export async function POST(request) {
  try {
    const rate = await enforceRateLimit(request, { key: "customer-promotion-quote", limit: 60, windowMs: 60_000 });
    const user = await authenticateRequest(request);
    const body = schema.parse(await request.json());
    const { db } = getAdminServices();
    const requested = new Map(body.items.map((item) => [item.productId, item.quantity]));
    const [business, branch, priorOrders, ...products] = await Promise.all([
      db.collection("businesses").doc(body.businessId).get(),
      db.collection("branches").doc(body.branchId).get(),
      db.collection("orders").where("customerId", "==", user.uid).limit(1).get(),
      ...[...requested.keys()].map((id) => db.collection("products").doc(id).get())
    ]);
    if (!business.exists || business.data()?.public !== true) throw Object.assign(new Error("This business is not available."), { status: 404 });
    if (!branch.exists || branch.data()?.businessId !== body.businessId) throw Object.assign(new Error("Choose a valid business location."), { status: 422 });
    const lines = products.map((snapshot) => {
      if (!snapshot.exists) throw Object.assign(new Error("One of the selected items is no longer available."), { status: 409 });
      const product = snapshot.data() || {};
      const quantity = requested.get(snapshot.id);
      const unitPrice = Number(product.prices?.[body.currency] ?? (product.currency === body.currency || !product.currency ? product.price : undefined));
      if (product.businessId !== body.businessId || product.available === false || product.active === false || !Number.isFinite(unitPrice) || unitPrice <= 0) throw Object.assign(new Error(`${safeText(product.name || "An item", 80)} is not available for this promotion quote.`), { status: 409 });
      return { productId: snapshot.id, quantity, lineTotal: Number((unitPrice * quantity).toFixed(2)) };
    });
    const roles = user.profile?.roles || [];
    const privateBeta = user.profile?.privateBeta === true || roles.some((role) => ["super_admin", "platform_admin", "operations_manager", "support_manager"].includes(role));
    const result = await quoteBusinessPromotion(db, { businessId: body.businessId, branchId: body.branchId, currency: body.currency, lines, code: body.code || "", isNewCustomer: priorOrders.empty, privateBeta });
    if (body.code && !result?.quote?.eligible) throw Object.assign(new Error(result?.quote?.reason || "That promotion could not be applied."), { status: 409 });
    return Response.json({ ok: true, applied: Boolean(result?.quote?.eligible), promotion: result?.quote?.eligible ? { id: result.promotion.id, name: result.promotion.name || result.quote.label, code: result.quote.code, discount: result.quote.discount, label: result.quote.label } : null }, { headers: { "X-RateLimit-Remaining": String(rate.remaining), "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the promotion details." }, { status: 400 });
    return apiError(error);
  }
}

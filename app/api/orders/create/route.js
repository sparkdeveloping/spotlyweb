import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { safeText } from "@/lib/server-helpers";

export const runtime = "nodejs";

const itemSchema = z.object({ productId: z.string().min(1).max(180), quantity: z.number().int().min(1).max(99) });
const schema = z.object({
  businessId: z.string().min(1).max(180),
  branchId: z.string().min(1).max(180),
  items: z.array(itemSchema).min(1).max(60),
  currency: z.enum(["USD", "ZWG"]).default("USD"),
  paymentMethod: z.enum(["cash", "paynow", "ecocash", "onemoney", "card", "bank_transfer"]),
  pickup: z.object({
    date: z.string().min(8).max(20),
    slot: z.string().min(3).max(40),
    contactName: z.string().min(2).max(120),
    contactPhone: z.string().min(7).max(40),
    notes: z.string().max(500).optional(),
    substitutionPreference: z.enum(["contact_me", "best_match", "no_substitutions"]).default("contact_me")
  })
});

function orderNumber() {
  const date = new Date();
  const ymd = date.toISOString().slice(0, 10).replaceAll("-", "");
  return `SP-${ymd}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const body = schema.parse(await request.json());
    if (!user.email) throw Object.assign(new Error("Add and verify an email-and-password sign-in before ordering."), { status: 409 });

    const { auth, db } = getAdminServices();
    const [authUser, businessSnapshot, branchSnapshot, settingsSnapshot, financeSnapshot] = await Promise.all([
      auth.getUser(user.uid),
      db.collection("businesses").doc(body.businessId).get(),
      db.collection("branches").doc(body.branchId).get(),
      db.collection("platformSettings").doc("global").get(),
      db.collection("businessFinanceSettings").doc(body.businessId).get()
    ]);
    if (!authUser.providerData.some((provider) => provider.providerId === "password")) {
      throw Object.assign(new Error("Create or link an email-and-password credential before ordering."), { status: 409 });
    }
    if (!businessSnapshot.exists || !businessSnapshot.data().public) throw Object.assign(new Error("This business is not available."), { status: 404 });
    if (!branchSnapshot.exists || branchSnapshot.data().businessId !== body.businessId) throw Object.assign(new Error("Choose a valid pickup branch."), { status: 422 });

    const settings = settingsSnapshot.data() || {};
    const roles = user.profile?.roles || [];
    const elevatedPreview = roles.some((role) => ["super_admin", "platform_admin", "operations_manager", "support_manager"].includes(role));
    const marketplaceOpen = settings.launch?.marketplaceEnabled === true;
    const privatePreview = settings.launch?.privateBetaEnabled !== false && (user.profile?.privateBeta === true || elevatedPreview);
    if (!marketplaceOpen && !privatePreview) {
      throw Object.assign(new Error("The marketplace is currently limited to approved preview accounts."), { status: 403 });
    }
    if (settings.commerce?.enabled === false || !(settings.commerce?.fulfilment || ["pickup"]).includes("pickup")) {
      throw Object.assign(new Error("Grocery pickup is temporarily unavailable."), { status: 503 });
    }

    const branch = branchSnapshot.data();
    if (branch.status && branch.status !== "active") throw Object.assign(new Error("This branch is not accepting orders."), { status: 409 });
    if (branch.public === false || !(branch.fulfilment || ["pickup"]).includes("pickup")) {
      throw Object.assign(new Error("Pickup is not enabled for this branch."), { status: 409 });
    }

    const finance = financeSnapshot.data() || {};
    const platformMethods = settings.commerce?.paymentMethods || ["cash", "paynow", "ecocash", "onemoney", "card", "bank_transfer"];
    const businessMethods = finance.paymentMethods || platformMethods;
    const branchMethods = branch.paymentMethods || businessMethods;
    const allowedMethods = platformMethods.filter((method) => businessMethods.includes(method) && branchMethods.includes(method));
    if (!allowedMethods.includes(body.paymentMethod)) throw Object.assign(new Error("That payment method is not currently available for this branch."), { status: 422 });

    const platformCurrencies = settings.commerce?.currencies || ["USD", "ZWG"];
    const businessCurrencies = finance.acceptedCurrencies || platformCurrencies;
    const branchCurrencies = branch.acceptedCurrencies || businessCurrencies;
    if (!platformCurrencies.includes(body.currency) || !businessCurrencies.includes(body.currency) || !branchCurrencies.includes(body.currency)) {
      throw Object.assign(new Error("That currency is not currently available for this branch."), { status: 422 });
    }

    const requested = new Map(body.items.map((item) => [item.productId, item.quantity]));
    const productSnapshots = await Promise.all([...requested.keys()].map((id) => db.collection("products").doc(id).get()));
    const lines = productSnapshots.map((snapshot) => {
      if (!snapshot.exists) throw Object.assign(new Error("One of the selected products is no longer available."), { status: 409 });
      const product = snapshot.data();
      if (product.businessId !== body.businessId || product.status === "archived" || product.available === false) {
        throw Object.assign(new Error(`${product.name || "A product"} is no longer available.`), { status: 409 });
      }
      const quantity = requested.get(snapshot.id);
      const currencyPrice = product.prices?.[body.currency] ?? product.price;
      const unitPrice = Number(currencyPrice || 0);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) throw Object.assign(new Error(`${product.name || "A product"} has an invalid price.`), { status: 409 });
      return {
        productId: snapshot.id,
        name: safeText(product.name, 160),
        sku: product.sku || "",
        image: product.image || "",
        quantity,
        unitPrice,
        lineTotal: Number((unitPrice * quantity).toFixed(2)),
        substitutionAllowed: product.substitutionAllowed !== false
      };
    });

    const subtotal = Number(lines.reduce((sum, line) => sum + line.lineTotal, 0).toFixed(2));
    const serviceFee = Number(Math.max(0, Number(settings.commerce?.customerServiceFee || 0)).toFixed(2));
    const total = Number((subtotal + serviceFee).toFixed(2));
    if (total <= 0) throw Object.assign(new Error("The order total must be greater than zero."), { status: 422 });

    const orderRef = db.collection("orders").doc();
    const paymentRequired = body.paymentMethod !== "cash" && body.paymentMethod !== "bank_transfer";
    const number = orderNumber();
    const order = {
      number,
      customerId: user.uid,
      customerEmail: user.email || "",
      customerName: user.name || user.profile?.displayName || body.pickup.contactName,
      businessId: body.businessId,
      businessName: businessSnapshot.data().name,
      branchId: body.branchId,
      branchName: branch.name,
      items: lines,
      totals: { subtotal, serviceFee, tax: 0, total },
      currency: body.currency,
      fulfilment: "pickup",
      pickup: { ...body.pickup, notes: safeText(body.pickup.notes, 500) },
      paymentMethod: body.paymentMethod,
      paymentStatus: paymentRequired ? "unpaid" : body.paymentMethod === "cash" ? "due_at_pickup" : "awaiting_transfer",
      status: paymentRequired ? "awaiting_payment" : "submitted",
      timeline: [{ status: paymentRequired ? "awaiting_payment" : "submitted", at: new Date().toISOString(), actorId: user.uid }],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    const batch = db.batch();
    batch.create(orderRef, order);
    batch.create(db.collection("orderEvents").doc(), {
      orderId: orderRef.id,
      type: "order_created",
      status: order.status,
      actorId: user.uid,
      metadata: { number, paymentMethod: body.paymentMethod },
      createdAt: FieldValue.serverTimestamp()
    });
    batch.create(db.collection("notifications").doc(), {
      userId: user.uid,
      title: "Order created",
      body: `${number} was sent to ${businessSnapshot.data().name}.`,
      href: `/marketplace?order=${orderRef.id}`,
      category: "order",
      read: false,
      createdAt: FieldValue.serverTimestamp()
    });
    await batch.commit();

    return Response.json({ ok: true, orderId: orderRef.id, number, total, currency: body.currency, paymentRequired });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the pickup and payment details.", details: error.flatten() }, { status: 400 });
    return apiError(error);
  }
}

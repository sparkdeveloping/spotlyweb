import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { pickupAvailability } from "@/lib/pickup-availability";
import { safeText } from "@/lib/server-helpers";
import { haversineKm, makeCode, makeDeliveryNumber } from "@/lib/driver-delivery-server";
import { buildOrderTotals, shoppingReserveAmount } from "@/lib/order-money";

export const runtime = "nodejs";

const itemSchema = z.object({ productId: z.string().min(1).max(180), quantity: z.number().int().min(1).max(99) });
const schema = z.object({
  checkoutId: z.string().min(8).max(160).regex(/^[A-Za-z0-9_-]+$/),
  businessId: z.string().min(1).max(180),
  branchId: z.string().min(1).max(180),
  items: z.array(itemSchema).min(1).max(60),
  currency: z.enum(["USD", "ZWG"]).default("USD"),
  paymentMethod: z.enum(["cash", "paynow", "ecocash", "onemoney", "card", "bank_transfer"]),
  fulfilment: z.enum(["pickup", "delivery"]).default("pickup"),
  delivery: z.object({
    contactName: z.string().min(2).max(120),
    contactPhone: z.string().min(7).max(40),
    address: z.string().min(3).max(500),
    suburb: z.string().max(120).optional(),
    landmark: z.string().max(240).optional(),
    instructions: z.string().max(500).optional(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    substitutionPreference: z.enum(["contact_me", "best_match", "remove_item", "no_substitutions"]).default("contact_me")
  }).optional(),
  pickup: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    slot: z.string().min(3).max(40),
    slotId: z.string().min(8).max(80),
    contactName: z.string().min(2).max(120),
    contactPhone: z.string().min(7).max(40),
    alternativePhone: z.string().max(40).optional(),
    notes: z.string().max(500).optional(),
    substitutionPreference: z.enum(["contact_me", "best_match", "remove_item", "no_substitutions"]).default("contact_me")
  }).optional()
});

function orderNumber() {
  const ymd = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `SP-${ymd}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function idempotencyId(uid, checkoutId) {
  return `${uid}_${checkoutId}`.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 300);
}

function lineFromProduct(snapshot, body, quantity) {
  if (!snapshot.exists) throw Object.assign(new Error("One of the selected products is no longer available."), { status: 409 });
  const product = snapshot.data();
  if (product.businessId !== body.businessId || product.status === "archived" || product.available === false || (product.branchIds?.length && !product.branchIds.includes(body.branchId))) {
    throw Object.assign(new Error(`${product.name || "A product"} is no longer available at this location.`), { status: 409 });
  }
  if (Number.isFinite(Number(product.maxQuantity)) && quantity > Number(product.maxQuantity)) {
    throw Object.assign(new Error(`${product.name || "A product"} exceeds the allowed quantity.`), { status: 409 });
  }
  const stock = Number(product.stockQuantity);
  const reserved = Math.max(0, Number(product.reservedQuantity || 0));
  if (Number.isFinite(stock) && stock >= 0 && quantity > Math.max(0, stock - reserved)) {
    throw Object.assign(new Error(`${product.name || "A product"} does not have enough stock.`), { status: 409 });
  }
  const currencyPrice = product.prices?.[body.currency] ?? (product.currency === body.currency || !product.currency ? product.price : undefined);
  const unitPrice = Number(currencyPrice);
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    throw Object.assign(new Error(`${product.name || "A product"} does not have a valid ${body.currency} price.`), { status: 409 });
  }
  return {
    product,
    line: {
      productId: snapshot.id,
      name: safeText(product.name, 160),
      sku: product.sku || "",
      image: product.image || "",
      quantity,
      unitPrice,
      lineTotal: Number((unitPrice * quantity).toFixed(2)),
      substitutionAllowed: product.substitutionAllowed !== false
    }
  };
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const body = schema.parse(await request.json());
    if (!user.email) throw Object.assign(new Error("Add and verify an email-and-password sign-in before ordering."), { status: 409 });

    const { auth, db } = getAdminServices();
    const requestRef = db.collection("orderRequests").doc(idempotencyId(user.uid, body.checkoutId));
    const existingRequest = await requestRef.get();
    if (existingRequest.exists) {
      const existing = existingRequest.data();
      return Response.json({ ok: true, orderId: existing.orderId, number: existing.number, total: existing.total, currency: existing.currency, paymentRequired: existing.paymentRequired, idempotent: true });
    }

    const [authUser, businessSnapshot, branchSnapshot, settingsSnapshot, financeSnapshot, legacyFinanceSnapshot] = await Promise.all([
      auth.getUser(user.uid),
      db.collection("businesses").doc(body.businessId).get(),
      db.collection("branches").doc(body.branchId).get(),
      db.collection("platformSettings").doc("global").get(),
      db.collection("businessFinance").doc(body.businessId).get(),
      db.collection("businessFinanceSettings").doc(body.businessId).get()
    ]);
    const supportedIdentityProviders = new Set(["password", "google.com", "apple.com"]);
    if (!authUser.providerData.some((provider) => supportedIdentityProviders.has(provider.providerId))) throw Object.assign(new Error("Sign in with email, Google or Apple before ordering."), { status: 409 });
    const businessData = businessSnapshot.exists ? businessSnapshot.data() : null;
    const businessLive = Boolean(businessData?.public) && (businessData?.status === "active" || businessData?.lifecycleStatus === "live");
    if (!businessLive) throw Object.assign(new Error("This business is not accepting customer orders yet."), { status: 404 });
    if (!branchSnapshot.exists || branchSnapshot.data().businessId !== body.businessId) throw Object.assign(new Error("Choose a valid business location."), { status: 422 });
    if (body.fulfilment === "delivery" && !body.delivery) throw Object.assign(new Error("Add a delivery address and map location."), { status: 422 });
    if (body.fulfilment === "pickup" && !body.pickup) throw Object.assign(new Error("Choose a pickup time."), { status: 422 });

    const settings = settingsSnapshot.data() || {};
    const roles = user.profile?.roles || [];
    const elevatedPreview = roles.some((role) => ["super_admin", "platform_admin", "operations_manager", "support_manager"].includes(role));
    const marketplaceOpen = settings.launch?.marketplaceEnabled === true;
    const privatePreview = settings.launch?.privateBetaEnabled !== false && (user.profile?.privateBeta === true || elevatedPreview);
    if (!marketplaceOpen && !privatePreview) throw Object.assign(new Error("The marketplace is currently limited to approved preview accounts."), { status: 403 });
    const configuredFulfilment = settings.commerce?.fulfilment || ["pickup"];
    const fulfilmentEnabled = body.fulfilment === "delivery" ? settings.commerce?.deliveryEnabled !== false : configuredFulfilment.includes("pickup");
    if (settings.commerce?.enabled === false || !fulfilmentEnabled) throw Object.assign(new Error(`${body.fulfilment === "delivery" ? "Delivery" : "Pickup"} ordering is temporarily unavailable.`), { status: 503 });

    const branch = branchSnapshot.data();
    if (branch.status && branch.status !== "active") throw Object.assign(new Error("This branch is not accepting orders."), { status: 409 });
    if (branch.public === false || !(branch.fulfilment || ["pickup"]).includes(body.fulfilment)) throw Object.assign(new Error(`${body.fulfilment === "delivery" ? "Delivery" : "Pickup"} is not enabled for this location.`), { status: 409 });
    if (body.fulfilment === "delivery" && (!branch.delivery?.enabled || branch.delivery?.paused)) throw Object.assign(new Error("Delivery is not accepting orders from this location right now."), { status: 409 });

    const finance = { ...(legacyFinanceSnapshot.data() || {}), ...(financeSnapshot.data() || {}) };
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
    const productRefs = [...requested.keys()].map((id) => db.collection("products").doc(id));
    const orderRef = db.collection("orders").doc();
    const eventRef = db.collection("orderEvents").doc();
    const notificationRef = db.collection("notifications").doc();
    const businessRef = db.collection("businesses").doc(body.businessId);
    const branchRef = db.collection("branches").doc(body.branchId);
    const paymentRequired = body.paymentMethod !== "cash" && body.paymentMethod !== "bank_transfer";
    if (body.fulfilment === "delivery" && ["cash", "bank_transfer"].includes(body.paymentMethod)) throw Object.assign(new Error("Delivery requires an instantly confirmable digital payment method."), { status: 422 });
    const number = orderNumber();
    const serviceFee = Number(Math.max(0, Number(settings.commerce?.customerServiceFee || 0)).toFixed(2));

    const result = await db.runTransaction(async (transaction) => {
      const freshRequest = await transaction.get(requestRef);
      if (freshRequest.exists) return freshRequest.data();
      const [freshBusiness, freshBranch, productSnapshots] = await Promise.all([
        transaction.get(businessRef),
        transaction.get(branchRef),
        Promise.all(productRefs.map((ref) => transaction.get(ref)))
      ]);
      const currentBusiness = freshBusiness.exists ? freshBusiness.data() : null;
      if (!currentBusiness?.public || !(currentBusiness.status === "active" || currentBusiness.lifecycleStatus === "live")) {
        throw Object.assign(new Error("This business is no longer accepting customer orders."), { status: 409 });
      }
      if (!freshBranch.exists) throw Object.assign(new Error("This location is no longer available."), { status: 409 });
      const branchData = freshBranch.data();
      let slot = null;
      if (body.fulfilment === "pickup") {
        const availability = pickupAvailability(branchData, { days: 14 });
        const day = availability.days.find((item) => item.date === body.pickup.date);
        slot = day?.slots.find((item) => item.id === body.pickup.slotId && item.label === body.pickup.slot);
        if (!slot) throw Object.assign(new Error("That pickup time is no longer available. Choose another time."), { status: 409 });
      }

      const currentProducts = productSnapshots.map((snapshot) => lineFromProduct(snapshot, body, requested.get(snapshot.id)));
      const lines = currentProducts.map((item) => item.line);
      const subtotal = Number(lines.reduce((sum, line) => sum + line.lineTotal, 0).toFixed(2));
      const deliveryFee = body.fulfilment === "delivery" ? Number(Math.max(0, Number(branchData.delivery?.fee ?? settings.commerce?.deliveryFee ?? 3.5)).toFixed(2)) : 0;
      const driverShopping = body.fulfilment === "delivery" && branchData.delivery?.fulfilmentMode === "driver_shops";
      const reservePercent = driverShopping ? Number(branchData.delivery?.shoppingReservePercent ?? settings.commerce?.driverShoppingReservePercent ?? 12) : 0;
      const shoppingReserve = driverShopping ? shoppingReserveAmount(subtotal, reservePercent) : 0;
      const commissionPercent = Number(finance.commissionPercent ?? settings.commerce?.commissionPercent ?? 0);
      const totals = buildOrderTotals({ subtotal, serviceFee, deliveryFee, shoppingReserve, commissionPercent });
      const total = totals.total;
      if (total <= 0) throw Object.assign(new Error("The order total must be greater than zero."), { status: 422 });

      const slotKey = slot?.id || null;
      const bookedSlots = slotKey ? { ...(branchData.pickup?.bookedSlots || {}), [slotKey]: Number(branchData.pickup?.bookedSlots?.[slotKey] || 0) + 1 } : null;
      const preference = body.fulfilment === "delivery" ? body.delivery.substitutionPreference : body.pickup.substitutionPreference;
      const normalizedSubstitution = preference === "remove_item" ? "no_substitutions" : preference;
      const order = {
        number,
        checkoutId: body.checkoutId,
        customerId: user.uid,
        customerEmail: user.email || "",
        customerName: user.name || user.profile?.displayName || (body.fulfilment === "delivery" ? body.delivery.contactName : body.pickup.contactName),
        businessId: body.businessId,
        businessName: businessSnapshot.data().name,
        branchId: body.branchId,
        branchName: branchData.branchName || branchData.name,
        items: lines,
        totals,
        commerceSnapshot: { commissionPercent: totals.commissionPercent, settlementModel: "platform", deliveryFulfilmentMode: driverShopping ? "driver_shops" : "merchant_prepared" },
        shopping: driverShopping ? { mode: "driver_shops", state: "funding_pending", reservePercent, estimatedSubtotal: subtotal, reserveAmount: shoppingReserve, maxAuthorizedMerchandise: Number((subtotal + shoppingReserve).toFixed(2)), actualSubtotal: null, finalTotal: null, unusedReserve: null, topUpRequired: 0, substitutionPreference: normalizedSubstitution, receiptStoragePath: "", changes: [], updatedAt: new Date().toISOString() } : null,
        currency: body.currency,
        fulfilment: body.fulfilment,
        pickup: body.fulfilment === "pickup" ? { ...body.pickup, substitutionPreference: normalizedSubstitution, notes: safeText(body.pickup.notes, 500), reservedSlotId: slot.id } : null,
        delivery: body.fulfilment === "delivery" ? { ...body.delivery, substitutionPreference: normalizedSubstitution, instructions: safeText(body.delivery.instructions, 500) } : null,
        paymentMethod: body.paymentMethod,
        paymentStatus: paymentRequired ? "unpaid" : body.paymentMethod === "cash" ? "due_at_pickup" : "awaiting_transfer",
        status: paymentRequired ? "awaiting_payment" : "submitted",
        inventoryReservationStatus: "reserved",
        timeline: [{ status: paymentRequired ? "awaiting_payment" : "submitted", at: new Date().toISOString(), actorId: user.uid }],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };

      transaction.create(orderRef, order);
      if (body.fulfilment === "delivery") {
        const deliveryRef = db.collection("deliveryJobs").doc();
        const deliveryNumber = makeDeliveryNumber();
        const pickupCode = driverShopping ? null : makeCode(4);
        const customerPin = makeCode(4);
        const pickupLocation = branchData.delivery?.location || branchData.location || { lat: Number(branchData.lat), lng: Number(branchData.lng) };
        if (!Number.isFinite(Number(pickupLocation?.lat)) || !Number.isFinite(Number(pickupLocation?.lng))) throw Object.assign(new Error("This location needs a valid map pin before it can accept delivery orders."), { status: 409 });
        const deliveryDistanceKm = haversineKm({ lat: Number(pickupLocation.lat), lng: Number(pickupLocation.lng) }, { lat: Number(body.delivery.lat), lng: Number(body.delivery.lng) });
        const deliveryRadiusKm = Number(branchData.delivery?.radiusKm || 0);
        if (deliveryRadiusKm > 0 && deliveryDistanceKm > deliveryRadiusKm) throw Object.assign(new Error(`This address is outside this location's ${deliveryRadiusKm} km delivery area.`), { status: 422 });
        transaction.create(deliveryRef, {
          number: deliveryNumber, orderId: orderRef.id, businessId: body.businessId, branchId: body.branchId, customerId: user.uid, state: "awaiting_dispatch",
          pickup: { lat: Number(pickupLocation?.lat), lng: Number(pickupLocation?.lng), formattedAddress: branchData.address || "", area: branchData.area || branchData.city || "Harare", instructions: safeText(branchData.delivery?.pickupInstructions || branchData.instructions || "", 1000) },
          dropoff: { lat: body.delivery.lat, lng: body.delivery.lng, formattedAddress: safeText(body.delivery.address, 500), suburb: safeText(body.delivery.suburb, 120), landmark: safeText(body.delivery.landmark, 240), instructions: safeText(body.delivery.instructions, 500) },
          fulfilmentMode: driverShopping ? "driver_shops" : "merchant_prepared",
          businessPreparationMinutes: driverShopping ? 0 : Number(branchData.delivery?.preparationMinutes || 20), shoppingMinutes: driverShopping ? Number(branchData.delivery?.preparationMinutes || 30) : 0, requiredVehicleTypes: branchData.delivery?.vehicleTypes || ["motorcycle", "car"],
          shopping: driverShopping ? { state: "funding_pending", reservePercent, estimatedSubtotal: subtotal, reserveAmount: shoppingReserve, maxAuthorizedMerchandise: Number((subtotal + shoppingReserve).toFixed(2)), substitutionPreference: normalizedSubstitution, items: lines.map((line) => ({ productId: line.productId, name: line.name, requestedQuantity: line.quantity, estimatedUnitPrice: line.unitPrice, status: "pending", actualQuantity: 0, actualUnitPrice: 0, replacementName: "" })) } : null,
          quotedDriverPay: Number(Math.max(1, Number(branchData.delivery?.driverPay ?? settings.commerce?.defaultDriverPay ?? Math.max(2.5, deliveryFee * 0.7))).toFixed(2)), currency: body.currency,
          pickupCode, customerPin, bagCount: 1, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
        });
        transaction.set(orderRef, { deliveryJobId: deliveryRef.id, deliveryNumber, deliveryStatus: driverShopping ? (paymentRequired ? "awaiting_payment" : "awaiting_dispatch") : "business_preparing" }, { merge: true });
      }
      transaction.create(eventRef, { orderId: orderRef.id, type: "order_created", previousStatus: null, status: order.status, actorType: "customer", actorId: user.uid, source: "checkout", metadata: { number, paymentMethod: body.paymentMethod, fulfilment: body.fulfilment, fulfilmentMode: driverShopping ? "driver_shops" : "merchant_prepared", slotId: slot?.id || null }, createdAt: FieldValue.serverTimestamp() });
      transaction.create(notificationRef, { userId: user.uid, title: "Order created", body: `${number} was sent to ${businessSnapshot.data().name}.`, href: `/marketplace?order=${orderRef.id}`, category: "order", read: false, createdAt: FieldValue.serverTimestamp() });
      if (bookedSlots) transaction.update(branchRef, { "pickup.bookedSlots": bookedSlots, updatedAt: FieldValue.serverTimestamp() });
      currentProducts.forEach(({ product, line }, index) => {
        const stock = Number(product.stockQuantity);
        if (Number.isFinite(stock) && stock >= 0) transaction.update(productRefs[index], { reservedQuantity: FieldValue.increment(line.quantity), updatedAt: FieldValue.serverTimestamp() });
      });
      const response = { orderId: orderRef.id, number, total, currency: body.currency, paymentRequired, fulfilment: body.fulfilment, fulfilmentMode: driverShopping ? "driver_shops" : "merchant_prepared", shoppingReserve };
      transaction.create(requestRef, { ...response, customerId: user.uid, checkoutId: body.checkoutId, createdAt: FieldValue.serverTimestamp() });
      return response;
    });

    return Response.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the fulfilment and payment details.", details: error.flatten() }, { status: 400 });
    return apiError(error);
  }
}

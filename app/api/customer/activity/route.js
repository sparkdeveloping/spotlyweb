import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";

export const runtime = "nodejs";

function iso(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function number(value, fallback = null) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function clean(value) {
  return String(value || "").trim();
}

function orderKind(order = {}) {
  const type = clean(order.transactionType || order.type || "order").toLowerCase();
  if (["appointment", "booking", "ticket"].includes(type)) return type;
  if (type === "event") return "ticket";
  return "order";
}

function serviceForOrder(order = {}, kind = "order") {
  const explicit = clean(order.service || order.serviceKind).toLowerCase();
  if (["eat", "shop", "book", "events"].includes(explicit)) return explicit;
  if (kind === "appointment" || kind === "booking") return "book";
  if (kind === "ticket") return "events";
  const fulfilment = clean(order.fulfilment || order.fulfilmentMode).toLowerCase();
  if (fulfilment === "pickup" || fulfilment === "delivery") return "eat";
  return null;
}

function orderSubtitle(order = {}, kind = "order") {
  const items = Array.isArray(order.items) ? order.items : [];
  if (["appointment", "booking", "ticket"].includes(kind)) {
    const named = clean(items[0]?.name || order.itemName || order.serviceName || order.eventName);
    if (named) return named;
  }
  if (kind === "order") {
    const count = items.reduce((sum, item) => sum + Math.max(1, number(item.quantity, 1) || 1), 0);
    if (count > 0) return `${count} ${count === 1 ? "item" : "items"}`;
    const fulfilment = clean(order.fulfilment || order.fulfilmentMode);
    if (fulfilment) return fulfilment.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
  }
  return clean(order.number || order.orderNumber) ? `Reference ${clean(order.number || order.orderNumber)}` : "Spotly activity";
}

function orderRecord(id, order = {}) {
  const rawType = clean(order.transactionType || "").toLowerCase();
  if (["ride", "send"].includes(rawType)) return null;
  const kind = orderKind(order);
  const total = number(order.totals?.total ?? order.total, null);
  const paymentStatus = clean(order.paymentStatus || (total && total > 0 ? "unpaid" : "not_required")) || "not_required";
  const state = clean(order.status || order.state || "submitted") || "submitted";
  const businessName = clean(order.businessName || order.merchantName);
  const title = businessName || (kind === "ticket" ? "Event ticket" : kind === "booking" ? "Booking" : kind === "appointment" ? "Appointment" : "Spotly order");
  const attention = ["unpaid", "failed", "action_required", "awaiting_payment"].includes(paymentStatus.toLowerCase()) && (total || 0) > 0
    ? "Payment required"
    : (state.toLowerCase().includes("substitution") || state.toLowerCase().includes("action")) ? "Action required" : null;
  return {
    id: `order:${id}`,
    kind,
    service: serviceForOrder(order, kind),
    title,
    subtitle: orderSubtitle(order, kind),
    state,
    paymentStatus,
    number: clean(order.number || order.orderNumber || id),
    total,
    currency: clean(order.currency || "USD") || "USD",
    createdAt: iso(order.createdAt || order.requestedAt || order.updatedAt),
    scheduledAt: iso(order.scheduledAt || order.appointmentAt || order.startDate || order.eventStartsAt),
    attentionReason: attention,
    primaryAction: attention ? "pay" : null,
    orderId: id,
    rideId: null,
    parcelId: null
  };
}

function rideRecord(id, ride = {}) {
  const pickup = clean(ride.pickup?.area || ride.pickup?.label || ride.pickup?.formattedAddress);
  const dropoff = clean(ride.dropoff?.area || ride.dropoff?.label || ride.dropoff?.formattedAddress);
  const subtitle = [pickup, dropoff].filter(Boolean).join(" → ") || "Ride request";
  const total = number(ride.quote?.total ?? ride.total, null);
  const paymentStatus = clean(ride.paymentStatus || (ride.paymentMethod === "cash" ? "cash_due" : "unpaid")) || "not_required";
  const state = clean(ride.state || "requested") || "requested";
  const attention = ["unpaid", "failed", "action_required", "awaiting_payment"].includes(paymentStatus.toLowerCase()) && (total || 0) > 0 ? "Payment required" : null;
  return {
    id: `ride:${id}`,
    kind: "ride",
    service: "ride",
    title: "Spotly Ride",
    subtitle,
    state,
    paymentStatus,
    number: clean(ride.number || id),
    total,
    currency: clean(ride.quote?.currency || ride.currency || "USD") || "USD",
    createdAt: iso(ride.createdAt || ride.requestedAt || ride.updatedAt),
    scheduledAt: iso(ride.scheduledAt),
    attentionReason: attention,
    primaryAction: attention ? "pay" : null,
    orderId: ride.orderId || null,
    rideId: id,
    parcelId: null
  };
}

function parcelRecord(id, parcel = {}) {
  const pickup = clean(parcel.pickup?.area || parcel.pickup?.label || parcel.pickup?.formattedAddress);
  const dropoff = clean(parcel.dropoff?.area || parcel.dropoff?.label || parcel.dropoff?.formattedAddress);
  const route = [pickup, dropoff].filter(Boolean).join(" → ");
  const description = clean(parcel.parcelDescription);
  const subtitle = route || description || "Parcel delivery";
  const total = number(parcel.quote?.total ?? parcel.total, null);
  const paymentStatus = clean(parcel.paymentStatus || (parcel.paymentMethod === "cash" ? "cash_due" : "unpaid")) || "not_required";
  const state = clean(parcel.state || "requested") || "requested";
  const attention = ["unpaid", "failed", "action_required", "awaiting_payment"].includes(paymentStatus.toLowerCase()) && (total || 0) > 0 ? "Payment required" : null;
  return {
    id: `send:${id}`,
    kind: "send",
    service: "send",
    title: "Spotly Send",
    subtitle,
    state,
    paymentStatus,
    number: clean(parcel.number || id),
    total,
    currency: clean(parcel.quote?.currency || parcel.currency || "USD") || "USD",
    createdAt: iso(parcel.createdAt || parcel.requestedAt || parcel.updatedAt),
    scheduledAt: iso(parcel.scheduledPickupAt),
    attentionReason: attention,
    primaryAction: attention ? "pay" : null,
    orderId: parcel.orderId || null,
    rideId: null,
    parcelId: id
  };
}

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    const rate = await enforceRateLimit(request, { key: "customer-activity", limit: 120, windowMs: 60_000, identity: user.uid });
    const url = new URL(request.url);
    const requestedOffset = Number(url.searchParams.get("offset") || 0);
    const requestedLimit = Number(url.searchParams.get("limit") || 30);
    const offset = Number.isFinite(requestedOffset) ? Math.max(0, Math.floor(requestedOffset)) : 0;
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 10), 60) : 30;
    const { db } = getAdminServices();

    const [ordersSnapshot, ridesSnapshot, parcelsSnapshot] = await Promise.all([
      db.collection("orders").where("customerId", "==", user.uid).limit(160).get(),
      db.collection("rideTrips").where("customerId", "==", user.uid).limit(80).get(),
      db.collection("parcelJobs").where("customerId", "==", user.uid).limit(80).get()
    ]);

    const records = [
      ...ordersSnapshot.docs.map((doc) => orderRecord(doc.id, doc.data() || {})).filter(Boolean),
      ...ridesSnapshot.docs.map((doc) => rideRecord(doc.id, doc.data() || {})),
      ...parcelsSnapshot.docs.map((doc) => parcelRecord(doc.id, doc.data() || {}))
    ].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")) || String(a.id).localeCompare(String(b.id)));

    const page = records.slice(offset, offset + limit);
    return Response.json({
      ok: true,
      records: page,
      nextOffset: offset + page.length < records.length ? offset + page.length : null
    }, {
      headers: {
        "Cache-Control": "private, no-store",
        "X-RateLimit-Remaining": String(rate.remaining)
      }
    });
  } catch (error) {
    return apiError(error);
  }
}

import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { shoppingActivity, bookingActivity } from "@/lib/assist-activity";
import { ACTIVITY_KINDS, SERVICE_IDS } from "@/lib/contracts/generated";

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
  if (ACTIVITY_KINDS.includes(type) && !["order", "ride", "send"].includes(type)) return type;
  if (type === "event") return "ticket";
  return "order";
}

function serviceForOrder(order = {}, kind = "order") {
  const explicit = clean(order.service || order.serviceKind).toLowerCase();
  if (SERVICE_IDS.includes(explicit) && !["ride", "send"].includes(explicit)) return explicit;
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

function paymentAttention(paymentStatus, total, state = "") {
  if (["unpaid", "failed", "action_required", "awaiting_payment"].includes(clean(paymentStatus).toLowerCase()) && (total || 0) > 0) return "Payment required";
  if (clean(state).toLowerCase().includes("substitution") || clean(state).toLowerCase().includes("action")) return "Action required";
  return null;
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
  const attention = paymentAttention(paymentStatus, total, state);
  return {
    id: `order:${id}`,
    kind,
    transactionType: kind,
    service: serviceForOrder(order, kind),
    title,
    businessName: businessName || null,
    businessId: order.businessId || null,
    branchId: order.branchId || null,
    branchName: clean(order.branchName) || null,
    country: clean(order.country || order.countryCode) || null,
    timeZone: clean(order.timeZone || order.timezone) || null,
    subtitle: orderSubtitle(order, kind),
    state,
    status: state,
    deliveryStatus: clean(order.deliveryStatus) || null,
    paymentStatus,
    paymentMethod: clean(order.paymentMethod) || null,
    number: clean(order.number || order.orderNumber || id),
    total,
    totals: order.totals || (total == null ? null : { total }),
    currency: clean(order.currency || "USD") || "USD",
    createdAt: iso(order.createdAt || order.requestedAt || order.updatedAt),
    scheduledAt: iso(order.scheduledAt || order.appointmentAt || order.startDate || order.eventStartsAt),
    attentionReason: attention,
    primaryAction: attention ? "pay" : null,
    orderId: id,
    rideId: null,
    rideTripId: null,
    parcelId: null,
    parcelJobId: null,
    fulfilment: clean(order.fulfilment || order.fulfilmentMode) || null,
    delivery: order.delivery || null,
    pickup: order.pickup || null,
    promotion: order.promotion || null,
    items: Array.isArray(order.items) ? order.items : [],
    appointment: order.appointment || null,
    booking: order.booking || null,
    event: order.event || null,
    ticketEntitlements: Array.isArray(order.ticketEntitlements) ? order.ticketEntitlements : [],
    customerRating: number(order.customerRating, null),
    customerReviewComment: clean(order.customerReviewComment) || null,
    href: `/?view=activity&order=${encodeURIComponent(id)}`
  };
}

function rideRecord(id, ride = {}) {
  const pickup = clean(ride.pickup?.area || ride.pickup?.label || ride.pickup?.formattedAddress || ride.pickup?.address);
  const dropoff = clean(ride.dropoff?.area || ride.dropoff?.label || ride.dropoff?.formattedAddress || ride.dropoff?.address);
  const subtitle = [pickup, dropoff].filter(Boolean).join(" → ") || "Ride request";
  const total = number(ride.quote?.total ?? ride.total, null);
  const paymentStatus = clean(ride.paymentStatus || (ride.paymentMethod === "cash" ? "cash_due" : "unpaid")) || "not_required";
  const state = clean(ride.state || "requested") || "requested";
  const attention = paymentAttention(paymentStatus, total, state);
  return {
    id: `ride:${id}`,
    kind: "ride",
    transactionType: "ride",
    service: "ride",
    title: "Spotly Ride",
    subtitle,
    state,
    status: state,
    rideStatus: state,
    paymentStatus,
    paymentMethod: clean(ride.paymentMethod) || null,
    number: clean(ride.number || id),
    total,
    totals: total == null ? null : { total },
    currency: clean(ride.quote?.currency || ride.currency || "USD") || "USD",
    createdAt: iso(ride.createdAt || ride.requestedAt || ride.updatedAt),
    scheduledAt: iso(ride.scheduledAt),
    attentionReason: attention,
    primaryAction: attention ? "pay" : null,
    orderId: ride.orderId || null,
    rideId: id,
    rideTripId: id,
    parcelId: null,
    parcelJobId: null,
    pickup: ride.pickup || null,
    dropoff: ride.dropoff || null,
    serviceType: ride.serviceType || null,
    customerRating: number(ride.riderRating, null),
    customerReviewComment: clean(ride.riderReviewComment) || null,
    href: `/?view=activity&ride=${encodeURIComponent(id)}`
  };
}

function parcelRecord(id, parcel = {}) {
  const pickup = clean(parcel.pickup?.area || parcel.pickup?.label || parcel.pickup?.formattedAddress || parcel.pickup?.address);
  const dropoff = clean(parcel.dropoff?.area || parcel.dropoff?.label || parcel.dropoff?.formattedAddress || parcel.dropoff?.address);
  const route = [pickup, dropoff].filter(Boolean).join(" → ");
  const description = clean(parcel.parcelDescription);
  const subtitle = route || description || "Parcel delivery";
  const total = number(parcel.quote?.total ?? parcel.total, null);
  const paymentStatus = clean(parcel.paymentStatus || (parcel.paymentMethod === "cash" ? "cash_due" : "unpaid")) || "not_required";
  const state = clean(parcel.state || "requested") || "requested";
  const attention = paymentAttention(paymentStatus, total, state);
  return {
    id: `send:${id}`,
    kind: "send",
    transactionType: "send",
    service: "send",
    title: "Spotly Send",
    subtitle,
    state,
    status: state,
    deliveryStatus: state,
    paymentStatus,
    paymentMethod: clean(parcel.paymentMethod) || null,
    number: clean(parcel.number || id),
    total,
    totals: total == null ? null : { total },
    currency: clean(parcel.quote?.currency || parcel.currency || "USD") || "USD",
    createdAt: iso(parcel.createdAt || parcel.requestedAt || parcel.updatedAt),
    scheduledAt: iso(parcel.scheduledPickupAt),
    scheduledPickupAt: iso(parcel.scheduledPickupAt),
    attentionReason: attention,
    primaryAction: attention ? "pay" : null,
    orderId: parcel.orderId || null,
    rideId: null,
    rideTripId: null,
    parcelId: id,
    parcelJobId: id,
    pickup: parcel.pickup || null,
    dropoff: parcel.dropoff || null,
    parcelDescription: description || null,
    customerRating: number(parcel.customerRating, null),
    customerReviewComment: clean(parcel.customerReviewComment) || null,
    href: `/?view=activity&parcel=${encodeURIComponent(id)}`
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
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 10), 200) : 80;
    const { db } = getAdminServices();

    const [ordersSnapshot, ridesSnapshot, parcelsSnapshot, shoppingSnapshot, bookingsSnapshot] = await Promise.all([
      db.collection("orders").where("customerId", "==", user.uid).limit(200).get(),
      db.collection("rideTrips").where("customerId", "==", user.uid).limit(120).get(),
      db.collection("parcelJobs").where("customerId", "==", user.uid).limit(120).get(),
      db.collection("independentShoppingRequests").where("customerId", "==", user.uid).limit(100).get(),
      db.collection("assistedBookings").where("customerId", "==", user.uid).limit(100).get()
    ]);

    const assistShopping = shoppingSnapshot.docs.map((doc) => ({ ...shoppingActivity(doc.id, doc.data() || {}), transactionType: "assist_shopping", status: doc.data()?.state || "pending_manual_quote" }));
    const assistBookings = bookingsSnapshot.docs.map((doc) => ({ ...bookingActivity(doc.id, doc.data() || {}), transactionType: "assist_booking", status: doc.data()?.state || "requested" }));
    const records = [
      ...ordersSnapshot.docs.map((doc) => orderRecord(doc.id, doc.data() || {})).filter(Boolean),
      ...ridesSnapshot.docs.map((doc) => rideRecord(doc.id, doc.data() || {})),
      ...parcelsSnapshot.docs.map((doc) => parcelRecord(doc.id, doc.data() || {})),
      ...assistShopping,
      ...assistBookings
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

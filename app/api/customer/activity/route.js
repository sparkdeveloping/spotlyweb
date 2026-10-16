import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";

export const runtime = "nodejs";

const TERMINAL = new Set(["completed", "complete", "delivered", "cancelled", "canceled", "failed", "refunded", "returned", "checked_out"]);
const ATTENTION_STATES = new Set(["awaiting_payment", "payment_failed", "payment_action_required", "action_required", "substitution_required", "needs_attention", "exception"]);
const ACTIVE_STATES = new Set(["accepted", "confirmed", "preparing", "ready", "picked_up", "collected", "en_route", "out_for_delivery", "requested", "searching_driver", "driver_assigned", "driver_to_pickup", "driver_arrived_pickup", "pickup_verification", "in_trip", "driver_arrived_dropoff", "handoff_verification"]);

function text(value, fallback = "") {
  const resolved = String(value ?? "").trim();
  return resolved || fallback;
}

function iso(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}

function amount(order) {
  const value = Number(order.total ?? order.totals?.total ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function normalizeKind(raw) {
  const value = text(raw, "order").toLowerCase();
  if (["appointment", "service"].includes(value)) return "appointment";
  if (["booking", "stay", "activity"].includes(value)) return "booking";
  if (["ticket", "event"].includes(value)) return "ticket";
  if (value === "ride") return "ride";
  if (["send", "parcel"].includes(value)) return "send";
  return "order";
}

function sectionFor({ state, paymentStatus, scheduledAt }) {
  const status = text(state).toLowerCase();
  const payment = text(paymentStatus).toLowerCase();
  if (["unpaid", "failed", "expired", "action_required", "payment_action_required"].includes(payment) || ATTENTION_STATES.has(status)) return "attention";
  if (TERMINAL.has(status)) return "past";
  if (ACTIVE_STATES.has(status)) return "active";
  if (scheduledAt) {
    const time = Date.parse(scheduledAt);
    if (Number.isFinite(time) && time > Date.now()) return "upcoming";
  }
  return "upcoming";
}

function primaryAction({ state, paymentStatus }) {
  const status = text(state).toLowerCase();
  const payment = text(paymentStatus).toLowerCase();
  if (["unpaid", "failed", "expired", "action_required", "payment_action_required"].includes(payment) || status === "awaiting_payment") return "pay";
  if (["substitution_required", "action_required", "needs_attention", "exception"].includes(status)) return "review";
  return null;
}

function normalizeOrder(id, order) {
  const kind = normalizeKind(order.transactionType);
  const state = text(kind === "ride" ? order.rideStatus : kind === "send" ? order.sendStatus : order.status, "submitted").toLowerCase();
  const firstItem = Array.isArray(order.items) ? order.items.find((item) => text(item?.name)) : null;
  const businessName = text(order.businessName, kind === "ride" ? "Spotly Ride" : kind === "send" ? "Spotly Send" : kind === "ticket" ? "Spotly Events" : kind === "booking" || kind === "appointment" ? "Spotly Book" : "Spotly order");
  const subtitle = kind === "ride"
    ? text(order.dropoff?.label || order.dropoff?.formattedAddress, "Ride")
    : kind === "send"
      ? text(order.dropoff?.label || order.dropoff?.formattedAddress || order.recipientName, "Parcel delivery")
      : text(order.branchName || firstItem?.name, kind === "ticket" ? "Event ticket" : kind === "booking" || kind === "appointment" ? "Booking" : "Order");
  const scheduledAt = iso(order.scheduledAt || order.scheduledPickupAt || order.startsAt || order.startAt);
  const createdAt = iso(order.createdAt || order.requestedAt || order.updatedAt);
  const paymentStatus = text(order.paymentStatus);
  const section = sectionFor({ state, paymentStatus, scheduledAt });
  return {
    id: `order:${id}`,
    kind,
    title: businessName,
    subtitle,
    state,
    section,
    paymentStatus,
    attentionReason: section === "attention" ? (state === "awaiting_payment" || paymentStatus === "unpaid" ? "Payment required" : "Action required") : null,
    primaryAction: primaryAction({ state, paymentStatus }),
    number: text(order.number, id),
    total: amount(order),
    currency: text(order.currency, "USD"),
    createdAt,
    scheduledAt,
    orderId: id,
    rideId: text(order.rideTripId) || null,
    parcelId: text(order.parcelJobId) || null
  };
}

function normalizeRide(id, ride) {
  const state = text(ride.state, "requested").toLowerCase();
  const paymentStatus = text(ride.paymentStatus);
  const scheduledAt = iso(ride.scheduledAt);
  const createdAt = iso(ride.createdAt || ride.requestedAt || ride.updatedAt);
  const section = sectionFor({ state, paymentStatus, scheduledAt });
  return {
    id: `ride:${id}`,
    kind: "ride",
    title: "Spotly Ride",
    subtitle: text(ride.dropoff?.label || ride.dropoff?.formattedAddress || ride.serviceType, "Ride"),
    state,
    section,
    paymentStatus,
    attentionReason: section === "attention" ? "Ride needs attention" : null,
    primaryAction: primaryAction({ state, paymentStatus }),
    number: text(ride.number, id),
    total: Number(ride.quote?.total ?? ride.total ?? 0) || 0,
    currency: text(ride.quote?.currency || ride.currency, "USD"),
    createdAt,
    scheduledAt,
    orderId: text(ride.orderId) || null,
    rideId: id,
    parcelId: null
  };
}

function normalizeParcel(id, parcel) {
  const state = text(parcel.state, "requested").toLowerCase();
  const paymentStatus = text(parcel.paymentStatus);
  const scheduledAt = iso(parcel.scheduledPickupAt);
  const createdAt = iso(parcel.createdAt || parcel.requestedAt || parcel.updatedAt);
  const section = sectionFor({ state, paymentStatus, scheduledAt });
  return {
    id: `send:${id}`,
    kind: "send",
    title: "Spotly Send",
    subtitle: text(parcel.dropoff?.label || parcel.dropoff?.formattedAddress || parcel.recipientName, "Parcel delivery"),
    state,
    section,
    paymentStatus,
    attentionReason: section === "attention" ? "Send request needs attention" : null,
    primaryAction: primaryAction({ state, paymentStatus }),
    number: text(parcel.number, id),
    total: Number(parcel.quote?.total ?? parcel.total ?? 0) || 0,
    currency: text(parcel.quote?.currency || parcel.currency, "USD"),
    createdAt,
    scheduledAt,
    orderId: text(parcel.orderId) || null,
    rideId: null,
    parcelId: id
  };
}

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    await enforceRateLimit(request, { key: "customer_activity", limit: 120, windowMs: 60_000, identity: user.uid });
    const { db } = getAdminServices();

    const [ordersSnapshot, ridesSnapshot, parcelsSnapshot] = await Promise.all([
      db.collection("orders").where("customerId", "==", user.uid).limit(160).get(),
      db.collection("rideTrips").where("customerId", "==", user.uid).limit(80).get(),
      db.collection("parcelJobs").where("customerId", "==", user.uid).limit(80).get()
    ]);

    const records = ordersSnapshot.docs.map((doc) => normalizeOrder(doc.id, doc.data()));
    const representedRideIds = new Set(records.map((item) => item.rideId).filter(Boolean));
    const representedParcelIds = new Set(records.map((item) => item.parcelId).filter(Boolean));

    for (const doc of ridesSnapshot.docs) {
      if (!representedRideIds.has(doc.id)) records.push(normalizeRide(doc.id, doc.data()));
    }
    for (const doc of parcelsSnapshot.docs) {
      if (!representedParcelIds.has(doc.id)) records.push(normalizeParcel(doc.id, doc.data()));
    }

    records.sort((a, b) => Date.parse(b.createdAt || b.scheduledAt || 0) - Date.parse(a.createdAt || a.scheduledAt || 0));
    const counts = records.reduce((result, item) => {
      result[item.section] = (result[item.section] || 0) + 1;
      return result;
    }, { attention: 0, active: 0, upcoming: 0, past: 0 });

    return Response.json({ ok: true, records, counts, generatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { spotlyAdmin } from "./admin.js";
import { sendUserPush } from "./notifications.js";

const ACTIVE_STATUSES = new Set(["requested", "accepted", "confirmed", "scheduled", "issued", "ready", "checked_in"]);
const LIVE_FIELDS = ["active", "eventName", "startsAt", "endsAt", "venue"];

function milliseconds(value) {
  if (!value) return NaN;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  const result = new Date(value).getTime();
  return Number.isFinite(result) ? result : NaN;
}

function isoValue(value) {
  const ms = milliseconds(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function sameValue(left, right) {
  const leftMs = milliseconds(left);
  const rightMs = milliseconds(right);
  if (Number.isFinite(leftMs) || Number.isFinite(rightMs)) return leftMs === rightMs;
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function reminderCopy(order, kind) {
  const type = String(order.transactionType || "");
  const name = type === "ticket" ? (order.event?.name || order.items?.[0]?.name || "Your event") : (order.businessName || "Your reservation");
  if (kind === "soon") {
    if (type === "ticket") return { title: "Your event starts soon", body: `${name} is coming up shortly. Your ticket is ready in Spotly Activity.` };
    if (type === "appointment") return { title: "Your appointment starts soon", body: `${name} is coming up shortly. Check the time and location in Spotly Activity.` };
    return { title: "Your booking starts soon", body: `${name} is coming up shortly. Check your reservation details in Spotly Activity.` };
  }
  if (type === "ticket") return { title: "Event reminder", body: `${name} is tomorrow. Your ticket stays available in Spotly Activity.` };
  if (type === "appointment") return { title: "Appointment reminder", body: `${name} is tomorrow. Review your appointment details in Spotly Activity.` };
  return { title: "Booking reminder", body: `${name} starts tomorrow. Review your reservation details in Spotly Activity.` };
}

async function claimReminder(firestore, orderRef, key) {
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(orderRef);
    if (!snapshot.exists) return null;
    const order = snapshot.data() || {};
    if (!ACTIVE_STATUSES.has(String(order.status || ""))) return null;
    if (!order.customerId || !["appointment", "booking", "ticket"].includes(String(order.transactionType || ""))) return null;
    if (order.reminders?.[key]) return null;
    transaction.update(orderRef, { [`reminders.${key}`]: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    return { ...order, id: orderRef.id };
  });
}

export async function runBookLiveReminders({ nowMs = Date.now() } = {}) {
  const { firestore } = spotlyAdmin();
  const until = nowMs + 24 * 60 * 60 * 1000;
  const snapshot = await firestore.collection("orders")
    .where("scheduledAt", ">=", Timestamp.fromMillis(nowMs - 15 * 60 * 1000))
    .where("scheduledAt", "<=", Timestamp.fromMillis(until))
    .limit(500)
    .get();

  let sent = 0;
  let claimed = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data() || {};
    const scheduledMs = milliseconds(data.scheduledAt);
    if (!Number.isFinite(scheduledMs) || scheduledMs < nowMs) continue;
    const hours = (scheduledMs - nowMs) / 3_600_000;
    const key = hours <= 2 ? "soonAt" : "dayBeforeAt";
    const order = await claimReminder(firestore, doc.ref, key);
    if (!order) continue;
    claimed += 1;
    const copy = reminderCopy(order, key === "soonAt" ? "soon" : "dayBefore");
    const notificationRef = firestore.collection("notifications").doc();
    await notificationRef.set({
      userId: order.customerId,
      businessId: order.businessId || "",
      orderId: doc.id,
      title: copy.title,
      body: copy.body,
      href: `/?view=activity&order=${doc.id}`,
      category: order.transactionType,
      workspace: "customer",
      module: order.transactionType === "ticket" ? "events" : "book",
      eventType: `${order.transactionType}.reminder.${key === "soonAt" ? "soon" : "day_before"}`,
      read: false,
      createdAt: FieldValue.serverTimestamp()
    });
    const result = await sendUserPush({
      userId: order.customerId,
      title: copy.title,
      body: copy.body,
      data: { type: "activity", orderId: doc.id, transactionType: order.transactionType }
    });
    sent += Number(result.sent || 0);
  }
  return { scanned: snapshot.size, claimed, sent };
}

export async function notifyLiveEventUpdate({ productId, before = {}, after = {} }) {
  if (String(after.itemType || before.itemType || "").toLowerCase() !== "ticket") return { skipped: "not_ticket" };
  const changed = LIVE_FIELDS.filter((field) => !sameValue(before[field], after[field]));
  if (!changed.length) return { skipped: "no_customer_visible_change" };
  const businessId = String(after.businessId || before.businessId || "");
  if (!businessId) return { skipped: "missing_business" };

  const { firestore } = spotlyAdmin();
  const eventId = String(after.eventId || before.eventId || productId);
  const snapshot = await firestore.collection("orders").where("businessId", "==", businessId).limit(500).get();
  const holders = snapshot.docs.filter((doc) => {
    const order = doc.data() || {};
    return order.transactionType === "ticket" && order.event?.eventId === eventId && order.customerId && !["cancelled", "refunded"].includes(String(order.status || ""));
  });
  const cancelled = before.active !== false && after.active === false;
  const eventName = String(after.eventName || after.name || before.eventName || before.name || "Spotly Live event");
  const venueChanged = changed.includes("venue");
  const timeChanged = changed.includes("startsAt") || changed.includes("endsAt");
  const title = cancelled ? "Event cancelled" : "Event details changed";
  const body = cancelled
    ? `${eventName} was cancelled. Open Spotly Activity for your ticket and refund options.`
    : `${eventName}${timeChanged ? " has a new time" : venueChanged ? " has a new venue" : " has updated details"}. Open Spotly Activity to review the latest information.`;

  let sent = 0;
  for (const doc of holders) {
    const order = doc.data() || {};
    const startsAt = isoValue(after.startsAt) || order.event?.startsAt || null;
    const endsAt = isoValue(after.endsAt) || order.event?.endsAt || null;
    const venue = String(after.venue ?? order.event?.venue ?? "");
    await doc.ref.update({
      "event.name": eventName,
      "event.startsAt": startsAt,
      "event.endsAt": endsAt,
      "event.venue": venue,
      "event.cancelled": cancelled,
      ...(cancelled ? { eventCancelledAt: FieldValue.serverTimestamp() } : {}),
      ...(after.startsAt ? { scheduledAt: after.startsAt } : {}),
      eventLastUpdatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    const quantity = Math.max(1, Number(order.items?.[0]?.quantity || order.itemCount || 1));
    await Promise.all(Array.from({ length: quantity }, (_, index) => firestore.collection("ticketEntitlements").doc(`${doc.id}_${String(index + 1).padStart(3, "0")}`).set({
      eventName, startsAt, endsAt, venue,
      ...(cancelled ? { state: "revoked", revokedReason: "event_cancelled", revokedAt: FieldValue.serverTimestamp() } : {}),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true })));
    const marker = `eventUpdate.${productId}.${milliseconds(after.updatedAt) || Date.now()}`;
    const notificationRef = firestore.collection("notifications").doc();
    await notificationRef.set({
      userId: order.customerId,
      businessId,
      orderId: doc.id,
      title,
      body,
      href: `/?view=activity&order=${doc.id}`,
      category: "ticket",
      workspace: "customer",
      module: "events",
      eventType: cancelled ? "ticket.event_cancelled" : "ticket.event_updated",
      marker,
      read: false,
      createdAt: FieldValue.serverTimestamp()
    });
    const result = await sendUserPush({ userId: order.customerId, title, body, data: { type: "activity", orderId: doc.id, transactionType: "ticket", eventId } });
    sent += Number(result.sent || 0);
  }
  return { changed, holders: holders.length, sent };
}

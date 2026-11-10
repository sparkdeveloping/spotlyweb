import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { appointmentReservationSpecs, bookingReservationSpecs, reservationCanFit, reservationReleaseCount } from "@/lib/availability-reservations";
import { appointmentSlotAllowed, bookingRangeValidation, localDateTimeEpoch, rescheduleDeadlineMs } from "@/lib/book-live-domain";
import { safeText } from "@/lib/server-helpers";
import { enforceRateLimit } from "@/lib/rate-limit-server";

export const runtime = "nodejs";

const schema = z.object({
  orderId: z.string().min(3).max(180),
  appointment: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), time: z.string().regex(/^\d{2}:\d{2}$/), staffPreference: z.string().max(120).optional() }).strict().optional(),
  booking: z.object({ startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), guests: z.number().int().min(1).max(30).default(1) }).strict().optional(),
  reason: z.string().max(500).optional()
}).strict();

const RESCHEDULABLE = new Set(["requested", "submitted", "accepted", "confirmed", "scheduled", "ready"]);

function reservationEntryMap(entries = []) {
  const map = new Map();
  for (const entry of entries) if (entry?.id) map.set(entry.id, { ...entry, units: Math.max(0, Number(entry.units || 1)) });
  return map;
}

export async function POST(request) {
  try {
    const rate = await enforceRateLimit(request, { key: "customer-transaction-reschedule", limit: 20, windowMs: 60_000 });
    const user = await authenticateRequest(request);
    const body = schema.parse(await request.json());
    const { db } = getAdminServices();
    const orderRef = db.collection("orders").doc(body.orderId);

    const result = await db.runTransaction(async (transaction) => {
      const orderSnapshot = await transaction.get(orderRef);
      if (!orderSnapshot.exists) throw Object.assign(new Error("The booking was not found."), { status: 404 });
      const order = orderSnapshot.data() || {};
      if (order.customerId !== user.uid) throw Object.assign(new Error("You can only change your own booking."), { status: 403 });
      const kind = String(order.transactionType || "");
      if (!["appointment", "booking"].includes(kind)) throw Object.assign(new Error("Only Book reservations can be rescheduled here."), { status: 409 });
      if (!RESCHEDULABLE.has(String(order.status || ""))) throw Object.assign(new Error("This reservation can no longer be changed online."), { status: 409 });
      if (kind === "appointment" && !body.appointment) throw Object.assign(new Error("Choose a new appointment date and time."), { status: 422 });
      if (kind === "booking" && !body.booking) throw Object.assign(new Error("Choose new booking dates."), { status: 422 });

      const productId = order.items?.[0]?.productId;
      if (!productId) throw Object.assign(new Error("This reservation is missing its offering reference."), { status: 409 });
      const productRef = db.collection("products").doc(productId);
      const productSnapshot = await transaction.get(productRef);
      if (!productSnapshot.exists) throw Object.assign(new Error("This offering is no longer available for online changes."), { status: 409 });
      const product = productSnapshot.data() || {};
      const deadline = rescheduleDeadlineMs({ kind, product, order });
      if (Number.isFinite(deadline) && Date.now() >= deadline) throw Object.assign(new Error("Online changes are closed for this reservation. Contact Spotly Support or the business for help."), { status: 409 });

      let newSpecs = [];
      let scheduledAtMs = null;
      let schedulePatch = {};
      if (kind === "appointment") {
        if (!appointmentSlotAllowed({ product, date: body.appointment.date, time: body.appointment.time, timeZone: order.timeZone || "UTC" })) {
          throw Object.assign(new Error("That appointment time is not in the published availability for this service."), { status: 409 });
        }
        newSpecs = appointmentReservationSpecs({ itemId: productId, date: body.appointment.date, time: body.appointment.time, capacity: product.capacity });
        scheduledAtMs = localDateTimeEpoch(body.appointment.date, body.appointment.time, order.timeZone || "UTC");
        schedulePatch = { appointment: { ...(order.appointment || {}), date: body.appointment.date, time: body.appointment.time, staffPreference: safeText(body.appointment.staffPreference, 120) } };
      } else {
        const validation = bookingRangeValidation({ product, startDate: body.booking.startDate, endDate: body.booking.endDate || body.booking.startDate, timeZone: order.timeZone || "UTC" });
        if (!validation.ok) throw Object.assign(new Error(validation.reason), { status: 409 });
        newSpecs = bookingReservationSpecs({ itemId: productId, startDate: body.booking.startDate, endDate: body.booking.endDate || body.booking.startDate, capacity: product.capacity, guests: body.booking.guests, capacityMode: product.capacityMode || "booking" });
        scheduledAtMs = localDateTimeEpoch(body.booking.startDate, "00:00", order.timeZone || "UTC");
        schedulePatch = { booking: { ...(order.booking || {}), startDate: body.booking.startDate, endDate: body.booking.endDate || body.booking.startDate, guests: body.booking.guests } };
      }

      const oldEntries = reservationEntryMap(order.availabilityReservations || []);
      const newEntries = new Map(newSpecs.map((entry) => [entry.id, entry]));
      const ids = [...new Set([...oldEntries.keys(), ...newEntries.keys()])];
      const refs = new Map(ids.map((id) => [id, db.collection("availabilityReservations").doc(id)]));
      const snapshots = new Map();
      for (const id of ids) snapshots.set(id, await transaction.get(refs.get(id)));

      for (const [id, spec] of newEntries) {
        const current = snapshots.get(id)?.exists ? Math.max(0, Number(snapshots.get(id).data()?.reserved || 0)) : 0;
        const afterRelease = oldEntries.has(id) ? reservationReleaseCount(current, oldEntries.get(id).units) : current;
        if (!reservationCanFit(afterRelease, spec.units, spec.capacity)) {
          throw Object.assign(new Error(kind === "appointment" ? "That appointment time was just taken. Choose another time." : "Those dates no longer have enough capacity."), { status: 409 });
        }
      }

      for (const id of ids) {
        const snapshot = snapshots.get(id);
        const current = snapshot?.exists ? Math.max(0, Number(snapshot.data()?.reserved || 0)) : 0;
        const afterRelease = oldEntries.has(id) ? reservationReleaseCount(current, oldEntries.get(id).units) : current;
        const next = newEntries.has(id) ? afterRelease + Math.max(0, Number(newEntries.get(id).units || 1)) : afterRelease;
        const ref = refs.get(id);
        if (next <= 0) transaction.delete(ref);
        else {
          const spec = newEntries.get(id) || oldEntries.get(id);
          transaction.set(ref, {
            itemId: productId,
            businessId: order.businessId || "",
            branchId: order.branchId || "",
            kind: spec.kind || kind,
            key: spec.key || "",
            capacity: Math.max(0, Number(spec.capacity || product.capacity || 0)),
            reserved: next,
            updatedAt: FieldValue.serverTimestamp(),
            ...(snapshot?.exists ? {} : { createdAt: FieldValue.serverTimestamp() })
          }, { merge: true });
        }
      }

      const nextStatus = product.requiresBusinessReview === true ? "requested" : (order.status === "requested" ? "confirmed" : order.status);
      const availabilityReservations = newSpecs.map((spec) => ({ id: spec.id, units: spec.units, key: spec.key, kind: spec.kind }));
      transaction.set(orderRef, {
        ...schedulePatch,
        availabilityReservations,
        scheduledAt: Number.isFinite(scheduledAtMs) ? Timestamp.fromMillis(scheduledAtMs) : order.scheduledAt || null,
        status: nextStatus,
        rescheduledAt: FieldValue.serverTimestamp(),
        rescheduledBy: user.uid,
        rescheduleReason: safeText(body.reason, 500),
        updatedAt: FieldValue.serverTimestamp(),
        timeline: FieldValue.arrayUnion({ status: nextStatus, note: safeText(body.reason || "Customer rescheduled", 500), at: new Date().toISOString(), actorId: user.uid, actorName: user.name || user.email || "Customer" })
      }, { merge: true });
      transaction.create(db.collection("orderEvents").doc(), { orderId: body.orderId, type: `${kind}_rescheduled`, previousStatus: order.status || null, status: nextStatus, actorType: "customer", actorId: user.uid, source: "customer_activity", metadata: { oldAvailability: [...oldEntries.keys()], newAvailability: newSpecs.map((spec) => spec.id) }, createdAt: FieldValue.serverTimestamp() });
      transaction.create(db.collection("notifications").doc(), { userId: user.uid, businessId: order.businessId || "", orderId: body.orderId, title: kind === "appointment" ? "Appointment changed" : "Booking changed", body: `Your ${kind} ${order.number || body.orderId.slice(0, 8)} was updated.`, href: `/?view=activity&order=${body.orderId}`, category: kind, workspace: "customer", module: "book", eventType: `${kind}.rescheduled`, read: false, createdAt: FieldValue.serverTimestamp() });
      return { status: nextStatus, kind };
    });

    return Response.json({ ok: true, orderId: body.orderId, ...result }, { headers: { "X-RateLimit-Remaining": String(rate.remaining) } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the new reservation details.", details: error.flatten() }, { status: 400 });
    return apiError(error);
  }
}

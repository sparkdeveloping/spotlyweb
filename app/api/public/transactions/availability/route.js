import { apiError, getAdminServices } from "@/lib/firebase-admin";
import { appointmentReservationSpecs, bookingReservationSpecs } from "@/lib/availability-reservations";
import { appointmentRules, appointmentSlotTimes, bookingRangeValidation, bookingRules, dateKey, addDays, ticketRules } from "@/lib/book-live-domain";
import { countryTimeZone, normalizeCountryCode } from "@/lib/country-engine";
import { requireServiceDiscoverable } from "@/lib/service-availability-server";

export const runtime = "nodejs";

function businessTypeFor(business = {}) {
  if (business.businessType) return business.businessType;
  const category = String(business.category || business.categories?.[0] || "").toLowerCase();
  if (category.includes("event")) return "ticketing_events";
  if (["beauty", "wellness", "health", "professional", "education"].some((value) => category.includes(value))) return "appointments_services";
  if (["accommodation", "activities"].some((value) => category.includes(value))) return "accommodation_activities";
  return "directory_profile";
}

function kindFor(type) {
  if (type === "ticketing_events") return "ticket";
  if (type === "appointments_services") return "appointment";
  if (type === "accommodation_activities") return "booking";
  return null;
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const itemId = String(url.searchParams.get("itemId") || "").trim();
    const branchId = String(url.searchParams.get("branchId") || "").trim();
    const requestedDays = Number(url.searchParams.get("days") || 60);
    const days = Math.max(7, Math.min(120, Number.isFinite(requestedDays) ? Math.floor(requestedDays) : 60));
    if (!itemId || !branchId) throw Object.assign(new Error("Choose an offering and location."), { status: 422 });

    const { db } = getAdminServices();
    const [productSnapshot, branchSnapshot, reservationsSnapshot, settingsSnapshot] = await Promise.all([
      db.collection("products").doc(itemId).get(),
      db.collection("branches").doc(branchId).get(),
      db.collection("availabilityReservations").where("itemId", "==", itemId).limit(2500).get(),
      db.collection("platformSettings").doc("global").get()
    ]);
    if (!productSnapshot.exists) throw Object.assign(new Error("This offering is no longer available."), { status: 404 });
    if (!branchSnapshot.exists) throw Object.assign(new Error("This location is no longer available."), { status: 404 });
    const product = { id: productSnapshot.id, ...(productSnapshot.data() || {}) };
    const branch = { id: branchSnapshot.id, ...(branchSnapshot.data() || {}) };
    if (product.businessId !== branch.businessId || (product.branchIds?.length && !product.branchIds.includes(branchId))) throw Object.assign(new Error("This offering is not available at this location."), { status: 409 });
    const businessSnapshot = await db.collection("businesses").doc(product.businessId).get();
    if (!businessSnapshot.exists) throw Object.assign(new Error("This business is no longer available."), { status: 404 });
    const business = businessSnapshot.data() || {};
    const type = businessTypeFor(business);
    const kind = kindFor(type);
    if (!kind) throw Object.assign(new Error("This offering is not a Book or Live transaction."), { status: 409 });
    const country = normalizeCountryCode(branch.country || business.country);
    const city = branch.city || business.city || "";
    const timeZone = countryTimeZone(country);
    const service = kind === "ticket" ? "events" : "book";
    const availability = requireServiceDiscoverable(settingsSnapshot.data() || {}, { service, country, city });
    const reservationMap = new Map(reservationsSnapshot.docs.map((doc) => [doc.id, doc.data() || {}]));
    const today = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

    if (kind === "appointment") {
      const rules = appointmentRules(product);
      const rows = [];
      for (let index = 0; index < Math.min(days, rules.maxAdvanceDays + 1); index += 1) {
        const date = addDays(today, index);
        const slots = appointmentSlotTimes({ product, date, timeZone }).map((time) => {
          const spec = appointmentReservationSpecs({ itemId, date, time, capacity: rules.capacity })[0];
          const reserved = spec ? Math.max(0, Number(reservationMap.get(spec.id)?.reserved || 0)) : 0;
          const remaining = rules.capacity > 0 ? Math.max(0, rules.capacity - reserved) : null;
          return { time, capacity: rules.capacity || null, reserved, remaining, available: remaining === null || remaining > 0 };
        });
        if (slots.length) rows.push({ date, slots });
      }
      return Response.json({ ok: true, kind, service, country, city, timeZone, serviceAvailability: availability, rules, days: rows, item: { id: itemId, name: product.name || "Service", durationMinutes: rules.durationMinutes } });
    }

    if (kind === "booking") {
      const rules = bookingRules(product);
      const rows = [];
      for (let index = 0; index < Math.min(days, rules.maxAdvanceDays + 1); index += 1) {
        const date = addDays(today, index);
        const minimumEndDate = rules.minStayDays <= 1 ? date : addDays(date, rules.minStayDays);
        const validation = bookingRangeValidation({ product, startDate: date, endDate: minimumEndDate, timeZone });
        const spec = bookingReservationSpecs({ itemId, startDate: date, endDate: date, capacity: rules.capacity, guests: 1, capacityMode: rules.capacityMode })[0];
        const reserved = spec ? Math.max(0, Number(reservationMap.get(spec.id)?.reserved || 0)) : 0;
        const remaining = rules.capacity > 0 ? Math.max(0, rules.capacity - reserved) : null;
        rows.push({ date, capacity: rules.capacity || null, reserved, remaining, available: validation.ok && (remaining === null || remaining > 0) });
      }
      return Response.json({ ok: true, kind, service, country, city, timeZone, serviceAvailability: availability, rules, days: rows, item: { id: itemId, name: product.name || "Booking" } });
    }

    const rules = ticketRules(product);
    const capacity = Math.max(0, Number(product.capacity || 0));
    const reserved = Math.max(0, Number(product.reservedQuantity || 0));
    const remaining = capacity > 0 ? Math.max(0, capacity - reserved) : null;
    return Response.json({
      ok: true, kind, service, country, city, timeZone, serviceAvailability: availability,
      rules: { salesOpen: rules.salesOpen, salesStartAt: rules.salesStartAt?.toISOString() || null, salesEndAt: rules.salesEndAt?.toISOString() || null, transferable: rules.transferable, cancellationCutoffMinutes: rules.cancellationCutoffMinutes, maxQuantity: rules.maxQuantity },
      ticket: { eventId: rules.eventId, eventName: rules.eventName, tier: rules.ticketTier, capacity: capacity || null, reserved, remaining, startsAt: rules.startsAt?.toISOString() || null, endsAt: rules.endsAt?.toISOString() || null, venue: product.venue || branch.address || branch.branchName || "", soldOut: remaining === 0, salesOpen: rules.salesOpen },
      item: { id: itemId, name: product.name || "Ticket" }
    });
  } catch (error) {
    return apiError(error);
  }
}

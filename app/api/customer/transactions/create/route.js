import { requireCustomerLaunchAccess } from "@/lib/customer-launch-server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { buildOrderTotals } from "@/lib/order-money";
import { safeText } from "@/lib/server-helpers";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { promotionCandidateRefs, resolvePromotionSnapshots } from "@/lib/promotion-server";
import { appointmentReservationSpecs, bookingReservationSpecs, reservationCanFit } from "@/lib/availability-reservations";
import { marketplaceTrust } from "@/lib/marketplace-trust";
import { transactionCreateRequestSchema } from "@/lib/contracts/schemas";
import { countryDefinition, countryTimeZone, normalizeCountryCode } from "@/lib/country-engine";
import { requireServiceLive } from "@/lib/service-availability-server";
import { operationContextFor } from "@/lib/operations-grants-server";
import { appointmentSlotAllowed, bookingRangeValidation, localDateTimeEpoch, ticketRules } from "@/lib/book-live-domain";
import { issueTicketEntitlementsInTransaction, ticketCode } from "@/lib/ticket-entitlements-server";

export const runtime = "nodejs";

const schema = transactionCreateRequestSchema;

function transactionNumber(prefix = "SP") {
  const ymd = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `${prefix}-${ymd}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function idempotencyId(uid, checkoutId) {
  return `${uid}_${checkoutId}`.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 300);
}

function businessTypeFor(business = {}) {
  if (business.businessType) return business.businessType;
  const category = String(business.category || business.categories?.[0] || "").toLowerCase();
  if (category.includes("event")) return "ticketing_events";
  if (["beauty", "wellness", "health", "professional", "education"].some((value) => category.includes(value))) return "appointments_services";
  if (["accommodation", "activities"].some((value) => category.includes(value))) return "accommodation_activities";
  return "directory_profile";
}

function transactionKind(type) {
  if (type === "ticketing_events") return "ticket";
  if (type === "appointments_services") return "appointment";
  if (type === "accommodation_activities") return "booking";
  return null;
}

function plainDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function POST(request) {
  try {
    const rate = await enforceRateLimit(request, { key: "customer-transaction-create", limit: 30, windowMs: 60_000 });
    const user = await authenticateRequest(request);
    await requireCustomerLaunchAccess(user, getAdminServices().db);
    const body = schema.parse(await request.json());
    if (!user.email) throw Object.assign(new Error("Add and verify an email sign-in before booking."), { status: 409 });

    const { auth, db } = getAdminServices();
    const requestRef = db.collection("customerTransactionRequests").doc(idempotencyId(user.uid, body.checkoutId));
    const existing = await requestRef.get();
    if (existing.exists) return Response.json({ ok: true, ...existing.data(), idempotent: true }, { headers: { "X-RateLimit-Remaining": String(rate.remaining) } });

    const [authUser, businessSnapshot, branchSnapshot, productSnapshot, settingsSnapshot, financeSnapshot, legacyFinanceSnapshot] = await Promise.all([
      auth.getUser(user.uid),
      db.collection("businesses").doc(body.businessId).get(),
      db.collection("branches").doc(body.branchId).get(),
      db.collection("products").doc(body.itemId).get(),
      db.collection("platformSettings").doc("global").get(),
      db.collection("businessFinance").doc(body.businessId).get(),
      db.collection("businessFinanceSettings").doc(body.businessId).get()
    ]);

    const supportedProviders = new Set(["password", "google.com", "apple.com"]);
    if (!authUser.providerData.some((provider) => supportedProviders.has(provider.providerId))) {
      throw Object.assign(new Error("Sign in with email, Google or Apple before continuing."), { status: 409 });
    }
    if (!businessSnapshot.exists) throw Object.assign(new Error("This business is no longer available."), { status: 404 });
    if (!marketplaceTrust(businessSnapshot.data() || {}).commerceVerified) throw Object.assign(new Error("This listing is not commerce verified yet and cannot accept bookings or tickets."), { status: 409 });
    if (!branchSnapshot.exists) throw Object.assign(new Error("Choose a valid location."), { status: 422 });
    if (!productSnapshot.exists) throw Object.assign(new Error("This offering is no longer available."), { status: 404 });

    const business = businessSnapshot.data();
    const branch = branchSnapshot.data();
    const product = productSnapshot.data();
    const settings = settingsSnapshot.data() || {};
    const countryCode = normalizeCountryCode(branch.country || business.country);
    const country = countryDefinition(countryCode);
    if (!country) throw Object.assign(new Error("This location needs a supported country before it can accept bookings or tickets."), { status: 409 });
    if (branch.country && business.country && normalizeCountryCode(branch.country) !== normalizeCountryCode(business.country)) throw Object.assign(new Error("This location country does not match its business record."), { status: 409 });
    const timeZone = countryTimeZone(countryCode);
    const type = businessTypeFor(business);
    const kind = transactionKind(type);
    if (!kind) throw Object.assign(new Error("Online booking is not enabled for this business type."), { status: 409 });
    requireServiceLive(settings, { service: kind === "ticket" ? "events" : "book", country: countryCode, city: branch.city || business.city || "" });
    const transactionService = kind === "ticket" ? "events" : "book";
    const { context: operations } = await operationContextFor(db, user.uid, { service: transactionService, country: countryCode, city: branch.city || business.city || "" });

    const live = business.public === true && (business.status === "active" || business.lifecycleStatus === "live");
    if (!live) throw Object.assign(new Error("This business is not accepting customer activity yet."), { status: 404 });
    if (branch.businessId !== body.businessId || branch.public === false || (branch.status && branch.status !== "active")) {
      throw Object.assign(new Error("This location is not accepting customer activity."), { status: 409 });
    }
    if (product.businessId !== body.businessId || product.published !== true || product.active === false || product.available === false || product.status === "archived") {
      throw Object.assign(new Error("This offering is no longer available."), { status: 409 });
    }
    if (product.branchIds?.length && !product.branchIds.includes(body.branchId)) {
      throw Object.assign(new Error("This offering is not available at the selected location."), { status: 409 });
    }

    const marketplaceOpen = settings.launch?.marketplaceEnabled === true;
    if (!marketplaceOpen) throw Object.assign(new Error("This customer service is not accepting production transactions right now. Use Operations mode for isolated testing."), { status: 403 });

    if (kind === "appointment" && !body.appointment) throw Object.assign(new Error("Choose an appointment date and time."), { status: 422 });
    if (kind === "booking" && !body.booking) throw Object.assign(new Error("Choose booking dates."), { status: 422 });
    if (kind === "appointment") {
      if (!appointmentSlotAllowed({ product, date: body.appointment.date, time: body.appointment.time, timeZone })) {
        throw Object.assign(new Error("That appointment time is outside the published availability or booking window."), { status: 422 });
      }
    }
    if (kind === "booking") {
      const validation = bookingRangeValidation({ product, startDate: body.booking.startDate, endDate: body.booking.endDate, timeZone });
      if (!validation.ok) throw Object.assign(new Error(validation.reason), { status: 422 });
    }
    if (kind === "ticket") {
      const rules = ticketRules(product);
      if (!rules.salesOpen) throw Object.assign(new Error("Ticket sales are not currently open for this event."), { status: 409 });
    }

    const finance = { ...(legacyFinanceSnapshot.data() || {}), ...(financeSnapshot.data() || {}) };
    const platformCurrencies = settings.commerce?.currencies || ["USD", "ZWG"];
    const businessCurrencies = finance.acceptedCurrencies || platformCurrencies;
    const branchCurrencies = branch.acceptedCurrencies || businessCurrencies;
    if (!platformCurrencies.includes(body.currency) || !businessCurrencies.includes(body.currency) || !branchCurrencies.includes(body.currency)) {
      throw Object.assign(new Error("That currency is not currently available for this location."), { status: 422 });
    }

    const rawPrice = product.prices?.[body.currency] ?? (product.currency === body.currency || !product.currency ? product.price : undefined);
    const unitPrice = Number(rawPrice || 0);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) throw Object.assign(new Error(`This offering does not have a valid ${body.currency} price.`), { status: 409 });

    const requestedQuantity = kind === "ticket" ? body.quantity : 1;
    const maxQuantity = kind === "ticket" ? ticketRules(product).maxQuantity : 1;
    if (requestedQuantity > maxQuantity) throw Object.assign(new Error(`You can select up to ${maxQuantity}.`), { status: 409 });

    const capacity = Number(product.capacity || 0);
    const reserved = Math.max(0, Number(product.reservedQuantity || 0));
    if (kind === "ticket" && capacity > 0 && requestedQuantity > Math.max(0, capacity - reserved)) {
      throw Object.assign(new Error("There are not enough tickets remaining for that quantity."), { status: 409 });
    }

    const [promotionRefs, priorOrders] = await Promise.all([
      promotionCandidateRefs(db, body.businessId, body.promoCode || ""),
      db.collection("orders").where("customerId", "==", user.uid).limit(1).get()
    ]);
    const prefix = kind === "ticket" ? "TK" : kind === "appointment" ? "AP" : "BK";
    const number = transactionNumber(prefix);
    const orderRef = db.collection("orders").doc();
    const eventRef = db.collection("orderEvents").doc();
    const notificationRef = db.collection("notifications").doc();
    const now = FieldValue.serverTimestamp();

    const response = await db.runTransaction(async (transaction) => {
      const [freshRequest, freshProduct, freshBusiness, freshBranch, promotionSnapshots] = await Promise.all([
        transaction.get(requestRef),
        transaction.get(db.collection("products").doc(body.itemId)),
        transaction.get(db.collection("businesses").doc(body.businessId)),
        transaction.get(db.collection("branches").doc(body.branchId)),
        Promise.all(promotionRefs.map((ref) => transaction.get(ref)))
      ]);
      if (freshRequest.exists) return { ...freshRequest.data(), idempotent: true };
      if (!freshProduct.exists || !freshBusiness.exists || !freshBranch.exists) throw Object.assign(new Error("This offering changed while you were booking. Try again."), { status: 409 });
      const latestProduct = freshProduct.data();
      const latestBusiness = freshBusiness.data();
      const latestBranch = freshBranch.data();
      const latestCountryCode = normalizeCountryCode(latestBranch.country || latestBusiness.country);
      if (latestCountryCode !== countryCode) throw Object.assign(new Error("This location country changed while you were booking. Refresh and try again."), { status: 409 });
      const latestBusinessLive = latestBusiness.public === true && (latestBusiness.status === "active" || latestBusiness.lifecycleStatus === "live");
      if (!latestBusinessLive) throw Object.assign(new Error("This business stopped accepting customer activity while you were booking."), { status: 409 });
      if (latestBranch.businessId !== body.businessId || latestBranch.public === false || (latestBranch.status && latestBranch.status !== "active")) throw Object.assign(new Error("This location stopped accepting customer activity while you were booking."), { status: 409 });
      if (latestProduct.businessId !== body.businessId || latestProduct.published !== true || latestProduct.available === false || latestProduct.active === false || latestProduct.status === "archived") throw Object.assign(new Error("This offering is no longer available."), { status: 409 });
      if (latestProduct.branchIds?.length && !latestProduct.branchIds.includes(body.branchId)) throw Object.assign(new Error("This offering is no longer available at the selected location."), { status: 409 });
      if (kind === "ticket") {
        const latestTicketRules = ticketRules(latestProduct);
        if (!latestTicketRules.salesOpen) throw Object.assign(new Error("Ticket sales closed while you were checking out."), { status: 409 });
        if (requestedQuantity > latestTicketRules.maxQuantity) throw Object.assign(new Error(`You can select up to ${latestTicketRules.maxQuantity}.`), { status: 409 });
        const latestCapacity = Number(latestProduct.capacity || 0);
        const latestReserved = Math.max(0, Number(latestProduct.reservedQuantity || 0));
        if (latestCapacity > 0 && requestedQuantity > Math.max(0, latestCapacity - latestReserved)) throw Object.assign(new Error("Those tickets were just taken. Choose a smaller quantity."), { status: 409 });
      } else if (kind === "appointment") {
        if (!appointmentSlotAllowed({ product: latestProduct, date: body.appointment.date, time: body.appointment.time, timeZone })) {
          throw Object.assign(new Error("That appointment time is no longer available in the published schedule."), { status: 409 });
        }
      } else if (kind === "booking") {
        const validation = bookingRangeValidation({ product: latestProduct, startDate: body.booking.startDate, endDate: body.booking.endDate, timeZone });
        if (!validation.ok) throw Object.assign(new Error(validation.reason), { status: 409 });
      }

      const availabilitySpecs = kind === "appointment"
        ? appointmentReservationSpecs({ itemId: body.itemId, date: body.appointment?.date, time: body.appointment?.time, capacity: latestProduct.capacity })
        : kind === "booking"
          ? bookingReservationSpecs({ itemId: body.itemId, startDate: body.booking?.startDate, endDate: body.booking?.endDate, capacity: latestProduct.capacity, guests: body.booking?.guests, capacityMode: latestProduct.capacityMode || "booking" })
          : [];
      const availabilityRefs = availabilitySpecs.map((spec) => db.collection("availabilityReservations").doc(spec.id));
      const availabilitySnapshots = await Promise.all(availabilityRefs.map((ref) => transaction.get(ref)));
      availabilitySpecs.forEach((spec, index) => {
        const currentReserved = availabilitySnapshots[index]?.exists ? Number(availabilitySnapshots[index].data()?.reserved || 0) : 0;
        if (!reservationCanFit(currentReserved, spec.units, spec.capacity)) {
          const message = kind === "appointment" ? "That appointment time was just taken. Choose another time." : "That booking no longer has enough capacity for those dates.";
          throw Object.assign(new Error(message), { status: 409 });
        }
      });

      const latestRawPrice = latestProduct.prices?.[body.currency] ?? (latestProduct.currency === body.currency || !latestProduct.currency ? latestProduct.price : undefined);
      const latestUnitPrice = Number(latestRawPrice || 0);
      if (!Number.isFinite(latestUnitPrice) || latestUnitPrice < 0) throw Object.assign(new Error(`This offering no longer has a valid ${body.currency} price.`), { status: 409 });
      const latestSubtotal = Number((latestUnitPrice * requestedQuantity).toFixed(2));
      const line = {
        productId: body.itemId,
        name: safeText(latestProduct.name || "Offering", 160),
        sku: latestProduct.sku || "",
        image: latestProduct.image || "",
        quantity: requestedQuantity,
        unitPrice: latestUnitPrice,
        lineTotal: latestSubtotal,
        variant: safeText(latestProduct.variant || latestProduct.packSize || "", 120),
        ticketType: kind === "ticket" ? safeText(latestProduct.variant || latestProduct.name || "Standard", 120) : "",
        durationLabel: kind === "appointment" ? `${Number(latestProduct.durationMinutes || 30)} min` : ""
      };
      const promotionResult = resolvePromotionSnapshots(promotionSnapshots, { businessId: body.businessId, branchId: body.branchId, currency: body.currency, lines: [line], code: body.promoCode || "", isNewCustomer: priorOrders.empty, previewAccess: operations.servicePreview });
      if (body.promoCode && !promotionResult?.quote?.eligible) throw Object.assign(new Error(promotionResult?.quote?.reason || "That promotion could not be applied."), { status: 409 });
      const promotionDiscount = promotionResult?.quote?.eligible ? Number(promotionResult.quote.discount || 0) : 0;
      const latestTotals = buildOrderTotals({
        subtotal: latestSubtotal,
        discount: promotionDiscount,
        serviceFee: Number(finance.customerServiceFee || settings.commerce?.bookingServiceFee || 0),
        commissionPercent: Number(finance.commissionPercent ?? settings.commerce?.defaultCommissionPercent ?? 0)
      });
      const paymentRequired = body.paymentMethod !== "pay_later" && latestTotals.total > 0;
      const requiresBusinessReview = latestProduct.requiresBusinessReview === true;
      const appointmentAtMs = kind === "appointment" ? localDateTimeEpoch(body.appointment?.date, body.appointment?.time, timeZone) : null;
      const bookingAtMs = kind === "booking" ? localDateTimeEpoch(body.booking?.startDate, "00:00", timeZone) : null;
      const eventStartDate = kind === "ticket" ? plainDate(latestProduct.startsAt) : null;
      const scheduledAtMs = kind === "appointment" ? appointmentAtMs : kind === "booking" ? bookingAtMs : eventStartDate?.getTime?.();
      const initialStatus = paymentRequired
        ? "awaiting_payment"
        : kind === "ticket"
          ? "issued"
          : requiresBusinessReview
            ? "requested"
            : "confirmed";

      const base = {
        number,
        orderNumber: number,
        reference: number,
        transactionType: kind,
        businessType: type,
        customerId: user.uid,
        customerEmail: user.email || "",
        customerName: safeText(body.contactName, 120),
        customerPhone: safeText(body.contactPhone, 40),
        businessId: body.businessId,
        businessName: safeText(latestBusiness.name || "Business", 160),
        branchId: body.branchId,
        branchName: safeText(latestBranch.branchName || latestBranch.name || "Location", 160),
        locationName: safeText(latestBranch.branchName || latestBranch.name || "Location", 160),
        country: countryCode,
        timeZone,
        currency: body.currency,
        items: [line],
        itemCount: requestedQuantity,
        totals: latestTotals,
        total: latestTotals.total,
        promotion: promotionResult?.quote?.eligible ? { id: promotionResult.promotion.id, name: safeText(promotionResult.promotion.name || promotionResult.quote.label, 160), code: promotionResult.quote.code || "", type: promotionResult.promotion.type || "percentage", value: Number(promotionResult.promotion.value || 0), discount: promotionDiscount } : null,
        paymentMethod: body.paymentMethod,
        paymentStatus: paymentRequired ? "unpaid" : latestTotals.total <= 0 ? "not_required" : "pay_later",
        status: initialStatus,
        requiresBusinessReview,
        scheduledAt: Number.isFinite(scheduledAtMs) ? Timestamp.fromMillis(scheduledAtMs) : null,
        notes: safeText(body.notes, 600),
        inventoryReservationStatus: kind === "ticket" || availabilitySpecs.length ? "reserved" : "not_applicable",
        availabilityReservations: availabilitySpecs.map((spec) => ({ id: spec.id, units: spec.units, key: spec.key, kind: spec.kind })),
        createdAt: now,
        updatedAt: now
      };

      if (kind === "ticket") {
        const startsDate = plainDate(latestProduct.startsAt);
        const endsDate = plainDate(latestProduct.endsAt);
        const liveRules = ticketRules(latestProduct);
        const issuedCodes = initialStatus === "issued" ? Array.from({ length: requestedQuantity }, () => ticketCode()) : [];
        const ticketOrder = {
          ...base,
          fulfilment: "ticketing",
          ...(issuedCodes.length ? { ticketCodes: issuedCodes, ticketCode: issuedCodes[0], ticketOwnershipStatus: "issued", issuedAt: now } : { ticketOwnershipStatus: "pending" }),
          event: {
            eventId: liveRules.eventId || body.itemId,
            name: safeText(liveRules.eventName, 160),
            tier: safeText(liveRules.ticketTier, 120),
            date: startsDate ? startsDate.toISOString().slice(0, 10) : "",
            time: startsDate ? startsDate.toLocaleTimeString("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }) : "",
            startsAt: startsDate ? startsDate.toISOString() : null,
            endsAt: endsDate ? endsDate.toISOString() : null,
            venue: safeText(latestProduct.venue || latestBranch.address || latestBranch.branchName || "", 240),
            transferable: liveRules.transferable
          }
        };
        transaction.create(orderRef, ticketOrder);
        if (issuedCodes.length) await issueTicketEntitlementsInTransaction(transaction, db, orderRef, ticketOrder, { now, source: "customer_transaction_create", codes: issuedCodes, patchOrder: false });
        transaction.set(db.collection("products").doc(body.itemId), { reservedQuantity: FieldValue.increment(requestedQuantity), updatedAt: now }, { merge: true });
      } else if (kind === "appointment") {
        transaction.create(orderRef, {
          ...base,
          fulfilment: "appointment",
          appointment: {
            date: body.appointment.date,
            time: body.appointment.time,
            durationMinutes: Number(latestProduct.durationMinutes || 30),
            customerName: safeText(body.contactName, 120),
            customerPhone: safeText(body.contactPhone, 40),
            staffPreference: safeText(body.appointment.staffPreference, 120),
            notes: safeText(body.notes, 600)
          }
        });
      } else {
        transaction.create(orderRef, {
          ...base,
          fulfilment: "booking",
          booking: {
            startDate: body.booking.startDate,
            endDate: body.booking.endDate || body.booking.startDate,
            guestName: safeText(body.contactName, 120),
            guestPhone: safeText(body.contactPhone, 40),
            guests: body.booking.guests,
            notes: safeText(body.notes, 600)
          }
        });
      }

      availabilitySpecs.forEach((spec, index) => {
        const currentReserved = availabilitySnapshots[index]?.exists ? Math.max(0, Number(availabilitySnapshots[index].data()?.reserved || 0)) : 0;
        transaction.set(availabilityRefs[index], {
          itemId: body.itemId, businessId: body.businessId, branchId: body.branchId, kind: spec.kind, key: spec.key, capacity: spec.capacity, reserved: currentReserved + spec.units, updatedAt: now, ...(availabilitySnapshots[index]?.exists ? {} : { createdAt: now })
        }, { merge: true });
      });

      if (promotionResult?.quote?.eligible) {
        transaction.set(db.collection("promotions").doc(promotionResult.promotion.id), { usedCount: FieldValue.increment(1), updatedAt: now }, { merge: true });
        transaction.create(db.collection("promotionRedemptions").doc(`${promotionResult.promotion.id}_${orderRef.id}`), { promotionId: promotionResult.promotion.id, orderId: orderRef.id, customerId: user.uid, businessId: body.businessId, branchId: body.branchId, code: promotionResult.quote.code || "", discount: promotionDiscount, currency: body.currency, status: "reserved", createdAt: now });
      }

      transaction.create(eventRef, {
        orderId: orderRef.id,
        type: `${kind}_requested`,
        previousStatus: null,
        status: base.status,
        actorType: "customer",
        actorId: user.uid,
        source: "customer_marketplace",
        metadata: { businessId: body.businessId, branchId: body.branchId, itemId: body.itemId, quantity: requestedQuantity, promotionId: promotionResult?.quote?.eligible ? promotionResult.promotion.id : null, discount: promotionDiscount },
        createdAt: now
      });
      transaction.create(notificationRef, {
        userId: user.uid,
        title: kind === "ticket" ? (initialStatus === "issued" ? "Tickets ready" : "Ticket checkout created") : kind === "appointment" ? (initialStatus === "confirmed" ? "Appointment confirmed" : "Appointment requested") : (initialStatus === "confirmed" ? "Booking confirmed" : "Booking requested"),
        body: initialStatus === "issued" ? `${number} is ready in Activity.` : initialStatus === "confirmed" ? `${number} is confirmed with ${latestBusiness.name || "the business"}.` : `${number} was sent to ${latestBusiness.name || "the business"}.`,
        href: `/?view=activity&order=${encodeURIComponent(orderRef.id)}`,
        category: kind,
        workspace: "customer",
        read: false,
        createdAt: now
      });

      const result = { orderId: orderRef.id, number, total: latestTotals.total, currency: body.currency, paymentRequired, transactionType: kind, status: base.status, discount: promotionDiscount, promotion: base.promotion };
      transaction.create(requestRef, { ...result, customerId: user.uid, checkoutId: body.checkoutId, createdAt: now });
      return result;
    });

    return Response.json({ ok: true, ...response }, { headers: { "X-RateLimit-Remaining": String(rate.remaining) } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the booking details and try again.", details: error.flatten() }, { status: 400 });
    return apiError(error);
  }
}

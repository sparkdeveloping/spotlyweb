import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { marketplaceTrust } from "@/lib/marketplace-trust";
import { canAssistBook, quoteBookingInput } from "@/lib/spotly-assist";

export const runtime = "nodejs";
const schema = z.object({
  requestId: z.string().regex(/^[A-Za-z0-9_-]{12,70}$/),
  businessId: z.string().min(2).max(180),
  serviceName: z.string().trim().min(2).max(160),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  flexibility: z.enum(["nearby", "exact"]).default("nearby"),
  alternativeWindow: z.string().trim().max(200).default(""),
  contactName: z.string().trim().min(2).max(120),
  contactPhone: z.string().trim().min(7).max(40),
  notes: z.string().trim().max(500).default("")
}).strict();

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    const { db } = getAdminServices();
    const snapshot = await db.collection("assistedBookings").where("customerId", "==", user.uid).limit(40).get();
    const bookings = snapshot.docs.map((doc) => {
      const b = doc.data();
      return {
        id: doc.id, businessName: b.businessName, serviceName: b.serviceName, state: b.state,
        requestedDate: b.preferredDate, requestedTime: b.preferredTime,
        proposedDate: b.proposedDate || null, proposedTime: b.proposedTime || null,
        confirmedDate: b.confirmedDate || null, confirmedTime: b.confirmedTime || null,
        updateMessage: b.customerMessage || "",
        createdAt: b.createdAt?.toDate?.()?.toISOString?.() || null
      };
    });
    return Response.json({ ok: true, bookings: bookings.sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt))) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const data = schema.parse(await request.json());
    const booking = quoteBookingInput(data);
    const rate = await enforceRateLimit(request, { key: "assist-booking", limit: 8, windowMs: 60 * 60_000, identity: user.uid });
    const { db } = getAdminServices();
    const id = `${user.uid}_${data.requestId}`;
    const requestRef = db.collection("assistedBookings").doc(id);
    const existing = await requestRef.get();
    if (existing.exists) {
      if (existing.data()?.customerId !== user.uid) throw Object.assign(new Error("Request conflict."), { status: 409 });
      return Response.json({ ok: true, id, state: existing.data().state, idempotent: true });
    }
    const [businessSnap, settingsSnap] = await Promise.all([
      db.collection("businesses").doc(data.businessId).get(),
      db.collection("platformSettings").doc("global").get()
    ]);
    const business = businessSnap.exists ? businessSnap.data() : null;
    const settings = settingsSnap.data() || {};
    if (!business?.public || !marketplaceTrust(business).discoveryAllowed || !canAssistBook(business, settings)) {
      throw Object.assign(new Error("This location is not accepting Spotly Assist booking requests. You can still use its published contact information."), { status: 409 });
    }
    const record = {
      kind: "assisted_booking", businessId: businessSnap.id, businessName: business.name || business.brandName,
      country: business.country || "ZW", city: business.city || "", area: business.area || "",
      affiliation: "not_partnered", serviceName: booking.serviceName,
      preferredDate: booking.date, preferredTime: booking.time,
      flexibility: booking.flexibility, alternativeWindow: booking.alternativeWindow,
      contactName: data.contactName, contactPhone: data.contactPhone, notes: data.notes,
      businessPhoneSnapshot: business.phone || "", businessWebsiteSnapshot: business.website || "",
      customerId: user.uid, customerEmail: user.email || "",
      state: "pending_review", confirmationSource: null, confirmedDate: null, confirmedTime: null,
      paymentStatus: "not_initiated", customerMessage: "We will contact this business to check your requested appointment. This is not a confirmed booking.",
      assignedTo: null, attempts: 0, createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };
    try { await requestRef.create(record); }
    catch (error) {
      if (Number(error?.code) !== 6 && String(error?.code) !== "already-exists") throw error;
      return Response.json({ ok: true, id, state: "pending_review", idempotent: true });
    }
    await db.collection("assistedBookingEvents").add({
      bookingId: id, customerId: user.uid, action: "requested",
      actorType: "customer", actorId: user.uid, createdAt: FieldValue.serverTimestamp()
    });
    return Response.json({ ok: true, id, state: "pending_review", message: record.customerMessage, confirmed: false, charged: false }, { headers: { "Cache-Control": "private, no-store", "X-RateLimit-Remaining": String(rate.remaining) } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review your appointment details, preferred date/time, and contact number." }, { status: 422 });
    return apiError(error);
  }
}

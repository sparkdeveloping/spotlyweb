import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requirePlatformPermission } from "@/lib/access-control-server";
import { canTransitionAssist } from "@/lib/spotly-assist";
import { notifyUser } from "@/lib/notification-server";

export const runtime = "nodejs";
const command = z.object({
  kind: z.enum(["booking", "shopping"]),
  id: z.string().min(3).max(210),
  action: z.enum(["assign", "contact", "offer_alternative", "request_confirmation", "confirm_booking", "start", "complete", "decline", "cancel"]),
  assigneeId: z.string().max(160).optional(),
  proposedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  proposedTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  confirmationReference: z.string().trim().max(300).optional(),
  message: z.string().trim().max(900).optional()
}).strict();
const collectionFor = (kind) => kind === "booking" ? "assistedBookings" : "independentShoppingRequests";
const publicBooking = (snap) => {
  const data = snap.data();
  return { id: snap.id, kind: "booking", state: data.state, businessId: data.businessId,
    businessName: data.businessName, country: data.country || "ZW", city: data.city,
    customerId: data.customerId, contactName: data.contactName, contactPhone: data.contactPhone,
    serviceName: data.serviceName, preferredDate: data.preferredDate, preferredTime: data.preferredTime,
    flexibility: data.flexibility, notes: data.notes, businessPhone: data.businessPhoneSnapshot,
    proposedDate: data.proposedDate, proposedTime: data.proposedTime, assignedTo: data.assignedTo,
    customerMessage: data.customerMessage, confirmationReference: data.confirmationReference,
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null };
};
const publicShopping = (snap) => {
  const data = snap.data();
  return { id: snap.id, kind: "shopping", state: data.state, businessName: data.storeName,
    country: data.country || "ZW", city: data.city || "", customerId: data.customerId,
    contactName: data.contactName, contactPhone: data.contactPhone,
    deliveryAddress: data.deliveryAddress, notes: data.notes, estimate: data.estimate,
    assignedTo: data.assignedTo, customerMessage: data.customerMessage,
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null };
};
export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    requirePlatformPermission(user, "operations.read", { roles: ["operations_manager", "regional_operations_manager", "support_manager", "verification_officer"] });
    const { db } = getAdminServices();
    const url = new URL(request.url);
    const country = String(url.searchParams.get("country") || "").trim().toUpperCase();
    const [bookingSnap, shoppingSnap] = await Promise.all([
      db.collection("assistedBookings").limit(150).get(),
      db.collection("independentShoppingRequests").limit(150).get()
    ]);
    const requests = [
      ...bookingSnap.docs.map(publicBooking), ...shoppingSnap.docs.map(publicShopping)
    ].filter((item) => !country || item.country === country)
     .sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return Response.json({ ok: true, requests, totals: { all: requests.length,
      open: requests.filter((item) => !["completed", "declined", "cancelled", "expired"].includes(item.state)).length,
      bookings: requests.filter((item) => item.kind === "booking").length,
      shopping: requests.filter((item) => item.kind === "shopping").length
    } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
export async function PATCH(request) {
  try {
    const actor = await authenticateRequest(request);
    requirePlatformPermission(actor, "operations.manage", { roles: ["operations_manager", "regional_operations_manager", "support_manager"] });
    const body = command.parse(await request.json());
    const { db, messaging, auth } = getAdminServices();
    const ref = db.collection(collectionFor(body.kind)).doc(body.id);
    let updated = null;
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw Object.assign(new Error("The request could not be found."), { status: 404 });
      const request = snap.data();
      if (request.kind === "assisted_booking" && body.kind !== "booking") throw Object.assign(new Error("Request type mismatch."), { status: 409 });
      const isShopping = body.kind === "shopping";
      const current = request.state || "pending_review";
      const proposed = {
        contact: "contacting_business", offer_alternative: "awaiting_customer",
        request_confirmation: "awaiting_confirmation", confirm_booking: "confirmed",
        start: "in_progress", complete: "completed", decline: "declined", cancel: "cancelled"
      }[body.action];
      if (isShopping && !["assign", "contact", "decline", "cancel"].includes(body.action)) {
        throw Object.assign(new Error("Payment and purchase dispatch must be enabled before a shopping request can advance to fulfilment."), { status: 409 });
      }
      if (body.action === "confirm_booking" && (!body.confirmationReference || !request.customerAcceptedAt && request.proposedDate)) {
        throw Object.assign(new Error("Record genuine business confirmation and obtain customer acceptance of any alternative time."), { status: 422 });
      }
      if (body.action === "offer_alternative" && (!body.proposedDate || !body.proposedTime)) {
        throw Object.assign(new Error("Choose the alternative date and time agreed with the business."), { status: 422 });
      }
      if (body.action === "assign" && !body.assigneeId) throw Object.assign(new Error("Choose a staff member to assign."), { status: 422 });
      if (proposed && !canTransitionAssist(current, proposed) && !(isShopping && current === "pending_manual_quote" && ["contact", "decline", "cancel"].includes(body.action))) {
        throw Object.assign(new Error("This request cannot move to that state."), { status: 409 });
      }
      const next = proposed || current;
      const patch = { updatedAt: FieldValue.serverTimestamp(), updatedBy: actor.uid };
      if (proposed) patch.state = next;
      if (body.action === "assign") patch.assignedTo = body.assigneeId;
      if (body.action === "contact") { patch.attempts = FieldValue.increment(1); patch.lastContactAt = FieldValue.serverTimestamp(); }
      if (body.action === "offer_alternative") {
        patch.proposedDate = body.proposedDate; patch.proposedTime = body.proposedTime; patch.customerAcceptedAt = null;
        patch.customerMessage = body.message || `The business offered ${body.proposedDate} at ${body.proposedTime}. Please accept or decline this alternative.`;
      }
      if (body.action === "confirm_booking") {
        patch.confirmedDate = request.proposedDate || request.preferredDate;
        patch.confirmedTime = request.proposedTime || request.preferredTime;
        patch.confirmationReference = body.confirmationReference;
        patch.customerMessage = body.message || "Your booking was confirmed directly with the business.";
        patch.confirmedAt = FieldValue.serverTimestamp();
      }
      if (body.action === "decline") patch.customerMessage = body.message || "The business could not accept this request.";
      if (body.action === "cancel") patch.customerMessage = body.message || "This request was cancelled.";
      if (body.message && !["offer_alternative", "confirm_booking", "decline", "cancel"].includes(body.action)) patch.customerMessage = body.message;
      tx.set(ref, patch, { merge: true });
      tx.create(db.collection("assistEvents").doc(), { entityId: ref.id, kind: body.kind,
        actorId: actor.uid, actorType: "admin", action: body.action,
        previousState: current, nextState: next, message: body.message || "",
        createdAt: FieldValue.serverTimestamp()
      });
      updated = { customerId: request.customerId, state: next, kind: body.kind };
    });
    if (updated.customerId && ["offer_alternative", "confirm_booking", "decline", "cancel"].includes(body.action)) {
      await notifyUser({ db, messaging, auth, userId: updated.customerId,
        title: body.action === "offer_alternative" ? "Alternative booking time" : body.action === "confirm_booking" ? "Booking confirmed" : "Spotly Assist update",
        body: body.message || (body.action === "offer_alternative" ? "Review the proposed appointment time in Spotly." : body.action === "confirm_booking" ? "Your booking is confirmed." : "Your request status changed."),
        href: "/assist/activity", category: "booking", workspace: "customer", module: "assist",
        eventType: `assist.${body.action}`, importance: "normal"
      }).catch(() => {});
    }
    return Response.json({ ok: true, state: updated.state });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the case action and required confirmation details." }, { status: 422 });
    return apiError(error);
  }
}

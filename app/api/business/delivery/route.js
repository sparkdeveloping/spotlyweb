import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requireBusinessPermission } from "@/lib/access-control-server";
import { dispatchDelivery, docsData, notifyUsers } from "@/lib/driver-delivery-server";
import { safeText } from "@/lib/server-helpers";

export const runtime = "nodejs";
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("configure"), businessId: z.string().min(1), branchId: z.string().min(1), delivery: z.object({
    enabled: z.boolean(), latitude: z.number().min(-90).max(90).optional(), longitude: z.number().min(-180).max(180).optional(), radiusKm: z.number().min(0.5).max(100).optional(),
    preparationMinutes: z.number().int().min(0).max(1440).optional(), pickupInstructions: z.string().max(1200).optional(), pickupPoint: z.string().max(500).optional(), contactPhone: z.string().max(80).optional(),
    hours: z.record(z.string(), z.any()).optional(), vehicleTypes: z.array(z.enum(["motorcycle", "car", "van", "bicycle"])).max(4).optional(), paused: z.boolean().optional()
  }) }),
  z.object({ action: z.literal("ready"), businessId: z.string().min(1), deliveryJobId: z.string().min(1), bagCount: z.number().int().min(1).max(200).default(1), chilledBagCount: z.number().int().min(0).max(200).default(0) }),
  z.object({ action: z.literal("delay"), businessId: z.string().min(1), deliveryJobId: z.string().min(1), minutes: z.number().int().min(5).max(240), reason: z.string().max(500).optional() })
]);

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    const { db } = getAdminServices();
    const url = new URL(request.url); const businessId = url.searchParams.get("businessId");
    if (!businessId) throw Object.assign(new Error("Business is required."), { status: 400 });
    await requireBusinessPermission(db, user, businessId, "orders.read", { allowRoles: ["organization_owner", "business_owner", "business_manager", "branch_manager", "operations"] });
    const jobs = await db.collection("deliveryJobs").where("businessId", "==", businessId).limit(150).get();
    return Response.json({ ok: true, deliveries: docsData(jobs) });
  } catch (error) { return apiError(error); }
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request); const body = schema.parse(await request.json()); const { db, messaging } = getAdminServices();
    if (body.action === "configure") {
      await requireBusinessPermission(db, user, body.businessId, "branches.update", { branchId: body.branchId, allowRoles: ["organization_owner", "business_owner", "business_manager", "branch_manager"] });
      const branchRef = db.collection("branches").doc(body.branchId); const snap = await branchRef.get();
      if (!snap.exists || snap.data().businessId !== body.businessId) throw Object.assign(new Error("The location was not found."), { status: 404 });
      const delivery = body.delivery;
      await branchRef.set({
        delivery: {
          enabled: delivery.enabled, paused: Boolean(delivery.paused), radiusKm: Number(delivery.radiusKm || 8), preparationMinutes: Number(delivery.preparationMinutes || 20),
          pickupInstructions: safeText(delivery.pickupInstructions, 1200), pickupPoint: safeText(delivery.pickupPoint, 500), contactPhone: safeText(delivery.contactPhone, 80), hours: delivery.hours || {}, vehicleTypes: delivery.vehicleTypes?.length ? delivery.vehicleTypes : ["motorcycle", "car"],
          location: Number.isFinite(delivery.latitude) && Number.isFinite(delivery.longitude) ? { lat: delivery.latitude, lng: delivery.longitude } : snap.data().delivery?.location || null
        },
        fulfilment: delivery.enabled ? [...new Set([...(snap.data().fulfilment || ["pickup"]), "delivery"])] : (snap.data().fulfilment || []).filter((item) => item !== "delivery"),
        updatedAt: FieldValue.serverTimestamp(), updatedBy: user.uid
      }, { merge: true });
      return Response.json({ ok: true });
    }
    const jobRef = db.collection("deliveryJobs").doc(body.deliveryJobId); const jobSnap = await jobRef.get();
    if (!jobSnap.exists || jobSnap.data().businessId !== body.businessId) throw Object.assign(new Error("The delivery was not found for this business."), { status: 404 });
    await requireBusinessPermission(db, user, body.businessId, "orders.update", { branchId: jobSnap.data().branchId, allowRoles: ["organization_owner", "business_owner", "business_manager", "branch_manager", "operations"] });
    if (body.action === "ready") {
      if (jobSnap.data().orderId) {
        const orderSnap = await db.collection("orders").doc(jobSnap.data().orderId).get();
        const paymentStatus = orderSnap.data()?.paymentStatus || "";
        if (orderSnap.exists && paymentStatus !== "paid") throw Object.assign(new Error("This delivery cannot be dispatched until payment is confirmed."), { status: 409 });
      }
      await jobRef.set({ bagCount: body.bagCount, chilledBagCount: body.chilledBagCount, businessReadyAt: FieldValue.serverTimestamp(), state: "awaiting_dispatch", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      if (jobSnap.data().orderId) await db.collection("orders").doc(jobSnap.data().orderId).set({ status: "ready_for_pickup", deliveryStatus: "awaiting_dispatch", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      const dispatch = await dispatchDelivery({ db, messaging, deliveryJobId: body.deliveryJobId, actorId: user.uid });
      return Response.json({ ok: true, dispatch });
    }
    const delayedUntil = new Date(Date.now() + body.minutes * 60000);
    await jobRef.set({ businessDelayMinutes: body.minutes, businessDelayReason: safeText(body.reason, 500), dispatchAfterAt: delayedUntil, exceptionCode: "business_delay", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await notifyUsers(db, messaging, [jobSnap.data().assignedDriverId, jobSnap.data().customerId], { title: jobSnap.data().number || "Delivery update", body: `The business needs about ${body.minutes} more minutes.`, href: jobSnap.data().assignedDriverId ? "/driver/active" : "/marketplace?view=orders", category: "delivery" });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the delivery details." }, { status: 400 });
    return apiError(error);
  }
}

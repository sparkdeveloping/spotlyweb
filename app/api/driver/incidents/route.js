import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { safeText } from "@/lib/server-helpers";

export const runtime = "nodejs";
const schema = z.object({
  deliveryJobId: z.string().max(180).optional(),
  rideId: z.string().max(180).optional(),
  parcelJobId: z.string().max(180).optional(),
  category: z.enum(["safety", "breakdown", "customer_unreachable", "business_problem", "customer_problem", "order_damaged", "address_problem", "other"]),
  description: z.string().min(3).max(2000),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium")
}).refine((value) => [value.deliveryJobId, value.rideId, value.parcelJobId].filter(Boolean).length <= 1, { message: "Attach only one active job." });

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const body = schema.parse(await request.json());
    const { db } = getAdminServices();
    let job = null; let ride = null; let parcel = null;
    if (body.deliveryJobId) {
      const snap = await db.collection("deliveryJobs").doc(body.deliveryJobId).get();
      if (!snap.exists || snap.data().assignedDriverId !== user.uid) throw Object.assign(new Error("This delivery is not assigned to your Driver account."), { status: 403 });
      job = snap.data();
    }
    if (body.rideId) {
      const snap = await db.collection("rideTrips").doc(body.rideId).get();
      if (!snap.exists || snap.data().assignedDriverId !== user.uid) throw Object.assign(new Error("This ride is not assigned to your Driver account."), { status: 403 });
      ride = snap.data();
    }
    if (body.parcelJobId) {
      const snap = await db.collection("parcelJobs").doc(body.parcelJobId).get();
      if (!snap.exists || snap.data().assignedDriverId !== user.uid) throw Object.assign(new Error("This Send request is not assigned to your Driver account."), { status: 403 });
      parcel = snap.data();
    }
    const ref = db.collection("driverIncidents").doc();
    await ref.set({
      driverId: user.uid,
      deliveryJobId: body.deliveryJobId || null,
      rideId: body.rideId || null,
      parcelJobId: body.parcelJobId || null,
      orderId: job?.orderId || ride?.orderId || parcel?.orderId || null,
      businessId: job?.businessId || null,
      customerId: job?.customerId || ride?.customerId || parcel?.customerId || null,
      category: body.category,
      description: safeText(body.description, 2000),
      severity: body.severity,
      status: "open",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    if (["high", "critical"].includes(body.severity)) await db.collection("drivers").doc(user.uid).set({ safetyHold: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await db.collection("adminQueueItems").doc(`driver_incident_${ref.id}`).set({
      queue: "driver-incidents", type: "driver_incident", entityId: ref.id, driverId: user.uid,
      deliveryJobId: body.deliveryJobId || null, rideId: body.rideId || null, parcelJobId: body.parcelJobId || null,
      priority: body.severity === "critical" ? "urgent" : body.severity,
      status: "open", title: `${body.category.replaceAll("_", " ")} incident`,
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
    });
    return Response.json({ ok: true, incidentId: ref.id });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the incident details." }, { status: 400 });
    return apiError(error);
  }
}

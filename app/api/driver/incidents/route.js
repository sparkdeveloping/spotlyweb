import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { safeText } from "@/lib/server-helpers";

export const runtime = "nodejs";
const schema = z.object({ deliveryJobId: z.string().max(180).optional(), category: z.enum(["safety", "breakdown", "customer_unreachable", "business_problem", "customer_problem", "order_damaged", "address_problem", "other"]), description: z.string().min(3).max(2000), severity: z.enum(["low", "medium", "high", "critical"]).default("medium") });

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const body = schema.parse(await request.json());
    const { db } = getAdminServices();
    let job = null;
    if (body.deliveryJobId) {
      const snap = await db.collection("deliveryJobs").doc(body.deliveryJobId).get();
      if (!snap.exists || snap.data().assignedDriverId !== user.uid) throw Object.assign(new Error("This delivery is not assigned to your Driver account."), { status: 403 });
      job = snap.data();
    }
    const ref = db.collection("driverIncidents").doc();
    await ref.set({
      driverId: user.uid, deliveryJobId: body.deliveryJobId || null, orderId: job?.orderId || null, businessId: job?.businessId || null, customerId: job?.customerId || null,
      category: body.category, description: safeText(body.description, 2000), severity: body.severity, status: "open", createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
    });
    if (["high", "critical"].includes(body.severity)) await db.collection("drivers").doc(user.uid).set({ safetyHold: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await db.collection("adminQueueItems").doc(`driver_incident_${ref.id}`).set({ queue: "driver-incidents", type: "driver_incident", entityId: ref.id, driverId: user.uid, deliveryJobId: body.deliveryJobId || null, priority: body.severity === "critical" ? "urgent" : body.severity, status: "open", title: `${body.category.replaceAll("_", " ")} incident`, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    return Response.json({ ok: true, incidentId: ref.id });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the incident details." }, { status: 400 });
    return apiError(error);
  }
}

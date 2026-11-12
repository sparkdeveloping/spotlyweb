import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { safeText } from "@/lib/server-helpers";

export const runtime = "nodejs";
const schema = z.object({
  deliveryJobId: z.string().max(180).optional(),
  rideId: z.string().max(180).optional(),
  parcelJobId: z.string().max(180).optional(),
  category: z.enum(["safety", "crash", "unsafe_person", "breakdown", "customer_unreachable",
    "business_problem", "merchant_closed", "customer_problem", "order_damaged",
    "address_problem", "ride_no_show", "parcel_mismatch", "checkout_problem",
    "return_required", "cancellation_request", "other"]),
  description: z.string().min(3).max(2000),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  requestKey: z.string().uuid().optional()
}).refine((value) => [value.deliveryJobId, value.rideId, value.parcelJobId].filter(Boolean).length <= 1, {
  message: "Attach only one work assignment."
});

const completed = Object.freeze({
  delivery: new Set(["delivered", "returned", "cancelled", "failed"]),
  ride: new Set(["completed", "cancelled", "failed"]),
  send: new Set(["delivered", "returned", "cancelled", "failed"])
});

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const body = schema.parse(await request.json());
    const { db } = getAdminServices();
    const kind = body.rideId ? "ride" : body.parcelJobId ? "send" : body.deliveryJobId ? "delivery" : "";
    const workId = body.rideId || body.parcelJobId || body.deliveryJobId || "";
    const workCollection = kind === "ride" ? "rideTrips" : kind === "send" ? "parcelJobs" : "deliveryJobs";
    const workRef = workId ? db.collection(workCollection).doc(workId) : null;
    const description = safeText(body.description, 2000);
    const fingerprint = createHash("sha256").update(JSON.stringify({
      driverId: user.uid, kind, workId, category: body.category,
      description, severity: body.severity
    })).digest("hex");
    const incidentId = body.requestKey ? createHash("sha256")
      .update(`driver-incident:${user.uid}:${body.requestKey}`).digest("hex").slice(0, 48) : null;
    const incidentRef = incidentId ? db.collection("driverIncidents").doc(incidentId) :
      db.collection("driverIncidents").doc();
    const queueRef = db.collection("adminQueueItems").doc(`driver_incident_${incidentRef.id}`);
    let reused = false;
    let status = "open";
    await db.runTransaction(async (transaction) => {
      const [previous, assignment] = await Promise.all([
        transaction.get(incidentRef),
        workRef ? transaction.get(workRef) : Promise.resolve(null)
      ]);
      if (previous.exists) {
        const original = previous.data() || {};
        if (original.driverId !== user.uid || original.requestFingerprint !== fingerprint)
          throw Object.assign(new Error("This incident request identifier was used for different details."), { status: 409 });
        reused = true;
        status = String(original.status || "open");
        return;
      }
      let work = null;
      if (workRef) {
        if (!assignment?.exists || assignment.data()?.assignedDriverId !== user.uid)
          throw Object.assign(new Error("This work is not assigned to your Driver account."), { status: 403 });
        work = assignment.data() || {};
      }
      const now = FieldValue.serverTimestamp();
      transaction.create(incidentRef, {
        driverId: user.uid, requestFingerprint: fingerprint,
        deliveryJobId: body.deliveryJobId || null,
        rideId: body.rideId || null, parcelJobId: body.parcelJobId || null,
        orderId: work?.orderId || null, businessId: work?.businessId || null,
        customerId: work?.customerId || null, category: body.category,
        description, severity: body.severity, status: "open",
        createdAt: now, updatedAt: now
      });
      transaction.create(queueRef, {
        queue: "driver-incidents", type: "driver_incident", entityId: incidentRef.id,
        driverId: user.uid, deliveryJobId: body.deliveryJobId || null,
        rideId: body.rideId || null, parcelJobId: body.parcelJobId || null,
        priority: body.severity === "critical" ? "urgent" : body.severity,
        status: "open", title: `${body.category.replaceAll("_", " ")} incident`,
        createdAt: now, updatedAt: now
      });
      if (["high", "critical"].includes(body.severity)) {
        transaction.set(db.collection("drivers").doc(user.uid),
          { safetyHold: true, updatedAt: now }, { merge: true });
        if (workRef && !completed[kind].has(work.state))
          transaction.set(workRef, {
            safetyReviewHold: true, safetyIncidentId: incidentRef.id,
            exceptionCode: "safety_review", updatedAt: now
          }, { merge: true });
      }
      transaction.create(db.collection("auditLogs").doc(), {
        actorId: user.uid, action: "driver.incident_reported",
        entityType: "driverIncident", entityId: incidentRef.id,
        metadata: { kind, workId: workId || null, category: body.category, severity: body.severity },
        source: "driver_incident", createdAt: now
      });
    });
    // Confirmation is returned only after the incident, queue and any safety
    // hold have committed atomically. Incident reporting does not mutate job state.
    return Response.json({ ok: true, incidentId: incidentRef.id, status, reused });
  } catch (error) {
    if (error instanceof z.ZodError)
      return Response.json({ ok: false, error: "Review the incident details." }, { status: 400 });
    return apiError(error);
  }
}

import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { safeText } from "@/lib/server-helpers";

export const runtime = "nodejs";

const WORK = {
  delivery: { collection: "deliveryJobs", codes: ["merchant_not_ready", "merchant_closed", "package_problem", "customer_unreachable", "address_problem", "unsafe_location", "checkout_problem", "return_required"] },
  ride: { collection: "rideTrips", codes: ["rider_not_here", "wrong_rider", "unsafe_rider", "route_issue", "vehicle_issue", "crash", "end_trip_early", "cash_issue"] },
  send: { collection: "parcelJobs", codes: ["sender_unavailable", "parcel_mismatch", "prohibited_item", "recipient_unavailable", "recipient_refused", "parcel_damaged", "return_required", "unsafe_location"] }
};
const WAIT_SECONDS = Object.freeze({ rider_not_here: 300, customer_unreachable: 300, recipient_unavailable: 300, sender_unavailable: 300 });
const schema = z.object({ workType: z.enum(Object.keys(WORK)), workId: z.string().min(3).max(180), code: z.string().min(3).max(80), note: z.string().max(800).optional(), severity: z.enum(["low", "medium", "high", "critical"]).default("medium") });

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const body = schema.parse(await request.json());
    const config = WORK[body.workType];
    if (!config.codes.includes(body.code)) throw Object.assign(new Error("That exception is not available for this kind of work."), { status: 400 });
    const { db } = getAdminServices();
    const workRef = db.collection(config.collection).doc(body.workId);
    const workSnap = await workRef.get();
    if (!workSnap.exists || workSnap.data().assignedDriverId !== user.uid) throw Object.assign(new Error("This work is not assigned to your Driver account."), { status: 403 });
    const work = workSnap.data();
    const incidentRef = db.collection("driverIncidents").doc();
    const now = FieldValue.serverTimestamp();
    const waitSeconds = WAIT_SECONDS[body.code] || 0;
    const resolutionEligibleAt = waitSeconds ? new Date(Date.now() + waitSeconds * 1000) : null;
    const batch = db.batch();
    batch.set(workRef, { exceptionCode: body.code, exceptionNote: safeText(body.note || "", 800), exceptionSeverity: body.severity, exceptionReportedAt: now, exceptionWaitStartedAt: waitSeconds ? now : null, exceptionResolutionEligibleAt: resolutionEligibleAt, updatedAt: now }, { merge: true });
    batch.set(incidentRef, { driverId: user.uid, deliveryJobId: body.workType === "delivery" ? body.workId : null, rideId: body.workType === "ride" ? body.workId : null, parcelJobId: body.workType === "send" ? body.workId : null, orderId: work.orderId || null, businessId: work.businessId || null, customerId: work.customerId || null, category: body.code, description: safeText(body.note || body.code.replaceAll("_", " "), 800), severity: body.severity, status: "open", waitSeconds, resolutionEligibleAt, createdAt: now, updatedAt: now });
    batch.set(db.collection("adminQueueItems").doc(`driver_incident_${incidentRef.id}`), { queue: "driver-incidents", type: "driver_work_exception", entityId: incidentRef.id, driverId: user.uid, workType: body.workType, workId: body.workId, priority: body.severity === "critical" ? "urgent" : body.severity, status: "open", title: `${body.code.replaceAll("_", " ")} · ${work.number || body.workId}`, createdAt: now, updatedAt: now });
    batch.set(db.collection("auditLogs").doc(), { actorId: user.uid, action: "driver.work_exception.reported", entityType: config.collection, entityId: body.workId, metadata: { workType: body.workType, code: body.code, severity: body.severity }, source: "driver_operations", createdAt: now });
    if (["high", "critical"].includes(body.severity) && ["crash", "unsafe_rider", "unsafe_location"].includes(body.code)) batch.set(db.collection("drivers").doc(user.uid), { safetyHold: true, safetyHoldReason: body.code.replaceAll("_", " "), updatedAt: now }, { merge: true });
    await batch.commit();
    return Response.json({ ok: true, exceptionCode: body.code, incidentId: incidentRef.id, waitSeconds, resolutionEligibleAt: resolutionEligibleAt?.toISOString() || null });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the Driver exception details." }, { status: 400 });
    return apiError(error);
  }
}

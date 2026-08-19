import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { dispatchDelivery, docsData, docData, notifyUsers, operationalEligibility } from "@/lib/driver-delivery-server";
import { safeText } from "@/lib/server-helpers";

export const runtime = "nodejs";
const ROLES = ["super_admin", "admin", "platform_admin", "operations_manager", "regional_operations_manager", "driver_operations_coordinator", "dispatcher", "support_manager"];
const schema = z.object({ deliveryJobId: z.string().min(3).max(180), action: z.enum(["dispatch", "assign", "reassign", "cancel", "clear_exception"]), driverId: z.string().max(180).optional(), reason: z.string().max(1000).optional() });

export async function GET(request) {
  try {
    await authenticateRequest(request, { roles: ROLES });
    const { db } = getAdminServices();
    const url = new URL(request.url); const deliveryJobId = url.searchParams.get("deliveryJobId");
    if (deliveryJobId) {
      const job = await db.collection("deliveryJobs").doc(deliveryJobId).get();
      if (!job.exists) throw Object.assign(new Error("The delivery was not found."), { status: 404 });
      const [events, offers, incidents] = await Promise.all([
        db.collection("deliveryEvents").where("deliveryJobId", "==", deliveryJobId).limit(250).get(),
        db.collection("deliveryOffers").where("deliveryJobId", "==", deliveryJobId).limit(100).get(),
        db.collection("driverIncidents").where("deliveryJobId", "==", deliveryJobId).limit(100).get()
      ]);
      return Response.json({ ok: true, job: docData(job), events: docsData(events), offers: docsData(offers), incidents: docsData(incidents) });
    }
    const [jobs, presence, drivers, incidents] = await Promise.all([
      db.collection("deliveryJobs").limit(300).get(), db.collection("driverPresence").limit(300).get(), db.collection("drivers").limit(300).get(), db.collection("driverIncidents").where("status", "==", "open").limit(100).get()
    ]);
    return Response.json({ ok: true, deliveries: docsData(jobs), presence: docsData(presence), drivers: docsData(drivers), incidents: docsData(incidents) });
  } catch (error) { return apiError(error); }
}

export async function POST(request) {
  try {
    const actor = await authenticateRequest(request, { roles: ROLES });
    const body = schema.parse(await request.json()); const reason = safeText(body.reason || "", 1000);
    const { db, messaging } = getAdminServices();
    if (body.action === "dispatch") return Response.json({ ok: true, ...(await dispatchDelivery({ db, messaging, deliveryJobId: body.deliveryJobId, actorId: actor.uid })) });
    if (["assign", "reassign", "cancel"].includes(body.action) && reason.length < 3) throw Object.assign(new Error("Add a reason for this operational override."), { status: 400 });
    const jobRef = db.collection("deliveryJobs").doc(body.deliveryJobId); const snap = await jobRef.get();
    if (!snap.exists) throw Object.assign(new Error("The delivery was not found."), { status: 404 });
    const job = snap.data();
    if (["assign", "reassign"].includes(body.action)) {
      if (!body.driverId) throw Object.assign(new Error("Choose a Driver."), { status: 400 });
      if (body.action === "assign" && job.assignedDriverId) throw Object.assign(new Error("This delivery already has a Driver. Use reassignment instead."), { status: 409 });
      if (body.action === "reassign" && !job.assignedDriverId) throw Object.assign(new Error("This delivery is not currently assigned. Use assignment instead."), { status: 409 });
      const [driverSnap, presenceSnap, vehicleQuery, docsQuery] = await Promise.all([
        db.collection("drivers").doc(body.driverId).get(), db.collection("driverPresence").doc(body.driverId).get(),
        db.collection("driverVehicles").where("driverId", "==", body.driverId).limit(10).get(), db.collection("driverDocuments").where("driverId", "==", body.driverId).limit(50).get()
      ]);
      const presence = presenceSnap.exists ? presenceSnap.data() : null;
      const vehicle = vehicleQuery.docs.map((item) => ({ id: item.id, ...item.data() })).find((item) => item.status === "approved") || null;
      const eligibility = operationalEligibility({ driver: driverSnap.data(), vehicle, documents: docsQuery.docs.map((item) => item.data()), presence: presence?.currentJobId === body.deliveryJobId ? { ...presence, currentJobId: null } : presence });
      const locationFresh = presence?.locationUpdatedAt?.toMillis?.() ? Date.now() - presence.locationUpdatedAt.toMillis() <= 120000 : false;
      if (!driverSnap.exists || !presence?.online || !presence.currentLocation || !locationFresh || !eligibility.eligible) throw Object.assign(new Error("That Driver is not online, location-current and operationally eligible for assignment."), { status: 409 });
      if (job.requiredVehicleTypes?.length && !job.requiredVehicleTypes.includes(vehicle?.type)) throw Object.assign(new Error("That Driver's approved vehicle is not suitable for this delivery."), { status: 409 });
      const batch = db.batch(); const now = FieldValue.serverTimestamp();
      if (job.assignedDriverId && job.assignedDriverId !== body.driverId) batch.set(db.collection("driverPresence").doc(job.assignedDriverId), { currentJobId: null, availabilityState: "online_current", updatedAt: now }, { merge: true });
      batch.set(jobRef, { assignedDriverId: body.driverId, state: "driver_assigned", assignedAt: now, manualAssignmentReason: reason, exceptionCode: null, updatedAt: now }, { merge: true });
      batch.set(db.collection("driverPresence").doc(body.driverId), { currentJobId: body.deliveryJobId, availabilityState: "on_delivery", updatedAt: now }, { merge: true });
      batch.set(db.collection("deliveryEvents").doc(), { deliveryJobId: body.deliveryJobId, orderId: job.orderId || null, type: body.action === "reassign" ? "dispatch.reassigned" : "dispatch.assigned", actorType: "admin", actorId: actor.uid, previousState: job.state, state: "driver_assigned", note: reason, metadata: { driverId: body.driverId, previousDriverId: job.assignedDriverId || null }, createdAt: now });
      batch.set(db.collection("auditLogs").doc(), { actorId: actor.uid, action: `delivery.${body.action}`, entityType: "deliveryJob", entityId: body.deliveryJobId, reason, metadata: { driverId: body.driverId, previousDriverId: job.assignedDriverId || null }, source: "admin_dispatch", createdAt: now });
      await batch.commit();
      const siblingOffers = await db.collection("deliveryOffers").where("deliveryJobId", "==", body.deliveryJobId).limit(100).get(); const offerBatch = db.batch(); let changed = false;
      siblingOffers.docs.forEach((item) => { if (["offered", "viewed"].includes(item.data().state)) { offerBatch.set(item.ref, { state: "withdrawn", withdrawnAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true }); changed = true; } });
      if (changed) await offerBatch.commit();
      await notifyUsers(db, messaging, [body.driverId], { title: "Delivery assigned", body: `${job.number || body.deliveryJobId} was assigned to you.`, href: "/active", category: "driver_assignment", workspace: "driver" });
      if (job.customerId) await notifyUsers(db, messaging, [job.customerId], { title: "Driver assigned", body: `A Driver has been assigned to ${job.number || body.deliveryJobId}.`, href: "/marketplace?view=orders", category: "delivery", workspace: "customer" });
      return Response.json({ ok: true });
    } else if (body.action === "cancel") {
      if (["delivered", "cancelled", "returned"].includes(job.state)) throw Object.assign(new Error("This delivery can no longer be cancelled."), { status: 409 });
      const batch = db.batch(); const now = FieldValue.serverTimestamp();
      batch.set(jobRef, { state: "cancelled", exceptionCode: "admin_cancelled", cancellationReason: reason, cancelledAt: now, updatedAt: now }, { merge: true });
      if (job.orderId) batch.set(db.collection("orders").doc(job.orderId), { deliveryStatus: "cancelled", updatedAt: now }, { merge: true });
      if (job.assignedDriverId) batch.set(db.collection("driverPresence").doc(job.assignedDriverId), { currentJobId: null, availabilityState: "online_current", updatedAt: now }, { merge: true });
      batch.set(db.collection("deliveryEvents").doc(), { deliveryJobId: body.deliveryJobId, orderId: job.orderId || null, type: "delivery.cancelled", actorType: "admin", actorId: actor.uid, previousState: job.state, state: "cancelled", note: reason, metadata: {}, createdAt: now });
      batch.set(db.collection("auditLogs").doc(), { actorId: actor.uid, action: "delivery.cancel", entityType: "deliveryJob", entityId: body.deliveryJobId, reason, metadata: { driverId: job.assignedDriverId || null }, source: "admin_dispatch", createdAt: now });
      await batch.commit();
      if (job.assignedDriverId) await notifyUsers(db, messaging, [job.assignedDriverId], { title: "Delivery cancelled", body: `${job.number || body.deliveryJobId} was cancelled by Spotly Operations.`, href: "/", category: "delivery", workspace: "driver" });
      if (job.customerId) await notifyUsers(db, messaging, [job.customerId], { title: "Delivery cancelled", body: `${job.number || body.deliveryJobId} was cancelled by Spotly Operations.`, href: "/marketplace?view=orders", category: "delivery", workspace: "customer" });
      return Response.json({ ok: true });
    } else if (body.action === "clear_exception") {
      await jobRef.set({ exceptionCode: null, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    await db.collection("auditLogs").add({ actorId: actor.uid, action: `delivery.${body.action}`, entityType: "deliveryJob", entityId: body.deliveryJobId, reason, metadata: { driverId: body.driverId || null }, source: "admin_dispatch", createdAt: FieldValue.serverTimestamp() });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the delivery operation." }, { status: 400 });
    return apiError(error);
  }
}

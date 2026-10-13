import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { notifyUsers, operationalEligibility } from "@/lib/driver-delivery-server";
import { dispatchRide, plainRide, rideSettings } from "@/lib/ride-server";
import { safeText } from "@/lib/server-helpers";

export const runtime = "nodejs";
const ROLES = ["super_admin", "admin", "platform_admin", "operations_manager", "regional_operations_manager", "driver_operations_coordinator", "dispatcher", "support_manager"];
const RIDE_CONFIG_ROLES = ["super_admin", "admin", "platform_admin", "operations_manager", "regional_operations_manager"];
const schema = z.object({ rideId: z.string().min(3).max(180), action: z.enum(["dispatch", "assign", "reassign", "cancel", "clear_exception"]), driverId: z.string().max(180).optional(), reason: z.string().max(1000).optional() });

const mobilitySchema = z.object({
  ridesEnabled: z.boolean().optional(),
  safetyToolkitEnabled: z.boolean().optional(),
  cashEnabled: z.boolean().optional(),
  enabledCities: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
  enabledAreas: z.record(z.string().trim().min(1).max(120), z.array(z.string().trim().min(1).max(120)).max(100)).optional(),
  pricing: z.object({
    baseFare: z.number().min(0).max(1000).optional(),
    perKm: z.number().min(0).max(1000).optional(),
    perMinute: z.number().min(0).max(1000).optional(),
    bookingFee: z.number().min(0).max(1000).optional(),
    minimumFare: z.number().min(0).max(1000).optional(),
    driverSharePercent: z.number().min(1).max(100).optional(),
    maxPickupKm: z.number().min(1).max(100).optional(),
    offerSeconds: z.number().int().min(20).max(600).optional()
  }).partial().optional()
});

export async function GET(request) {
  try {
    await authenticateRequest(request, { roles: ROLES }); const { db } = getAdminServices();
    const url = new URL(request.url); const rideId = url.searchParams.get("rideId");
    if (rideId) {
      const ride = await db.collection("rideTrips").doc(rideId).get(); if (!ride.exists) throw Object.assign(new Error("The ride was not found."), { status: 404 });
      const [events, offers] = await Promise.all([db.collection("rideEvents").where("rideId", "==", rideId).limit(250).get(), db.collection("rideOffers").where("rideId", "==", rideId).limit(100).get()]);
      return Response.json({ ok: true, ride: { id: ride.id, ...plainRide(ride.data()) }, events: events.docs.map((d) => ({ id: d.id, ...plainRide(d.data()) })), offers: offers.docs.map((d) => ({ id: d.id, ...plainRide(d.data()) })) });
    }
    const [rides, presence, drivers, settingsSnap] = await Promise.all([db.collection("rideTrips").limit(300).get(), db.collection("driverPresence").limit(300).get(), db.collection("drivers").limit(300).get(), db.collection("platformSettings").doc("global").get()]);
    return Response.json({ ok: true, rides: rides.docs.map((d) => ({ id: d.id, ...plainRide(d.data()) })), presence: presence.docs.map((d) => ({ id: d.id, ...plainRide(d.data()) })), drivers: drivers.docs.map((d) => ({ id: d.id, ...plainRide(d.data()) })), mobility: rideSettings(settingsSnap.exists ? settingsSnap.data() : {}) });
  } catch (error) { return apiError(error); }
}


export async function PATCH(request) {
  try {
    const actor = await authenticateRequest(request, { roles: RIDE_CONFIG_ROLES });
    const body = mobilitySchema.parse(await request.json());
    const { db } = getAdminServices();
    const settingsRef = db.collection("platformSettings").doc("global");
    const currentSnap = await settingsRef.get();
    const current = currentSnap.exists ? currentSnap.data() : {};
    const mobility = current.mobility || {};
    const next = {
      ...mobility,
      ...(body.ridesEnabled !== undefined ? { ridesEnabled: body.ridesEnabled } : {}),
      ...(body.safetyToolkitEnabled !== undefined ? { safetyToolkitEnabled: body.safetyToolkitEnabled } : {}),
      ...(body.cashEnabled !== undefined ? { cashEnabled: body.cashEnabled } : {}),
      ...(body.enabledCities !== undefined ? { enabledCities: [...new Set(body.enabledCities.map((value) => value.trim()).filter(Boolean))] } : {}),
      ...(body.enabledAreas !== undefined ? { enabledAreas: Object.fromEntries(Object.entries(body.enabledAreas).map(([city, areas]) => [city.trim(), [...new Set(areas.map((value) => value.trim()).filter(Boolean))]]).filter(([city, areas]) => city && areas.length)) } : {}),
      ...(body.pricing ? { pricing: { ...(mobility.pricing || {}), ...body.pricing } } : {})
    };
    await settingsRef.set({ mobility: next, updatedAt: FieldValue.serverTimestamp(), updatedBy: actor.uid }, { merge: true });
    await db.collection("auditLogs").add({ actorId: actor.uid, action: "mobility.ride_settings.updated", entityType: "platformSettings", entityId: "global", metadata: { ridesEnabled: next.ridesEnabled === true, cashEnabled: next.cashEnabled !== false, enabledCities: next.enabledCities || [], enabledAreas: next.enabledAreas || {}, pricing: next.pricing || {} }, source: "admin_rides", createdAt: FieldValue.serverTimestamp() });
    return Response.json({ ok: true, mobility: rideSettings({ ...current, mobility: next }) });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the ride settings." }, { status: 400 });
    return apiError(error);
  }
}

export async function POST(request) {
  try {
    const actor = await authenticateRequest(request, { roles: ROLES }); const body = schema.parse(await request.json()); const reason = safeText(body.reason || "", 1000);
    const { db, messaging } = getAdminServices();
    if (body.action === "dispatch") return Response.json({ ok: true, ...(await dispatchRide({ db, messaging, rideId: body.rideId, actorId: actor.uid })) });
    if (["assign", "reassign", "cancel"].includes(body.action) && reason.length < 3) throw Object.assign(new Error("Add a reason for this operational override."), { status: 400 });
    const ref = db.collection("rideTrips").doc(body.rideId); const snap = await ref.get(); if (!snap.exists) throw Object.assign(new Error("The ride was not found."), { status: 404 }); const ride = snap.data();
    if (["assign", "reassign"].includes(body.action)) {
      if (!["requested", "searching_driver", "driver_assigned", "driver_to_pickup"].includes(ride.state)) throw Object.assign(new Error("This ride can no longer be manually assigned. Use the incident and support workflow instead."), { status: 409 });
      if (!body.driverId) throw Object.assign(new Error("Choose a Driver."), { status: 400 });
      const [driverSnap, presenceSnap, vehicleQuery, docsQuery] = await Promise.all([db.collection("drivers").doc(body.driverId).get(), db.collection("driverPresence").doc(body.driverId).get(), db.collection("driverVehicles").where("driverId", "==", body.driverId).limit(10).get(), db.collection("driverDocuments").where("driverId", "==", body.driverId).limit(50).get()]);
      const presence = presenceSnap.exists ? presenceSnap.data() : null; const vehicle = vehicleQuery.docs.map((d) => ({ id: d.id, ...d.data() })).find((item) => item.status === "approved") || null;
      const allowedPresence = presence?.currentJobId === body.rideId ? { ...presence, currentJobId: null } : presence;
      const eligibility = operationalEligibility({ driver: driverSnap.exists ? driverSnap.data() : null, vehicle, documents: docsQuery.docs.map((d) => d.data()), presence: allowedPresence });
      const fresh = presence?.locationUpdatedAt?.toMillis?.() ? Date.now() - presence.locationUpdatedAt.toMillis() <= 120000 : false;
      if (!driverSnap.exists || !presence?.online || !presence.currentLocation || !fresh || !eligibility.eligible) throw Object.assign(new Error("That Driver is not online, location-current and eligible."), { status: 409 });
      if (ride.requiredVehicleTypes?.length && !ride.requiredVehicleTypes.includes(vehicle?.type)) throw Object.assign(new Error("That Driver's approved vehicle is not suitable for this ride."), { status: 409 });
      const batch = db.batch(); const now = FieldValue.serverTimestamp();
      if (ride.assignedDriverId && ride.assignedDriverId !== body.driverId) batch.set(db.collection("driverPresence").doc(ride.assignedDriverId), { currentJobId: null, currentWorkType: null, availabilityState: "online_current", updatedAt: now }, { merge: true });
      batch.set(ref, { assignedDriverId: body.driverId, assignedVehicleId: vehicle?.id || null, state: "driver_assigned", assignedAt: now, manualAssignmentReason: reason, exceptionCode: null, updatedAt: now }, { merge: true });
      if (ride.orderId) batch.set(db.collection("orders").doc(ride.orderId), { assignedDriverId: body.driverId, rideStatus: "driver_assigned", status: "accepted", updatedAt: now }, { merge: true });
      batch.set(db.collection("driverPresence").doc(body.driverId), { currentJobId: body.rideId, currentWorkType: "ride", availabilityState: "on_ride", updatedAt: now }, { merge: true });
      batch.set(db.collection("rideEvents").doc(), { rideId: body.rideId, type: body.action === "reassign" ? "dispatch.reassigned" : "dispatch.assigned", actorType: "admin", actorId: actor.uid, previousState: ride.state, state: "driver_assigned", note: reason, metadata: { driverId: body.driverId, previousDriverId: ride.assignedDriverId || null }, createdAt: now });
      batch.set(db.collection("auditLogs").doc(), { actorId: actor.uid, action: `ride.${body.action}`, entityType: "rideTrip", entityId: body.rideId, reason, metadata: { driverId: body.driverId, previousDriverId: ride.assignedDriverId || null }, source: "admin_dispatch", createdAt: now });
      await batch.commit();
      const offers = await db.collection("rideOffers").where("rideId", "==", body.rideId).limit(100).get(); const offerBatch = db.batch(); let changed = false; offers.docs.forEach((doc) => { if (["offered", "viewed"].includes(doc.data().state)) { offerBatch.set(doc.ref, { state: "withdrawn", updatedAt: FieldValue.serverTimestamp() }, { merge: true }); changed = true; } }); if (changed) await offerBatch.commit();
      await notifyUsers(db, messaging, [body.driverId], { title: "Ride assigned", body: `${ride.number || body.rideId} was assigned to you.`, href: "/active", category: "ride", workspace: "driver", module: "rides" });
      if (ride.customerId) await notifyUsers(db, messaging, [ride.customerId], { title: "Driver assigned", body: `A Driver has been assigned to ${ride.number || "your ride"}.`, href: "/ride", category: "ride", workspace: "customer", module: "rides" });
      return Response.json({ ok: true });
    }
    if (body.action === "cancel") {
      if (["completed", "cancelled", "failed"].includes(ride.state)) throw Object.assign(new Error("This ride can no longer be cancelled."), { status: 409 });
      const batch = db.batch(); const now = FieldValue.serverTimestamp();
      batch.set(ref, { state: "cancelled", exceptionCode: "admin_cancelled", cancellationReason: reason, cancelledBy: "admin", cancelledAt: now, updatedAt: now }, { merge: true });
      if (ride.orderId) batch.set(db.collection("orders").doc(ride.orderId), { status: "cancelled", rideStatus: "cancelled", cancellationReason: reason, updatedAt: now }, { merge: true });
      if (ride.assignedDriverId) batch.set(db.collection("driverPresence").doc(ride.assignedDriverId), { currentJobId: null, currentWorkType: null, availabilityState: "online_current", updatedAt: now }, { merge: true });
      batch.set(db.collection("rideEvents").doc(), { rideId: body.rideId, type: "ride.cancelled", actorType: "admin", actorId: actor.uid, previousState: ride.state, state: "cancelled", note: reason, createdAt: now });
      batch.set(db.collection("auditLogs").doc(), { actorId: actor.uid, action: "ride.cancel", entityType: "rideTrip", entityId: body.rideId, reason, source: "admin_dispatch", createdAt: now });
      await batch.commit();
      if (ride.assignedDriverId) await notifyUsers(db, messaging, [ride.assignedDriverId], { title: "Ride cancelled", body: `${ride.number || body.rideId} was cancelled by Spotly Operations.`, href: "/", category: "ride", workspace: "driver", module: "rides" });
      if (ride.customerId) await notifyUsers(db, messaging, [ride.customerId], { title: "Ride cancelled", body: `${ride.number || body.rideId} was cancelled by Spotly Operations.`, href: "/ride", category: "ride", workspace: "customer", module: "rides" });
      return Response.json({ ok: true });
    }
    if (body.action === "clear_exception") await ref.set({ exceptionCode: null, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the ride operation." }, { status: 400 });
    return apiError(error);
  }
}

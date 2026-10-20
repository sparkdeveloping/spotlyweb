import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { notifyUsers, operationalEligibility } from "@/lib/driver-delivery-server";
import { dispatchParcel, parcelSettings, plainParcel } from "@/lib/parcel-server";
import { safeText } from "@/lib/server-helpers";

export const runtime = "nodejs";
const ROLES = ["super_admin", "admin", "platform_admin", "operations_manager", "regional_operations_manager", "driver_operations_coordinator", "dispatcher", "support_manager"];
const CONFIG_ROLES = ["super_admin", "admin", "platform_admin", "operations_manager", "regional_operations_manager"];
const schema = z.object({ parcelJobId: z.string().min(3).max(180), action: z.enum(["dispatch", "assign", "reassign", "cancel", "clear_exception"]), driverId: z.string().max(180).optional(), reason: z.string().max(1000).optional() });
const settingsSchema = z.object({
  enabled: z.boolean().optional(),routingVerified:z.boolean().optional(),dispatchSchedulerVerified:z.boolean().optional(),maxSearchSeconds:z.number().int().min(90).max(1800).optional(),cityGeofences:z.record(z.string().min(4),z.object({country:z.literal("ZW"),lat:z.number().min(-90).max(90),lng:z.number().min(-180).max(180),radiusKm:z.number().min(3).max(100)}).strict()).optional(), cashEnabled: z.boolean().optional(), scheduledEnabled: z.boolean().optional(), enabledCities: z.array(z.string().trim().min(1).max(120)).max(50).optional(), enabledAreas: z.record(z.string().trim().min(1).max(120), z.array(z.string().trim().min(1).max(120)).max(100)).optional(),
  pricing: z.object({ baseFare: z.number().min(0).max(1000).optional(), perKm: z.number().min(0).max(1000).optional(), bookingFee: z.number().min(0).max(1000).optional(), minimumFare: z.number().min(0).max(1000).optional(), driverSharePercent: z.number().min(1).max(100).optional(), maxPickupKm: z.number().min(1).max(100).optional(), offerSeconds: z.number().int().min(20).max(600).optional(), proofPhotoRequired: z.boolean().optional() }).partial().optional()
});

export async function GET(request) {
  try {
    await authenticateRequest(request, { roles: ROLES }); const { db } = getAdminServices(); const url = new URL(request.url); const parcelJobId = url.searchParams.get("parcelJobId");
    if (parcelJobId) {
      const parcel = await db.collection("parcelJobs").doc(parcelJobId).get(); if (!parcel.exists) throw Object.assign(new Error("The Send request was not found."), { status: 404 });
      const [events, offers] = await Promise.all([db.collection("parcelEvents").where("parcelJobId", "==", parcelJobId).limit(250).get(), db.collection("parcelOffers").where("parcelJobId", "==", parcelJobId).limit(100).get()]);
      return Response.json({ ok: true, parcel: { id: parcel.id, ...plainParcel(parcel.data()) }, events: events.docs.map((d) => ({ id: d.id, ...plainParcel(d.data()) })), offers: offers.docs.map((d) => ({ id: d.id, ...plainParcel(d.data()) })) });
    }
    const [parcels, presence, drivers, settingsSnap] = await Promise.all([db.collection("parcelJobs").limit(300).get(), db.collection("driverPresence").limit(300).get(), db.collection("drivers").limit(300).get(), db.collection("platformSettings").doc("global").get()]);
    return Response.json({ ok: true, parcels: parcels.docs.map((d) => ({ id: d.id, ...plainParcel(d.data()) })), presence: presence.docs.map((d) => ({ id: d.id, ...plainParcel(d.data()) })), drivers: drivers.docs.map((d) => ({ id: d.id, ...plainParcel(d.data()) })), send: parcelSettings(settingsSnap.exists ? settingsSnap.data() : {}) });
  } catch (error) { return apiError(error); }
}

export async function PATCH(request) {
  try {
    const actor = await authenticateRequest(request, { roles: CONFIG_ROLES }); const body = settingsSchema.parse(await request.json()); const { db } = getAdminServices(); const ref = db.collection("platformSettings").doc("global"); const currentSnap = await ref.get(); const current = currentSnap.exists ? currentSnap.data() : {}; const mobility = current.mobility || {}; const send = mobility.send || {};
    if(body.enabled!==undefined&&body.enabled!==(send.enabled===true))
      throw Object.assign(new Error("Use Admin Mobility → Service Launch & Controls to activate or pause Send."),{status:409});
    const next = { ...send,
     ...(body.routingVerified!==undefined?{routingVerified:body.routingVerified}:{}),
     ...(body.dispatchSchedulerVerified!==undefined?{dispatchSchedulerVerified:body.dispatchSchedulerVerified}:{}),
     ...(body.maxSearchSeconds!==undefined?{maxSearchSeconds:body.maxSearchSeconds}:{}),
     ...(body.cityGeofences!==undefined?{cityGeofences:body.cityGeofences}:{}), ...(body.enabled !== undefined ? { enabled: body.enabled } : {}), ...(body.cashEnabled !== undefined ? { cashEnabled: body.cashEnabled } : {}), ...(body.scheduledEnabled !== undefined ? { scheduledEnabled: body.scheduledEnabled } : {}), ...(body.enabledCities !== undefined ? { enabledCities: [...new Set(body.enabledCities.map((value) => value.trim()).filter(Boolean))] } : {}), ...(body.enabledAreas !== undefined ? { enabledAreas: Object.fromEntries(Object.entries(body.enabledAreas).map(([city, areas]) => [city.trim(), [...new Set(areas.map((value) => value.trim()).filter(Boolean))]]).filter(([city, areas]) => city && areas.length)) } : {}), ...(body.pricing ? { pricing: { ...(send.pricing || {}), ...body.pricing } } : {}) };
    await ref.set({ mobility: { ...mobility, send: next }, updatedAt: FieldValue.serverTimestamp(), updatedBy: actor.uid }, { merge: true });
    await db.collection("auditLogs").add({ actorId: actor.uid, action: "mobility.send_settings.updated", entityType: "platformSettings", entityId: "global", metadata: { enabled: next.enabled === true, cashEnabled: next.cashEnabled !== false, enabledCities: next.enabledCities || [], enabledAreas: next.enabledAreas || {}, pricing: next.pricing || {} }, source: "admin_send", createdAt: FieldValue.serverTimestamp() });
    return Response.json({ ok: true, send: parcelSettings({ ...current, mobility: { ...mobility, send: next } }) });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the Send settings." }, { status: 400 });
    return apiError(error);
  }
}

export async function POST(request) {
  try {
    const actor = await authenticateRequest(request, { roles: ROLES }); const body = schema.parse(await request.json()); const reason = safeText(body.reason || "", 1000); const { db, messaging } = getAdminServices();
    if (body.action === "dispatch") return Response.json({ ok: true, ...(await dispatchParcel({ db, messaging, parcelJobId: body.parcelJobId, actorId: actor.uid })) });
    if (["assign", "reassign", "cancel"].includes(body.action) && reason.length < 3) throw Object.assign(new Error("Add a reason for this operational override."), { status: 400 });
    const ref = db.collection("parcelJobs").doc(body.parcelJobId); const snap = await ref.get(); if (!snap.exists) throw Object.assign(new Error("The Send request was not found."), { status: 404 }); const parcel = snap.data();
    if (["assign", "reassign"].includes(body.action)) {
      if (!["requested", "searching_driver", "driver_assigned", "driver_to_pickup"].includes(parcel.state)) throw Object.assign(new Error("This Send request can no longer be manually assigned."), { status: 409 });
      if (!body.driverId) throw Object.assign(new Error("Choose a Driver."), { status: 400 });
      const [driverSnap, presenceSnap, vehicleQuery, docsQuery] = await Promise.all([db.collection("drivers").doc(body.driverId).get(), db.collection("driverPresence").doc(body.driverId).get(), db.collection("driverVehicles").where("driverId", "==", body.driverId).limit(10).get(), db.collection("driverDocuments").where("driverId", "==", body.driverId).limit(50).get()]);
      const presence = presenceSnap.exists ? presenceSnap.data() : null; const vehicle = vehicleQuery.docs.map((d) => ({ id: d.id, ...d.data() })).find((item) => item.status === "approved") || null; const allowedPresence = presence?.currentJobId === body.parcelJobId ? { ...presence, currentJobId: null } : presence; const eligibility = operationalEligibility({ driver: driverSnap.exists ? driverSnap.data() : null, vehicle, documents: docsQuery.docs.map((d) => d.data()), presence: allowedPresence }); const fresh = presence?.locationUpdatedAt?.toMillis?.() ? Date.now() - presence.locationUpdatedAt.toMillis() <= 120000 : false;
      if (!driverSnap.exists || !presence?.online || !presence.currentLocation || !fresh || !eligibility.eligible) throw Object.assign(new Error("That Driver is not online, location-current and eligible."), { status: 409 });
      if (parcel.requiredVehicleTypes?.length && !parcel.requiredVehicleTypes.includes(vehicle?.type)) throw Object.assign(new Error("That Driver's approved vehicle is not suitable for this parcel."), { status: 409 });
      await db.runTransaction(async tx=>{
        const currentSnap=await tx.get(ref);
        if(!currentSnap.exists||!["requested","searching_driver","driver_assigned","driver_to_pickup"].includes(currentSnap.data().state))
          throw Object.assign(new Error("Send state changed before assignment."),{status:409});
        const current=currentSnap.data();
        const newRef=db.collection("driverPresence").doc(body.driverId);
        const oldRef=current.assignedDriverId&&current.assignedDriverId!==body.driverId?
          db.collection("driverPresence").doc(current.assignedDriverId):null;
        const [nowPresence,oldPresence]=await Promise.all([tx.get(newRef),oldRef?tx.get(oldRef):Promise.resolve(null)]);
        if(!nowPresence.exists||nowPresence.data().online!==true||
           (nowPresence.data().currentJobId&&nowPresence.data().currentJobId!==body.parcelJobId)||
           !nowPresence.data().locationUpdatedAt?.toMillis?.()||
           Date.now()-nowPresence.data().locationUpdatedAt.toMillis()>120000)
          throw Object.assign(new Error("The Driver is no longer available to accept this Send."),{status:409});
        const now=FieldValue.serverTimestamp();
        if(oldRef&&oldPresence?.exists&&oldPresence.data().currentJobId===body.parcelJobId)
          tx.update(oldRef,{currentJobId:null,currentWorkType:null,availabilityState:"online_current",updatedAt:now});
        tx.update(ref,{assignedDriverId:body.driverId,assignedVehicleId:vehicle?.id||null,
          state:"driver_assigned",assignedAt:now,manualAssignmentReason:reason,
          exceptionCode:null,updatedAt:now});
        if(current.orderId)tx.update(db.collection("orders").doc(current.orderId),{
          assignedDriverId:body.driverId,sendStatus:"driver_assigned",status:"accepted",updatedAt:now});
        tx.update(newRef,{currentJobId:body.parcelJobId,currentWorkType:"send",
          availabilityState:"on_send",updatedAt:now});
        tx.create(db.collection("parcelEvents").doc(),{parcelJobId:body.parcelJobId,
          type:body.action==="reassign"?"dispatch.reassigned":"dispatch.assigned",
          actorType:"admin",actorId:actor.uid,previousState:current.state,state:"driver_assigned",
          note:reason,metadata:{driverId:body.driverId,previousDriverId:current.assignedDriverId||null},
          createdAt:now});
        tx.create(db.collection("auditLogs").doc(),{
          actorId:actor.uid,action:"parcel."+body.action,entityType:"parcelJob",entityId:body.parcelJobId,
          reason,metadata:{driverId:body.driverId,previousDriverId:current.assignedDriverId||null},
          source:"admin_dispatch",createdAt:now});
      });
      const offers = await db.collection("parcelOffers").where("parcelJobId", "==", body.parcelJobId).limit(100).get(); const offerBatch = db.batch(); let changed = false; offers.docs.forEach((doc) => { if (["offered", "viewed"].includes(doc.data().state)) { offerBatch.set(doc.ref, { state: "withdrawn", updatedAt: FieldValue.serverTimestamp() }, { merge: true }); changed = true; } }); if (changed) await offerBatch.commit();
      await notifyUsers(db, messaging, [body.driverId], { title: "Send assigned", body: `${parcel.number || body.parcelJobId} was assigned to you.`, href: "/active", category: "send", workspace: "driver", module: "send" }); if (parcel.customerId) await notifyUsers(db, messaging, [parcel.customerId], { title: "Courier assigned", body: `A Driver has been assigned to ${parcel.number || "your Send request"}.`, href: "/send", category: "send", workspace: "customer", module: "send" });
      return Response.json({ ok: true });
    }
    if (body.action === "cancel") {
      if(["collected","en_route","driver_arrived_dropoff","handoff_verification","handoff_exception","return_in_progress"].includes(parcel.state))
        throw Object.assign(new Error("The parcel was collected. Use Send recovery to arrange a documented return or loss review."),{status:409});
      if(parcel.paymentStatus==="paid"||parcel.paymentReviewRequired===true)
        throw Object.assign(new Error("This Send involves captured or disputed customer funds. Use Send recovery and Finance review."),{status:409});
      if (["delivered", "cancelled", "failed", "returned"].includes(parcel.state)) throw Object.assign(new Error("This Send request can no longer be cancelled."), { status: 409 }); const now = FieldValue.serverTimestamp(); const batch = db.batch(); batch.set(ref, { state: "cancelled", exceptionCode: "admin_cancelled", cancellationReason: reason, cancelledBy: "admin", cancelledAt: now, updatedAt: now }, { merge: true }); if (parcel.orderId) batch.set(db.collection("orders").doc(parcel.orderId), { status: "cancelled", sendStatus: "cancelled", cancellationReason: reason, updatedAt: now }, { merge: true }); if (parcel.assignedDriverId) batch.set(db.collection("driverPresence").doc(parcel.assignedDriverId), { currentJobId: null, currentWorkType: null, availabilityState: "online_current", updatedAt: now }, { merge: true }); batch.set(db.collection("parcelEvents").doc(), { parcelJobId: body.parcelJobId, type: "parcel.cancelled", actorType: "admin", actorId: actor.uid, previousState: parcel.state, state: "cancelled", note: reason, createdAt: now }); await batch.commit(); if (parcel.assignedDriverId) await notifyUsers(db, messaging, [parcel.assignedDriverId], { title: "Send cancelled", body: `${parcel.number || body.parcelJobId} was cancelled by Spotly Operations.`, href: "/", category: "send", workspace: "driver", module: "send" }); if (parcel.customerId) await notifyUsers(db, messaging, [parcel.customerId], { title: "Send cancelled", body: `${parcel.number || body.parcelJobId} was cancelled by Spotly Operations.`, href: "/send", category: "send", workspace: "customer", module: "send" }); return Response.json({ ok: true });
    }
    if (body.action === "clear_exception") await ref.set({ exceptionCode: null, updatedAt: FieldValue.serverTimestamp() }, { merge: true }); return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the Send operation." }, { status: 400 });
    return apiError(error);
  }
}

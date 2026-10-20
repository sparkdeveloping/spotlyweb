import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { notifyUsers, operationalEligibility } from "@/lib/driver-delivery-server";
import { dispatchRide, plainRide, rideSettings } from "@/lib/ride-server";
import { safeText } from "@/lib/server-helpers";

export const runtime = "nodejs";
const ROLES = ["super_admin", "admin", "platform_admin", "operations_manager", "regional_operations_manager", "driver_operations_coordinator", "dispatcher", "support_manager"];
const RIDE_CONFIG_ROLES = ["super_admin", "admin", "platform_admin", "operations_manager", "regional_operations_manager"];
const schema = z.object({ rideId: z.string().min(3).max(180), action: z.enum(["dispatch", "assign", "reassign", "cancel", "clear_exception","terminate_trip","resume_safety"]), driverId: z.string().max(180).optional(), reason: z.string().max(1000).optional() });

const mobilitySchema = z.object({
  ridesEnabled: z.boolean().optional(),
  routingVerified:z.boolean().optional(),
  dispatchSchedulerVerified:z.boolean().optional(),
  enabledCountries:z.array(z.enum(["ZW","MW"])).max(2).optional(),
  maxSearchSeconds:z.number().int().min(90).max(1200).optional(),
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
      ...(body.routingVerified!==undefined?{routingVerified:body.routingVerified}:{}),
      ...(body.dispatchSchedulerVerified!==undefined?{dispatchSchedulerVerified:body.dispatchSchedulerVerified}:{}),
      ...(body.enabledCountries!==undefined?{enabledCountries:body.enabledCountries}:{}),
      ...(body.maxSearchSeconds!==undefined?{maxSearchSeconds:body.maxSearchSeconds}:{}),
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
    if (["assign", "reassign", "cancel","terminate_trip"].includes(body.action) && reason.length < 3) throw Object.assign(new Error("Add a reason for this operational override."), { status: 400 });
    const ref = db.collection("rideTrips").doc(body.rideId); const snap = await ref.get(); if (!snap.exists) throw Object.assign(new Error("The ride was not found."), { status: 404 }); const ride = snap.data();
    if (["assign", "reassign"].includes(body.action)) {
      if (!["requested", "searching_driver", "driver_assigned", "driver_to_pickup"].includes(ride.state)) throw Object.assign(new Error("This ride can no longer be manually assigned. Use the incident and support workflow instead."), { status: 409 });
      if (!body.driverId) throw Object.assign(new Error("Choose a Driver."), { status: 400 });
      const [driverSnap, applicationSnap, presenceSnap, vehicleQuery, docsQuery] = await Promise.all([db.collection("drivers").doc(body.driverId).get(), db.collection("driverApplications").doc(body.driverId).get(), db.collection("driverPresence").doc(body.driverId).get(), db.collection("driverVehicles").where("driverId", "==", body.driverId).limit(10).get(), db.collection("driverDocuments").where("driverId", "==", body.driverId).limit(50).get()]);
      const presence = presenceSnap.exists ? presenceSnap.data() : null; const vehicle = vehicleQuery.docs.map((d) => ({ id: d.id, ...d.data() })).find((item) => item.status === "approved") || null;
      const allowedPresence = presence?.currentJobId === body.rideId ? { ...presence, currentJobId: null } : presence;
      const eligibility = operationalEligibility({driver:driverSnap.exists?driverSnap.data():null,
       application:applicationSnap.exists?applicationSnap.data():{},vehicle,
       documents:docsQuery.docs.map(d=>({id:d.id,...d.data()})),presence:allowedPresence,
       capability:"ride_passenger",requiredVehicleTypes:ride.requiredVehicleTypes||[]});
      const fresh = presence?.locationUpdatedAt?.toMillis?.() ? Date.now() - presence.locationUpdatedAt.toMillis() <= 120000 : false;
      if (!driverSnap.exists || !presence?.online || !presence.currentLocation || !fresh || !eligibility.eligible) throw Object.assign(new Error("That Driver is not online, location-current and eligible."), { status: 409 });
      if (ride.requiredVehicleTypes?.length && !ride.requiredVehicleTypes.includes(vehicle?.type)) throw Object.assign(new Error("That Driver's approved vehicle is not suitable for this ride."), { status: 409 });
      await db.runTransaction(async tx=>{
        const rideCurrent=await tx.get(ref);
        if(!rideCurrent.exists||!["requested","searching_driver","driver_assigned","driver_to_pickup"].includes(rideCurrent.data().state))
         throw Object.assign(new Error("Ride state changed. Refresh before assigning."),{status:409});
        const now=FieldValue.serverTimestamp();
        const newRef=db.collection("driverPresence").doc(body.driverId);
        const oldId=rideCurrent.data().assignedDriverId;
        const oldRef=oldId&&oldId!==body.driverId?db.collection("driverPresence").doc(oldId):null;
        const [newPresence,oldPresence]=await Promise.all([tx.get(newRef),oldRef?tx.get(oldRef):Promise.resolve(null)]);
        if(!newPresence.exists||newPresence.data().online!==true||
          (newPresence.data().currentJobId&&newPresence.data().currentJobId!==body.rideId)||
          !newPresence.data().locationUpdatedAt?.toMillis?.()||
          Date.now()-newPresence.data().locationUpdatedAt.toMillis()>120000)
         throw Object.assign(new Error("Driver became unavailable before assignment."),{status:409});
        if(oldRef&&oldPresence?.exists&&oldPresence.data().currentJobId===body.rideId)
          tx.update(oldRef,{currentJobId:null,currentWorkType:null,availabilityState:"online_current",updatedAt:now});
        tx.update(ref,{assignedDriverId:body.driverId,assignedVehicleId:vehicle?.id||null,
          state:"driver_assigned",assignedAt:now,manualAssignmentReason:reason,exceptionCode:null,updatedAt:now});
        if(rideCurrent.data().orderId)tx.update(db.collection("orders").doc(rideCurrent.data().orderId),{
          assignedDriverId:body.driverId,rideStatus:"driver_assigned",status:"accepted",updatedAt:now});
        tx.update(newRef,{currentJobId:body.rideId,currentWorkType:"ride",availabilityState:"on_ride",updatedAt:now});
        tx.create(db.collection("rideEvents").doc(),{rideId:body.rideId,
          type:body.action==="reassign"?"dispatch.reassigned":"dispatch.assigned",actorType:"admin",
          actorId:actor.uid,previousState:rideCurrent.data().state,state:"driver_assigned",
          note:reason,metadata:{driverId:body.driverId,previousDriverId:oldId||null},createdAt:now});
        tx.create(db.collection("auditLogs").doc(),{actorId:actor.uid,action:"ride."+body.action,
          entityType:"rideTrip",entityId:body.rideId,reason,
          metadata:{driverId:body.driverId,previousDriverId:oldId||null},source:"admin_dispatch",createdAt:now});
      });
      const offers = await db.collection("rideOffers").where("rideId", "==", body.rideId).limit(100).get(); const offerBatch = db.batch(); let changed = false; offers.docs.forEach((doc) => { if (["offered", "viewed"].includes(doc.data().state)) { offerBatch.set(doc.ref, { state: "withdrawn", updatedAt: FieldValue.serverTimestamp() }, { merge: true }); changed = true; } }); if (changed) await offerBatch.commit();
      await notifyUsers(db, messaging, [body.driverId], { title: "Ride assigned", body: `${ride.number || body.rideId} was assigned to you.`, href: "/active", category: "ride", workspace: "driver", module: "rides" });
      if (ride.customerId) await notifyUsers(db, messaging, [ride.customerId], { title: "Driver assigned", body: `A Driver has been assigned to ${ride.number || "your ride"}.`, href: "/ride", category: "ride", workspace: "customer", module: "rides" });
      return Response.json({ ok: true });
    }
    if(body.action==="resume_safety"){
      if(!actor.profile?.roles?.some(r=>["super_admin","platform_admin","operations_manager"].includes(r))||
         reason.trim().length<30)
        throw Object.assign(new Error("An authorized Operations manager must document the full safety investigation."),{status:403});
      await db.runTransaction(async tx=>{
        const current=await tx.get(ref);
        if(!current.exists||current.data().safetyReviewHold!==true||
           ["completed","cancelled","failed"].includes(current.data().state))
          throw Object.assign(new Error("No active safety hold requires resumption."),{status:409});
        const driverRef=current.data().assignedDriverId?
          db.collection("drivers").doc(current.data().assignedDriverId):null;
        const driverSnap=driverRef?await tx.get(driverRef):null;
        if(driverSnap?.data()?.safetyHold===true)
          throw Object.assign(new Error("Driver safety clearance is still missing."),{status:409});
        const now=FieldValue.serverTimestamp();
        tx.update(ref,{safetyReviewHold:false,exceptionCode:null,
          safetyResumedBy:actor.uid,safetyResolution:reason,updatedAt:now});
        tx.create(db.collection("rideEvents").doc(),{rideId:body.rideId,
          type:"ride.safety_resumed",actorType:"admin",actorId:actor.uid,
          state:current.data().state,note:reason,createdAt:now});
        tx.create(db.collection("auditLogs").doc(),{actorId:actor.uid,
          action:"ride.safety_resumed",entityType:"rideTrip",entityId:body.rideId,
          reason,createdAt:now});
      });
      return Response.json({ok:true,state:"safety_resumed",moneyMoved:false});
    }
    if(body.action==="terminate_trip"){
      if(!["in_trip","driver_arrived_dropoff"].includes(ride.state)||reason.length<20)
        throw Object.assign(new Error("Trip termination is only for in-progress safety incidents, with detailed evidence."),{status:409});
      const now=FieldValue.serverTimestamp();
      await db.runTransaction(async tx=>{
        const current=await tx.get(ref);
        if(!current.exists||!["in_trip","driver_arrived_dropoff"].includes(current.data().state))
          throw Object.assign(new Error("The trip state has changed."),{status:409});
        const active=current.data();
        const presence=active.assignedDriverId?db.collection("driverPresence").doc(active.assignedDriverId):null;
        const driverState=presence?await tx.get(presence):null;
        tx.update(ref,{state:"failed",paymentReviewRequired:true,driverEarningsStatus:"on_hold",
          failureReason:reason,failedAt:now,updatedAt:now});
        if(active.orderId)tx.update(db.collection("orders").doc(active.orderId),{
         status:"payment_exception",rideStatus:"failed",paymentReviewRequired:true,updatedAt:now});
        if(presence&&driverState?.exists&&driverState.data().currentJobId===body.rideId)
          tx.update(presence,{currentJobId:null,currentWorkType:null,availabilityState:"online_current",updatedAt:now});
        tx.set(db.collection("adminQueueItems").doc("ride_incident_"+body.rideId),{
          queue:"ride-exceptions",type:"trip_termination_finance_review",rideId:body.rideId,
          entityId:body.rideId,status:"open",priority:"urgent",title:"Ride terminated · finance review",
          reason,updatedAt:now,createdAt:now},{merge:true});
        tx.create(db.collection("rideEvents").doc(),{rideId:body.rideId,type:"ride.terminated",
          actorType:"admin",actorId:actor.uid,state:"failed",note:reason,createdAt:now});
        tx.create(db.collection("auditLogs").doc(),{actorId:actor.uid,action:"ride.terminated",
          entityType:"rideTrip",entityId:body.rideId,reason,createdAt:now});
      });
      if(ride.customerId)await notifyUsers(db,messaging,[ride.customerId],{
        title:"Ride needs urgent support",body:"Your trip was stopped. Spotly is reviewing safety and any payment.",
        href:"/ride",category:"ride",workspace:"customer",module:"rides"});
      return Response.json({ok:true,state:"failed",paymentReviewRequired:true,refundIssued:false});
    }
    if (body.action === "cancel") {
      if(!["requested","searching_driver","driver_assigned","driver_to_pickup",
        "driver_arrived_pickup","pickup_verification","no_show_review"].includes(ride.state))
       throw Object.assign(new Error("In-progress trips need the incident termination workflow."),{status:409});
      if (["completed", "cancelled", "failed"].includes(ride.state)) throw Object.assign(new Error("This ride can no longer be cancelled."), { status: 409 });
      await db.runTransaction(async tx=>{
        const current=await tx.get(ref);
        if(!current.exists||!["requested","searching_driver","driver_assigned","driver_to_pickup",
          "driver_arrived_pickup","pickup_verification","no_show_review"].includes(current.data().state))
          throw Object.assign(new Error("Ride status changed while cancelling."),{status:409});
        const currentRide=current.data(),presenceRef=currentRide.assignedDriverId?
          db.collection("driverPresence").doc(currentRide.assignedDriverId):null;
        const presence=presenceRef?await tx.get(presenceRef):null;
        const now=FieldValue.serverTimestamp();
        const needsReview=currentRide.paymentStatus==="paid";
        tx.update(ref,{state:"cancelled",exceptionCode:needsReview?"paid_ride_cancelled":"admin_cancelled",
         paymentReviewRequired:needsReview,cancellationReason:reason,cancelledBy:"admin",cancelledAt:now,updatedAt:now});
        if(currentRide.orderId)tx.update(db.collection("orders").doc(currentRide.orderId),{
          status:needsReview?"payment_exception":"cancelled",rideStatus:"cancelled",
          ...(needsReview?{paymentReviewRequired:true}:{}),cancellationReason:reason,updatedAt:now});
        if(presence?.exists&&presence.data().currentJobId===body.rideId)
          tx.update(presenceRef,{currentJobId:null,currentWorkType:null,
            availabilityState:"online_current",updatedAt:now});
        if(needsReview)tx.set(db.collection("adminQueueItems").doc("ride_payment_refund_"+body.rideId),{
          queue:"ride-exceptions",type:"captured_ride_cancelled",status:"open",priority:"high",
          rideId:body.rideId,entityId:body.rideId,title:"Paid Ride cancelled · Finance review",
          createdAt:now,updatedAt:now},{merge:true});
        tx.create(db.collection("rideEvents").doc(),{rideId:body.rideId,type:"ride.cancelled",
          actorType:"admin",actorId:actor.uid,previousState:currentRide.state,
          state:"cancelled",note:reason,createdAt:now});
        tx.create(db.collection("auditLogs").doc(),{actorId:actor.uid,action:"ride.cancel",
          entityType:"rideTrip",entityId:body.rideId,reason,source:"admin_dispatch",createdAt:now});
      });
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

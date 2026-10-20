import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { notifyUsers, operationalEligibility } from "@/lib/driver-delivery-server";
import { appendRideEvent, dispatchRide, rideTransitionAllowed } from "@/lib/ride-server";

export const runtime = "nodejs";
const schema = z.object({ offerId: z.string().min(3).max(180), action: z.enum(["view", "accept", "decline"]) });

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const body = schema.parse(await request.json());
    const { db, messaging } = getAdminServices();
    const offerRef = db.collection("rideOffers").doc(body.offerId);
    let rideId = ""; let notification = null; let expiredOffer=false;
    await db.runTransaction(async (transaction) => {
      const offerSnap = await transaction.get(offerRef);
      if (!offerSnap.exists) throw Object.assign(new Error("This ride offer is no longer available."), { status: 404 });
      const offer = offerSnap.data();
      if (offer.driverId !== user.uid) throw Object.assign(new Error("This ride offer is not assigned to your Driver account."), { status: 403 });
      if (offer.expiresAt?.toMillis?.() && offer.expiresAt.toMillis() <= Date.now()) {
        if(["offered","viewed"].includes(offer.state))
          transaction.set(offerRef,{state:"expired",updatedAt:FieldValue.serverTimestamp()},{merge:true});
        expiredOffer=true;
        return;
      }
      rideId = offer.rideId;
      const rideRef = db.collection("rideTrips").doc(rideId); const rideSnap = await transaction.get(rideRef);
      if (!rideSnap.exists) throw Object.assign(new Error("The ride is no longer available."), { status: 404 });
      const ride = rideSnap.data();
      if (body.action === "view") { if (offer.state === "offered") transaction.set(offerRef, { state: "viewed", viewedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true }); return; }
      if (!["offered", "viewed"].includes(offer.state)) throw Object.assign(new Error("This ride offer is no longer available."), { status: 409 });
      if (body.action === "decline") { transaction.set(offerRef, { state: "declined", declinedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true }); await appendRideEvent(transaction, db, { rideId, type: "offer.declined", actorType: "driver", actorId: user.uid, state: ride.state }); return; }
      if (!rideTransitionAllowed(ride.state, "driver_assigned") || ride.assignedDriverId) throw Object.assign(new Error("Another Driver already accepted this ride."), { status: 409 });
      const presenceRef = db.collection("driverPresence").doc(user.uid);
      const driverRef = db.collection("drivers").doc(user.uid);
      const applicationRef = db.collection("driverApplications").doc(user.uid);
      const vehicleRef = offer.vehicleId ? db.collection("driverVehicles").doc(offer.vehicleId) : null;
      const docsRef = db.collection("driverDocuments").where("driverId", "==", user.uid).limit(50);
      const [presenceSnap, driverSnap, applicationSnap, vehicleSnap, docsSnap] = await Promise.all([
        transaction.get(presenceRef), transaction.get(driverRef), transaction.get(applicationRef), vehicleRef ? transaction.get(vehicleRef) : Promise.resolve(null), transaction.get(docsRef)
      ]);
      const presence = presenceSnap.exists ? presenceSnap.data() : null; const driver = driverSnap.exists ? driverSnap.data() : null;
      const vehicle = vehicleSnap?.exists ? { id: vehicleSnap.id, ...vehicleSnap.data() } : null;
      const documents = docsSnap.docs.map((item) => ({ id: item.id, ...item.data() }));
      if (presence?.online && presence.currentJobId) throw Object.assign(new Error("Your Driver is already handling another job."), { status: 409 });
      const eligibility = operationalEligibility({ driver, application: applicationSnap.exists ? applicationSnap.data() : {}, vehicle, documents, presence, capability: "ride_passenger", requiredVehicleTypes: ride.requiredVehicleTypes || ["car", "van"] });
      if (!presence?.online || !eligibility.eligible) throw Object.assign(new Error("Your Driver account, vehicle or Ride approval changed before this offer was accepted."), { status: 409, blockers: eligibility.checks.filter((item) => !item.ok) });
      const now = FieldValue.serverTimestamp();
      transaction.set(offerRef, { state: "accepted", acceptedAt: now, updatedAt: now }, { merge: true });
      transaction.set(rideRef, { state: "driver_assigned", assignedDriverId: user.uid, assignedVehicleId: vehicle?.id || null, acceptedDriverPay: Number(offer.pay ?? ride.quote?.driverPay ?? 0), assignedAt: now, updatedAt: now }, { merge: true });
      if (ride.orderId) transaction.set(db.collection("orders").doc(ride.orderId), { rideStatus: "driver_assigned", status: "accepted", assignedDriverId: user.uid, updatedAt: now }, { merge: true });
      transaction.set(db.collection("driverPresence").doc(user.uid), { currentJobId: rideId, currentWorkType: "ride", availabilityState: "on_ride", updatedAt: now }, { merge: true });
      await appendRideEvent(transaction, db, { rideId, type: "offer.accepted", actorType: "driver", actorId: user.uid, previousState: ride.state, state: "driver_assigned", metadata: { offerId: body.offerId, pay: Number(offer.pay ?? ride.quote?.driverPay ?? 0) } });
      transaction.create(db.collection("auditLogs").doc(), { actorId: user.uid, action: "ride.offer.accepted", entityType: "rideTrip", entityId: rideId, metadata: { offerId: body.offerId }, source: "ride_network", createdAt: now });
      notification = { customerId: ride.customerId, number: ride.number };
    });
    if(expiredOffer)throw Object.assign(new Error("This ride offer expired. Refresh your work queue."),{status:409});
    if (body.action === "accept" && notification) {
      const siblings = await db.collection("rideOffers").where("rideId", "==", rideId).limit(100).get(); const batch = db.batch(); let changed = false;
      siblings.docs.forEach((item) => { if (item.id !== body.offerId && ["offered", "viewed"].includes(item.data().state)) { batch.set(item.ref, { state: "withdrawn", withdrawnAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true }); changed = true; } }); if (changed) await batch.commit();
      await notifyUsers(db, messaging, [notification.customerId], { title: "Driver found", body: `Your Driver is confirmed for ${notification.number || "your ride"}.`, href: "/ride", category: "ride", workspace: "customer", module: "rides" });
    }
    if (body.action === "decline" && rideId) await dispatchRide({ db, messaging, rideId, actorId: user.uid });
    return Response.json({ ok: true, action: body.action, rideId: rideId || null });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the ride offer action." }, { status: 400 });
    return apiError(error);
  }
}

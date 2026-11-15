import { docData, docsData, publicOffer } from "@/lib/driver-delivery-server";
import { plainRide, publicRideOffer } from "@/lib/ride-server";
import { plainParcel, publicParcelOffer } from "@/lib/parcel-server";

// C1: One authoritative, owner-scoped projection powers both full bootstrap and
// lightweight driver refresh. Never include pickup/handoff PINs in this payload.
export async function driverLiveSnapshot(db, uid) {
  const [presenceSnap, offersQuery, jobsQuery, rideOffersQuery, ridesQuery, parcelOffersQuery, parcelsQuery] = await Promise.all([
    db.collection("driverPresence").doc(uid).get(),
    db.collection("deliveryOffers").where("driverId", "==", uid).where("state", "in", ["offered", "viewed"]).limit(20).get(),
    db.collection("deliveryJobs").where("assignedDriverId", "==", uid).limit(100).get(),
    db.collection("rideOffers").where("driverId", "==", uid).where("state", "in", ["offered", "viewed"]).limit(20).get(),
    db.collection("rideTrips").where("assignedDriverId", "==", uid).limit(100).get(),
    db.collection("parcelOffers").where("driverId", "==", uid).where("state", "in", ["offered", "viewed"]).limit(20).get(),
    db.collection("parcelJobs").where("assignedDriverId", "==", uid).limit(100).get()
  ]);
  const presence = docData(presenceSnap);
  let relatedGets = 0;
    const rawJobs = docsData(jobsQuery).sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
    const activeRaw = rawJobs.find((item) => !["delivered", "failed", "cancelled", "returned"].includes(item.state)) || null;
    const sanitizeJob = (item) => item ? { ...item, pickupCode: undefined, customerPin: undefined } : null;
    const activeJob = sanitizeJob(activeRaw);
    const jobs = rawJobs.map(sanitizeJob);
    const rawRides = ridesQuery.docs.map((item) => ({ id: item.id, ...plainRide(item.data()) })).sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
    const sanitizeRide = (item) => item ? { ...item, pickupPin: undefined } : null;
    const rides = rawRides.map(sanitizeRide);
    const activeRide = rides.find((item) => !["completed", "failed", "cancelled"].includes(item.state)) || null;
    const rideOffers = [];
    for (const offerDoc of rideOffersQuery.docs) {
      const offer = { id: offerDoc.id, ...offerDoc.data() };
      if (offer.expiresAt?.toMillis?.() && offer.expiresAt.toMillis() <= Date.now()) continue;
      relatedGets += 1;
      const rideSnap = await db.collection("rideTrips").doc(offer.rideId).get();
      if (!rideSnap.exists) continue;
      rideOffers.push(publicRideOffer({ id: rideSnap.id, ...rideSnap.data() }, offer));
    }

    const rawParcels = parcelsQuery.docs.map((item) => ({ id: item.id, ...plainParcel(item.data()) })).sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
    const parcels = rawParcels.map((item) => ({ ...item, pickupPin: undefined, dropoffPin: undefined }));
    const activeParcel = parcels.find((item) => !["delivered", "failed", "cancelled", "returned"].includes(item.state)) || null;
    const parcelOffers = [];
    for (const offerDoc of parcelOffersQuery.docs) {
      const offer = { id: offerDoc.id, ...offerDoc.data() };
      if (offer.expiresAt?.toMillis?.() && offer.expiresAt.toMillis() <= Date.now()) continue;
      relatedGets += 1;
      const parcelSnap = await db.collection("parcelJobs").doc(offer.parcelJobId).get();
      if (!parcelSnap.exists) continue;
      parcelOffers.push(publicParcelOffer({ id: parcelSnap.id, ...parcelSnap.data() }, offer));
    }

    const offers = [];
    for (const offerDoc of offersQuery.docs) {
      const offer = { id: offerDoc.id, ...offerDoc.data() };
      relatedGets += 1;
      const jobSnap = await db.collection("deliveryJobs").doc(offer.deliveryJobId).get();
      if (!jobSnap.exists) continue;
      const job = { id: jobSnap.id, ...jobSnap.data() };
      if (offer.expiresAt?.toMillis?.() && offer.expiresAt.toMillis() <= Date.now()) continue;
      relatedGets += Number(Boolean(job.businessId)) + Number(Boolean(job.branchId));
      const [businessSnap, branchSnap] = await Promise.all([
        job.businessId ? db.collection("businesses").doc(job.businessId).get() : null,
        job.branchId ? db.collection("branches").doc(job.branchId).get() : null
      ]);
      offers.push(publicOffer(job, offer, businessSnap?.data?.() || {}, branchSnap?.data?.() || {}));
    }

  const locationUpdatedAt = presence?.locationUpdatedAt ? new Date(presence.locationUpdatedAt).getTime() : 0;
  const locationAgeMs = locationUpdatedAt ? Math.max(0, Date.now() - locationUpdatedAt) : null;
  const locationHealth = !presence?.online ? "offline" : !presence?.currentLocation ? "missing" : locationAgeMs == null ? "unknown" : locationAgeMs <= 45_000 ? "good" : locationAgeMs <= 120_000 ? "weak" : "stale";
  // Stats count minimum query reads, not a billing statement. Fanout counts
  // represent actual get() attempts even where a document does not exist.
  const queryResults = [offersQuery, jobsQuery, rideOffersQuery, ridesQuery, parcelOffersQuery, parcelsQuery];
  const queryReadFloor = queryResults.reduce((sum, snap) => sum + Math.max(1, snap.docs.length), 0);
  return {
    data: { presence, offers, rideOffers, parcelOffers, activeJob, activeRide, activeParcel, jobs, rides, parcels, locationHealth, locationAgeMs },
    estimatedReadFloor: 1 + queryReadFloor + relatedGets
  };
}

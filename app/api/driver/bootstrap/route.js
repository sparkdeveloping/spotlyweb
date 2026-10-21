import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { applicationReadiness, docData, docsData, operationalEligibility, publicOffer } from "@/lib/driver-delivery-server";
import { driverBalanceAccountId, sanitizeDriverBalance } from "@/lib/driver-money-server";
import { plainRide, publicRideOffer } from "@/lib/ride-server";
import { plainParcel, publicParcelOffer } from "@/lib/parcel-server";
import { capabilitySummary, requirementPlan } from "@/lib/driver-capabilities";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    const { db } = getAdminServices();
    const [applicationSnap, driverSnap, vehicleQuery, documentsQuery, presenceSnap, offersQuery, jobsQuery, rideOffersQuery, ridesQuery, parcelOffersQuery, parcelsQuery, earningsQuery, payoutsQuery, incidentsQuery, payoutAccountSnap, usdBalanceSnap, zwgBalanceSnap, settingsSnap] = await Promise.all([
      db.collection("driverApplications").doc(user.uid).get(),
      db.collection("drivers").doc(user.uid).get(),
      db.collection("driverVehicles").where("driverId", "==", user.uid).limit(10).get(),
      db.collection("driverDocuments").where("driverId", "==", user.uid).limit(50).get(),
      db.collection("driverPresence").doc(user.uid).get(),
      db.collection("deliveryOffers").where("driverId", "==", user.uid).where("state", "in", ["offered", "viewed"]).limit(20).get(),
      db.collection("deliveryJobs").where("assignedDriverId", "==", user.uid).limit(100).get(),
      db.collection("rideOffers").where("driverId", "==", user.uid).where("state", "in", ["offered", "viewed"]).limit(20).get(),
      db.collection("rideTrips").where("assignedDriverId", "==", user.uid).limit(100).get(),
      db.collection("parcelOffers").where("driverId", "==", user.uid).where("state", "in", ["offered", "viewed"]).limit(20).get(),
      db.collection("parcelJobs").where("assignedDriverId", "==", user.uid).limit(100).get(),
      db.collection("driverEarningsLedger").where("driverId", "==", user.uid).limit(250).get(),
      db.collection("driverPayouts").where("driverId", "==", user.uid).limit(50).get(),
      db.collection("driverIncidents").where("driverId", "==", user.uid).limit(50).get(),
      db.collection("driverPayoutAccounts").doc(user.uid).get(),
      db.collection("driverBalanceAccounts").doc(driverBalanceAccountId(user.uid, "USD")).get(),
      db.collection("driverBalanceAccounts").doc(driverBalanceAccountId(user.uid, "ZWG")).get(),
      db.collection("platformSettings").doc("global").get()
    ]);
    const application = docData(applicationSnap);
    const driver = docData(driverSnap);
    const vehicles = docsData(vehicleQuery);
    const documents = docsData(documentsQuery);
    const presence = docData(presenceSnap);
    const selectedVehicle = vehicles.find((item) => item.id === (presence?.vehicleId || driver?.selectedVehicleId)) || vehicles.find((item) => item.status === "approved") || vehicles[0] || null;
    const primaryVehicle = vehicles.find((item) => item.id === `${user.uid}_primary`) || null;
    const payoutAccount = payoutAccountSnap.exists ? payoutAccountSnap.data() : null;
    // Match the exact primary-vehicle and payout records used by the submit endpoint.
    const readiness = applicationReadiness(application || {}, primaryVehicle, documents, payoutAccount);
    const requirements = requirementPlan({ application: application || {}, vehicle: primaryVehicle, documents, payoutAccount, phase: driver ? "operational" : "application" });
    const capabilities = capabilitySummary({ driver: driver || {}, application: application || {}, vehicle: selectedVehicle, documents });
    const eligibility = operationalEligibility({ driver, application: application || {}, vehicle: selectedVehicle, documents, presence });
    const locationUpdatedAt = presence?.locationUpdatedAt ? new Date(presence.locationUpdatedAt).getTime() : 0;
    const locationAgeMs = locationUpdatedAt ? Math.max(0, Date.now() - locationUpdatedAt) : null;
    const locationHealth = !presence?.online ? "offline" : !presence?.currentLocation ? "missing" : locationAgeMs == null ? "unknown" : locationAgeMs <= 45_000 ? "good" : locationAgeMs <= 120_000 ? "weak" : "stale";

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
      const parcelSnap = await db.collection("parcelJobs").doc(offer.parcelJobId).get();
      if (!parcelSnap.exists) continue;
      parcelOffers.push(publicParcelOffer({ id: parcelSnap.id, ...parcelSnap.data() }, offer));
    }

    const offers = [];
    for (const offerDoc of offersQuery.docs) {
      const offer = { id: offerDoc.id, ...offerDoc.data() };
      const jobSnap = await db.collection("deliveryJobs").doc(offer.deliveryJobId).get();
      if (!jobSnap.exists) continue;
      const job = { id: jobSnap.id, ...jobSnap.data() };
      if (offer.expiresAt?.toMillis?.() && offer.expiresAt.toMillis() <= Date.now()) continue;
      const [businessSnap, branchSnap] = await Promise.all([
        job.businessId ? db.collection("businesses").doc(job.businessId).get() : null,
        job.branchId ? db.collection("branches").doc(job.branchId).get() : null
      ]);
      offers.push(publicOffer(job, offer, businessSnap?.data?.() || {}, branchSnap?.data?.() || {}));
    }

    return Response.json({
      ok: true,
      application,
      driver,
      vehicles,
      documents,
      presence,
      readiness,
      requirements,
      capabilities,
      eligibility,
      accountHealth: { location: locationHealth, locationAgeMs, dispatchable: Boolean(presence?.online && eligibility.eligible && ["good", "weak"].includes(locationHealth)), payout: payoutAccountSnap.exists ? (payoutAccountSnap.data()?.verificationState || "pending") : "missing", selectedVehicleId: selectedVehicle?.id || null },
      offers,
      rideOffers,
      parcelOffers,
      activeJob,
      activeRide,
      activeParcel,
      jobs,
      rides,
      parcels,
      earnings: docsData(earningsQuery).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))),
      balances: { USD: usdBalanceSnap.exists ? sanitizeDriverBalance(usdBalanceSnap.data()) : null, ZWG: zwgBalanceSnap.exists ? sanitizeDriverBalance(zwgBalanceSnap.data()) : null },
      payoutAccount: payoutAccountSnap.exists ? { ...docData(payoutAccountSnap), identifierEncrypted: undefined } : null,
      payoutPolicy: { minimum: Number(settingsSnap.data()?.commerce?.driverPayoutMinimum ?? settingsSnap.data()?.commerce?.payoutMinimum ?? 20), cadence: settingsSnap.data()?.commerce?.driverPayoutCadence || settingsSnap.data()?.commerce?.payoutCadence || "weekly" },
      payouts: docsData(payoutsQuery).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))),
      incidents: docsData(incidentsQuery).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    });
  } catch (error) {
    return apiError(error);
  }
}

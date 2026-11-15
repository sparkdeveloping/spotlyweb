import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { applicationReadiness, docData, docsData, operationalEligibility } from "@/lib/driver-delivery-server";
import { driverBalanceAccountId, sanitizeDriverBalance } from "@/lib/driver-money-server";
import { capabilitySummary, requirementPlan } from "@/lib/driver-capabilities";
import { driverLiveSnapshot } from "@/lib/driver-live-server";
import { recordCostEvent } from "@/lib/cost-observability-server";

export const runtime = "nodejs";

export async function GET(request) {
  const startedAt = Date.now();
  try {
    const user = await authenticateRequest(request);
    const { db } = getAdminServices();
    const [staticSnapshots, live] = await Promise.all([
      Promise.all([
        db.collection("driverApplications").doc(user.uid).get(),
        db.collection("drivers").doc(user.uid).get(),
        db.collection("driverVehicles").where("driverId", "==", user.uid).limit(10).get(),
        db.collection("driverDocuments").where("driverId", "==", user.uid).limit(50).get(),
        db.collection("driverEarningsLedger").where("driverId", "==", user.uid).limit(250).get(),
        db.collection("driverPayouts").where("driverId", "==", user.uid).limit(50).get(),
        db.collection("driverIncidents").where("driverId", "==", user.uid).limit(50).get(),
        db.collection("driverPayoutAccounts").doc(user.uid).get(),
        db.collection("driverBalanceAccounts").doc(driverBalanceAccountId(user.uid, "USD")).get(),
        db.collection("driverBalanceAccounts").doc(driverBalanceAccountId(user.uid, "ZWG")).get(),
        db.collection("platformSettings").doc("global").get()
      ]),
      driverLiveSnapshot(db, user.uid)
    ]);
    const [applicationSnap, driverSnap, vehicleQuery, documentsQuery, earningsQuery, payoutsQuery, incidentsQuery, payoutAccountSnap, usdBalanceSnap, zwgBalanceSnap, settingsSnap] = staticSnapshots;
    const { presence, offers, rideOffers, parcelOffers, activeJob, activeRide, activeParcel, jobs, rides, parcels, locationHealth, locationAgeMs } = live.data;
    const application = docData(applicationSnap);
    const driver = docData(driverSnap);
    const vehicles = docsData(vehicleQuery);
    const documents = docsData(documentsQuery);
    const selectedVehicle = vehicles.find((item) => item.id === (presence?.vehicleId || driver?.selectedVehicleId)) || vehicles.find((item) => item.status === "approved") || vehicles[0] || null;
    const primaryVehicle = vehicles.find((item) => item.id === `${user.uid}_primary`) || null;
    const payoutAccount = payoutAccountSnap.exists ? payoutAccountSnap.data() : null;
    // Match the exact primary-vehicle and payout records used by the submit endpoint.
    const readiness = applicationReadiness(application || {}, primaryVehicle, documents, payoutAccount);
    const requirements = requirementPlan({ application: application || {}, vehicle: primaryVehicle, documents, payoutAccount, phase: driver ? "operational" : "application" });
    const capabilities = capabilitySummary({ driver: driver || {}, application: application || {}, vehicle: selectedVehicle, documents });
    const eligibility = operationalEligibility({ driver, application: application || {}, vehicle: selectedVehicle, documents, presence });
    const staticReadFloor = staticSnapshots.reduce((sum, snapshot) => sum + (snapshot.docs ? Math.max(1, snapshot.docs.length) : 1), 0);
    recordCostEvent("driver.bootstrap", { durationMs: Date.now() - startedAt, queryCount: 18, estimatedReadFloor: live.estimatedReadFloor + staticReadFloor });
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

import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { applicationReadiness, docData, docsData, operationalEligibility, publicOffer } from "@/lib/driver-delivery-server";
import { driverBalanceAccountId, sanitizeDriverBalance } from "@/lib/driver-money-server";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    const { db } = getAdminServices();
    const [applicationSnap, driverSnap, vehicleQuery, documentsQuery, presenceSnap, offersQuery, jobsQuery, earningsQuery, payoutsQuery, incidentsQuery, payoutAccountSnap, usdBalanceSnap, zwgBalanceSnap, settingsSnap] = await Promise.all([
      db.collection("driverApplications").doc(user.uid).get(),
      db.collection("drivers").doc(user.uid).get(),
      db.collection("driverVehicles").where("driverId", "==", user.uid).limit(10).get(),
      db.collection("driverDocuments").where("driverId", "==", user.uid).limit(50).get(),
      db.collection("driverPresence").doc(user.uid).get(),
      db.collection("deliveryOffers").where("driverId", "==", user.uid).where("state", "in", ["offered", "viewed"]).limit(20).get(),
      db.collection("deliveryJobs").where("assignedDriverId", "==", user.uid).limit(100).get(),
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
    const readiness = applicationReadiness(application || {}, vehicles[0] || null, documents);
    const eligibility = operationalEligibility({ driver, vehicle: vehicles.find((item) => item.status === "approved") || vehicles[0] || null, documents, presence });

    const rawJobs = docsData(jobsQuery).sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
    const activeRaw = rawJobs.find((item) => !["delivered", "failed", "cancelled", "returned"].includes(item.state)) || null;
    const sanitizeJob = (item) => item ? { ...item, pickupCode: undefined, customerPin: undefined } : null;
    const activeJob = sanitizeJob(activeRaw);
    const jobs = rawJobs.map(sanitizeJob);
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
      eligibility,
      offers,
      activeJob,
      jobs,
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

import { setGlobalOptions } from "firebase-functions/v2/options";
import { defineCallable } from "./core/callable.js";
import {
  FOUNDATION_CAPABILITIES,
  SPOTLY_CONTRACT_SHA256,
  SPOTLY_CONTRACT_VERSION,
  SPOTLY_COUNTRY_CONTRACT_SHA256,
  SPOTLY_COUNTRY_CONTRACT_VERSION,
  SPOTLY_SERVICE_AVAILABILITY_CONTRACT_SHA256,
  SPOTLY_SERVICE_AVAILABILITY_CONTRACT_VERSION,
  SPOTLY_FUNCTIONS_REGION,
  SPOTLY_PROJECT_ID
} from "./core/platform.js";
import { spotlyAdmin } from "./core/admin.js";
import { resolveServiceAvailabilitySet } from "./core/service-availability.js";
import { loadOperationGrants, operationContext, operationGrantMatches, requireOperationGrant, serializeGrant } from "./core/operations-grants.js";
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

setGlobalOptions({
  region: SPOTLY_FUNCTIONS_REGION,
  memory: "256MiB",
  timeoutSeconds: 30,
  maxInstances: 50
});

export const platformFoundation = defineCallable({
  auth: "none",
  enforceAppCheck: false,
  handler: async () => ({
    projectId: SPOTLY_PROJECT_ID,
    functionsRegion: SPOTLY_FUNCTIONS_REGION,
    contractVersion: SPOTLY_CONTRACT_VERSION,
    contractSHA256: SPOTLY_CONTRACT_SHA256,
    countryContractVersion: SPOTLY_COUNTRY_CONTRACT_VERSION,
    countryContractSHA256: SPOTLY_COUNTRY_CONTRACT_SHA256,
    serviceAvailabilityContractVersion: SPOTLY_SERVICE_AVAILABILITY_CONTRACT_VERSION,
    serviceAvailabilityContractSHA256: SPOTLY_SERVICE_AVAILABILITY_CONTRACT_SHA256,
    capabilities: FOUNDATION_CAPABILITIES,
    serverTimeMs: Date.now()
  })
});

export const authenticatedFoundation = defineCallable({
  auth: "required",
  enforceAppCheck: false,
  handler: async ({ actor }) => ({
    uid: actor.uid,
    status: actor.profile?.status || "active",
    projectId: SPOTLY_PROJECT_ID,
    contractVersion: SPOTLY_CONTRACT_VERSION
  })
});


export const serviceAvailability = defineCallable({
  auth: "none",
  enforceAppCheck: false,
  handler: async ({ request }) => {
    const country = String(request.data?.country || "").trim().toUpperCase();
    const city = String(request.data?.city || "").trim();
    const { firestore } = spotlyAdmin();
    const snapshot = await firestore.collection("platformSettings").doc("global").get();
    const settings = snapshot.exists ? snapshot.data() || {} : {};
    return { country, city, revision: { id: settings.serviceAvailabilityRevisionId || null, number: Number(settings.serviceAvailabilityRevisionNumber || 0) }, services: resolveServiceAvailabilitySet(settings, { country, city }) };
  }
});


export const operationsContext = defineCallable({
  auth: "required",
  enforceAppCheck: false,
  handler: async ({ request, actor }) => {
    const { firestore } = spotlyAdmin();
    const grants = await loadOperationGrants(firestore, actor.uid);
    const scope = { service: String(request.data?.service || "").trim().toLowerCase(), country: String(request.data?.country || "").trim().toUpperCase(), city: String(request.data?.city || "").trim() };
    return { context: operationContext(grants, scope), grants: grants.map(serializeGrant) };
  }
});

const OPERATIONS_RIDE_NEXT = Object.freeze({ driver_assigned: "driver_to_pickup", driver_to_pickup: "driver_arrived_pickup", driver_arrived_pickup: "in_trip", in_trip: "completed" });
const OPERATIONS_RIDE_END = new Set(["completed", "cancelled"]);
function operationsRideRecord(id, data = {}) { return { id, kind: "ride", operations: true, state: data.state || "", customerId: data.customerId || "", driverId: data.driverId || null, pickup: data.pickup || null, dropoff: data.dropoff || null, serviceType: data.serviceType || "economy", quote: data.quote || null }; }

export const operationsRide = defineCallable({
  auth: "required",
  enforceAppCheck: false,
  handler: async ({ request, actor }) => {
    const action = String(request.data?.action || "list");
    const { firestore } = spotlyAdmin();
    const grants = await loadOperationGrants(firestore, actor.uid);
    if (action === "list") {
      const canRequest = grants.some((grant) => operationGrantMatches(grant, { type: "service_operations", service: "ride" }));
      const canDrive = grants.some((grant) => operationGrantMatches(grant, { type: "driver_operations", service: "ride" }));
      if (!canRequest && !canDrive) return { allowed: false, canRequest: false, canDrive: false, myRuns: [], offers: [] };
      const snapshot = await firestore.collection("operationsRuns").orderBy("updatedAt", "desc").limit(100).get();
      const rows = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })).filter((row) => row.kind === "ride");
      return { allowed: true, canRequest, canDrive, myRuns: rows.filter((row) => row.customerId === actor.uid || row.driverId === actor.uid).slice(0, 20).map((row) => operationsRideRecord(row.id, row)), offers: canDrive ? rows.filter((row) => row.state === "searching_driver" && row.customerId !== actor.uid && grants.some((grant) => operationGrantMatches(grant, { type: "driver_operations", service: "ride", country: row.pickup?.country, city: row.pickup?.city }))).slice(0, 20).map((row) => operationsRideRecord(row.id, row)) : [] };
    }
    const runId = String(request.data?.runId || "").trim();
    if (!runId) throw new HttpsError("invalid-argument", "Choose an Operations Ride run.");
    const ref = firestore.collection("operationsRuns").doc(runId); let state = "";
    await firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists || snapshot.data()?.kind !== "ride") throw new HttpsError("not-found", "This Operations Ride no longer exists.");
      const data = snapshot.data();
      if (OPERATIONS_RIDE_END.has(data.state)) throw new HttpsError("failed-precondition", "This Operations Ride is already finished.");
      if (action === "accept") { requireOperationGrant(grants, { type: "driver_operations", service: "ride", country: data.pickup?.country, city: data.pickup?.city }); if (data.customerId === actor.uid) throw new HttpsError("permission-denied", "Use another granted account as the Operations Driver."); if (data.state !== "searching_driver" || data.driverId) throw new HttpsError("aborted", "Another Operations Driver already accepted this run."); state = "driver_assigned"; transaction.update(ref, { state, driverId: actor.uid, acceptedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }); return; }
      if (action === "advance") { requireOperationGrant(grants, { type: "driver_operations", service: "ride", country: data.pickup?.country, city: data.pickup?.city }); if (data.driverId !== actor.uid || !OPERATIONS_RIDE_NEXT[data.state]) throw new HttpsError("permission-denied", "This Operations state cannot be advanced by your account."); state = OPERATIONS_RIDE_NEXT[data.state]; transaction.update(ref, { state, updatedAt: FieldValue.serverTimestamp() }); return; }
      if (action === "cancel") { if (data.customerId !== actor.uid && data.driverId !== actor.uid) throw new HttpsError("permission-denied", "Only participants can cancel this Operations run."); state = "cancelled"; transaction.update(ref, { state, updatedAt: FieldValue.serverTimestamp() }); return; }
      throw new HttpsError("invalid-argument", "Unsupported Operations Ride action.");
    });
    return { runId, state, operations: true };
  }
});

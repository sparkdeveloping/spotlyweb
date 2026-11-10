import { setGlobalOptions } from "firebase-functions/v2/options";
import { defineCallable, defineTrustedMutation } from "./core/callable.js";
import {
  FOUNDATION_CAPABILITIES,
  SPOTLY_CONTRACT_SHA256,
  SPOTLY_CONTRACT_VERSION,
  SPOTLY_CUSTOMER_RUNTIME_CONTRACT_SHA256,
  SPOTLY_CUSTOMER_RUNTIME_CONTRACT_VERSION,
  SPOTLY_COUNTRY_CONTRACT_SHA256,
  SPOTLY_COUNTRY_CONTRACT_VERSION,
  SPOTLY_SERVICE_AVAILABILITY_CONTRACT_SHA256,
  SPOTLY_SERVICE_AVAILABILITY_CONTRACT_VERSION,
  SPOTLY_FUNCTIONS_REGION,
  SPOTLY_MEDIA_DISCOVERY_CONTRACT_SHA256,
  SPOTLY_MEDIA_DISCOVERY_CONTRACT_VERSION,
  SPOTLY_PROJECT_ID
} from "./core/platform.js";
import { spotlyAdmin } from "./core/admin.js";
import { resolveServiceAvailabilitySet } from "./core/service-availability.js";
import { loadOperationGrants, operationContext, operationGrantMatches, requireOperationGrant, serializeGrant } from "./core/operations-grants.js";
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { customerRuntimeSnapshot, rideQuote, sendQuote } from "./core/customer-runtime.js";
import { searchCustomerPlaces } from "./core/customer-place-search.js";
import { queryDiscoveryProjection } from "./core/discovery-projection.js";
import { notifyLiveEventUpdate, runBookLiveReminders } from "./core/book-live-notifications.js";
import { driverBootstrapData, updateDriverApplication, registerDriverDocument, submitDriverApplication, driverRealtimeSession as setDriverRealtimeSession, registerDriverPushToken, registerDriverWorkProof, driverOfferAction as runDriverOfferAction, driverWorkAction as runDriverWorkAction, createDriverIncident, markDriverNotificationRead } from "./core/driver-runtime.js";
import { sweepDriverLocationRetention, sweepSecurityRetention } from "./core/retention.js";

setGlobalOptions({
  region: SPOTLY_FUNCTIONS_REGION,
  memory: "256MiB",
  timeoutSeconds: 30,
  // europe-west1 currently allows 20 vCPU of regional Cloud Run capacity.
  // Keep new functions conservatively scaled until quota/traffic is verified.
  maxInstances: 2
});

const DRIVER_RIDE_PIN_KEY = defineSecret("SPOTLY_RIDE_PIN_KEY");
const DRIVER_SEND_PIN_KEY = defineSecret("SPOTLY_SEND_PIN_KEY");
const CUSTOMER_PLACE_SEARCH_KEY = defineSecret("SPOTLY_MAPTILER_GEOCODING_KEY");

export const platformFoundation = defineCallable({
  name: "platformFoundation",
  auth: "none",
  enforceAppCheck: false,
  rateLimit: { limit: 120, windowMs: 60_000 },
  handler: async () => ({
    projectId: SPOTLY_PROJECT_ID,
    functionsRegion: SPOTLY_FUNCTIONS_REGION,
    contractVersion: SPOTLY_CONTRACT_VERSION,
    contractSHA256: SPOTLY_CONTRACT_SHA256,
    countryContractVersion: SPOTLY_COUNTRY_CONTRACT_VERSION,
    countryContractSHA256: SPOTLY_COUNTRY_CONTRACT_SHA256,
    serviceAvailabilityContractVersion: SPOTLY_SERVICE_AVAILABILITY_CONTRACT_VERSION,
    serviceAvailabilityContractSHA256: SPOTLY_SERVICE_AVAILABILITY_CONTRACT_SHA256,
    customerRuntimeContractVersion: SPOTLY_CUSTOMER_RUNTIME_CONTRACT_VERSION,
    customerRuntimeContractSHA256: SPOTLY_CUSTOMER_RUNTIME_CONTRACT_SHA256,
    mediaDiscoveryContractVersion: SPOTLY_MEDIA_DISCOVERY_CONTRACT_VERSION,
    mediaDiscoveryContractSHA256: SPOTLY_MEDIA_DISCOVERY_CONTRACT_SHA256,
    capabilities: FOUNDATION_CAPABILITIES,
    serverTimeMs: Date.now()
  })
});

export const authenticatedFoundation = defineCallable({
  name: "authenticatedFoundation",
  auth: "required",
  enforceAppCheck: true,
  rateLimit: { limit: 60, windowMs: 60_000 },
  handler: async ({ actor }) => ({
    uid: actor.uid,
    status: actor.profile?.status || "active",
    projectId: SPOTLY_PROJECT_ID,
    contractVersion: SPOTLY_CONTRACT_VERSION
  })
});


export const serviceAvailability = defineCallable({
  name: "serviceAvailability",
  auth: "none",
  enforceAppCheck: true,
  rateLimit: { limit: 180, windowMs: 60_000 },
  handler: async ({ request }) => {
    const country = String(request.data?.country || "").trim().toUpperCase();
    const city = String(request.data?.city || "").trim();
    const { firestore } = spotlyAdmin();
    const snapshot = await firestore.collection("platformSettings").doc("global").get();
    const settings = snapshot.exists ? snapshot.data() || {} : {};
    return { country, city, revision: { id: settings.serviceAvailabilityRevisionId || null, number: Number(settings.serviceAvailabilityRevisionNumber || 0) }, services: resolveServiceAvailabilitySet(settings, { country, city }) };
  }
});


export const customerRuntime = defineCallable({
  name: "customerRuntime",
  auth: "optional",
  enforceAppCheck: true,
  rateLimit: { limit: 120, windowMs: 60_000 },
  handler: async ({ request, actor }) => {
    const { firestore } = spotlyAdmin();
    return customerRuntimeSnapshot({ firestore, actor, requestedCountry: request.data?.country, requestedCity: request.data?.city });
  }
});

export const customerRideQuote = defineCallable({
  name: "customerRideQuote",
  auth: "optional",
  enforceAppCheck: true,
  rateLimit: { limit: 60, windowMs: 60_000 },
  handler: async ({ request, actor }) => rideQuote({ firestore: spotlyAdmin().firestore, data: request.data || {}, actor })
});

export const customerSendQuote = defineCallable({
  name: "customerSendQuote",
  auth: "optional",
  enforceAppCheck: true,
  rateLimit: { limit: 60, windowMs: 60_000 },
  handler: async ({ request, actor }) => sendQuote({ firestore: spotlyAdmin().firestore, data: request.data || {}, actor })
});

// Dedicated licensed place/POI search for native Ride, Send and address flows.
// Authentication is optional for early destination discovery; App Check and
// per-identity rate limits are enforced by the shared callable wrapper.
export const customerPlaceSearch = defineCallable({
  name: "customerPlaceSearch",
  auth: "optional",
  enforceAppCheck: true,
  rateLimit: { limit: 45, windowMs: 60_000 },
  options: { secrets: [CUSTOMER_PLACE_SEARCH_KEY] },
  handler: async ({ request }) => searchCustomerPlaces({ data: request.data || {} })
});

export const customerDiscovery = defineCallable({
  name: "customerDiscovery",
  auth: "optional",
  enforceAppCheck: true,
  rateLimit: { limit: 180, windowMs: 60_000 },
  handler: async ({ request }) => {
    const data=request.data||{}, mode=String(data.mode||"search"), country=String(data.country||"").trim().toUpperCase(), city=String(data.city||"").trim(), service=String(data.service||"").trim().toLowerCase();
    if(!country && mode!=="business") return { ok:true, results:[], businesses:[], items:[], total:0, totalBusinesses:0, totalItems:0, requiresLocation:true };
    const {firestore}=spotlyAdmin(); const snapshot=await firestore.collection("platformSettings").doc("global").get(); const settings=snapshot.exists?snapshot.data()||{}:{};
    if(service){const decision=resolveServiceAvailabilitySet(settings,{country,city}).find(row=>row.service===service);if(!decision?.discoverable)return {ok:true,results:[],businesses:[],items:[],total:0,totalBusinesses:0,totalItems:0,country,city,service,availability:decision||null};}
    return queryDiscoveryProjection({mode,country,city,service,q:data.q||"",category:data.category||"",type:data.type||"",businessId:data.businessId||"",offset:data.offset||0,limit:data.limit||24});
  }
});

export const operationsContext = defineCallable({
  name: "operationsContext",
  auth: "required",
  enforceAppCheck: true,
  rateLimit: { limit: 60, windowMs: 60_000 },
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
  name: "operationsRide",
  auth: "required",
  enforceAppCheck: true,
  rateLimit: { limit: 60, windowMs: 60_000 },
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


export const bookLiveReminders = onSchedule({ schedule: "every 15 minutes", timeZone: "UTC", region: SPOTLY_FUNCTIONS_REGION, retryCount: 1 }, async () => {
  await runBookLiveReminders();
});

export const liveEventUpdates = onDocumentUpdated({ document: "products/{productId}", region: SPOTLY_FUNCTIONS_REGION, retry: false }, async (event) => {
  const before = event.data?.before?.data?.() || {};
  const after = event.data?.after?.data?.() || {};
  await notifyLiveEventUpdate({ productId: event.params.productId, before, after });
});

export const driverLocationRetentionSweep = onSchedule({ schedule: "every 15 minutes", timeZone: "UTC", region: SPOTLY_FUNCTIONS_REGION, retryCount: 1 }, async () => {
  await sweepDriverLocationRetention();
});

export const securityRetentionSweep = onSchedule({ schedule: "every 24 hours", timeZone: "UTC", region: SPOTLY_FUNCTIONS_REGION, retryCount: 1 }, async () => {
  await sweepSecurityRetention();
});


export const driverBootstrap = defineCallable({
  name: "driverBootstrap",
  auth: "required",
  enforceAppCheck: true,
  rateLimit: { limit: 60, windowMs: 60_000 },
  handler: async ({ actor }) => driverBootstrapData(actor)
});

export const driverApplicationSave = defineTrustedMutation({
  name: "driverApplicationSave",
  handler: async ({ actor, request }) => updateDriverApplication(actor, request.data || {})
});

export const driverDocumentRegister = defineTrustedMutation({
  name: "driverDocumentRegister",
  handler: async ({ actor, request }) => registerDriverDocument(actor, request.data || {})
});

export const driverApplicationSubmit = defineTrustedMutation({
  name: "driverApplicationSubmit",
  rateLimit: { limit: 10, windowMs: 60_000 },
  handler: async ({ actor }) => submitDriverApplication(actor)
});

export const driverRealtimeSession = defineTrustedMutation({
  name: "driverRealtimeSession",
  handler: async ({ actor, request }) => setDriverRealtimeSession(actor, request.data || {})
});

export const driverRegisterPushToken = defineCallable({
  name: "driverRegisterPushToken",
  auth: "required",
  enforceAppCheck: true,
  rateLimit: { limit: 20, windowMs: 60_000 },
  handler: async ({ actor, request }) => registerDriverPushToken(actor, request.data || {})
});

export const driverWorkProofRegister = defineTrustedMutation({
  name: "driverWorkProofRegister",
  handler: async ({ actor, request }) => registerDriverWorkProof(actor, request.data || {})
});

export const driverOfferAction = defineTrustedMutation({
  name: "driverOfferAction",
  rateLimit: { limit: 90, windowMs: 60_000 },
  handler: async ({ actor, request }) => runDriverOfferAction(actor, request.data || {})
});

export const driverWorkAction = defineTrustedMutation({
  name: "driverWorkAction",
  rateLimit: { limit: 90, windowMs: 60_000 },
  options: { secrets: [DRIVER_RIDE_PIN_KEY, DRIVER_SEND_PIN_KEY] },
  handler: async ({ actor, request }) => runDriverWorkAction(actor, request.data || {})
});

export const driverIncidentCreate = defineTrustedMutation({
  name: "driverIncidentCreate",
  rateLimit: { limit: 12, windowMs: 60_000 },
  handler: async ({ actor, request }) => createDriverIncident(actor, request.data || {})
});

export const driverNotificationRead = defineCallable({
  name: "driverNotificationRead",
  auth: "required",
  enforceAppCheck: true,
  rateLimit: { limit: 120, windowMs: 60_000 },
  handler: async ({ actor, request }) => markDriverNotificationRead(actor, request.data || {})
});

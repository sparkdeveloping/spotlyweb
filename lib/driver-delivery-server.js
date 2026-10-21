import "server-only";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { safeText, toPlainTimestamp } from "@/lib/server-helpers";
import { notifyUsers as notifyOperationalUsers } from "@/lib/notification-server";
import { capabilityForWorkType, capabilityRequirements, capabilitySummary, normalizeCapabilities, requirementPlan, storedCapabilityStatus } from "@/lib/driver-capabilities";

export const DRIVER_APPLICATION_STATES = Object.freeze([
  "application_started", "application_submitted", "under_review", "information_required", "rejected", "approved", "ready", "active", "temporarily_unavailable", "suspended", "offboarded"
]);

export const DELIVERY_STATES = Object.freeze([
  "awaiting_dispatch", "searching_driver", "driver_assigned", "driver_to_pickup", "driver_arrived_pickup", "shopping", "shopping_review", "pickup_verification", "collected", "en_route", "driver_arrived_customer", "handoff_verification", "delivered", "failed", "cancelled", "returned"
]);

export const DELIVERY_TRANSITIONS = Object.freeze({
  awaiting_dispatch: ["searching_driver", "cancelled"],
  searching_driver: ["driver_assigned", "failed", "cancelled"],
  driver_assigned: ["driver_to_pickup", "searching_driver", "cancelled"],
  driver_to_pickup: ["driver_arrived_pickup", "failed", "cancelled"],
  driver_arrived_pickup: ["shopping", "pickup_verification", "failed", "cancelled"],
  shopping: ["shopping_review", "failed", "cancelled"],
  shopping_review: ["collected", "shopping", "failed", "cancelled"],
  pickup_verification: ["collected", "failed", "cancelled"],
  collected: ["en_route", "failed", "returned"],
  en_route: ["driver_arrived_customer", "failed", "returned"],
  driver_arrived_customer: ["handoff_verification", "failed", "returned"],
  handoff_verification: ["delivered", "failed", "returned"],
  delivered: [], failed: [], cancelled: [], returned: []
});

const DRIVER_TRANSITIONS = new Set([
  "driver_assigned:driver_to_pickup",
  "driver_to_pickup:driver_arrived_pickup",
  "driver_arrived_pickup:pickup_verification",
  "driver_arrived_pickup:shopping",
  "shopping:shopping_review",
  "shopping_review:collected",
  "pickup_verification:collected",
  "collected:en_route",
  "en_route:driver_arrived_customer",
  "driver_arrived_customer:handoff_verification",
  "handoff_verification:delivered"
]);

export function deliveryTransitionAllowed(current, next) {
  return current === next || DELIVERY_TRANSITIONS[current]?.includes(next) === true;
}

export function driverMayTransition(current, next) {
  return DRIVER_TRANSITIONS.has(`${current}:${next}`);
}

export function plain(value) {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(plain);
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plain(item)]));
  return value;
}

export function docData(snapshot) {
  return snapshot?.exists ? { id: snapshot.id, ...plain(snapshot.data()) } : null;
}

export function docsData(snapshot) {
  return snapshot.docs.map((item) => ({ id: item.id, ...plain(item.data()) }));
}

export function applicationReadiness(application = {}, vehicle = null, documents = [], payoutAccount = undefined) {
  const plan = requirementPlan({ application, vehicle, documents, payoutAccount, phase: "application" });
  return { ...plan, checks: plan.checks, complete: plan.complete };
}

export function operationalEligibility({ driver, application = {}, vehicle, documents = [], presence = null, capability = null, requiredVehicleTypes = [] }) {
  const requestedCapabilities = normalizeCapabilities(application?.requestedCapabilities || driver?.requestedCapabilities || [], vehicle?.type || "");
  const capabilityId = capability || null;
  const lifecycleOk = ["approved", "ready", "active"].includes(driver?.status) && !["suspended", "offboarded"].includes(driver?.status);
  const checks = [
    { id: "approved", label: "Driver account active", ok: lifecycleOk },
    { id: "vehicle", label: "Current vehicle approved", ok: vehicle?.status === "approved" },
    { id: "vehicle_type", label: "Vehicle matches this work", ok: !requiredVehicleTypes.length || requiredVehicleTypes.includes(vehicle?.type) },
    { id: "compliance", label: "No compliance hold", ok: !driver?.complianceHold },
    { id: "safety", label: "No safety hold", ok: !driver?.safetyHold },
    { id: "job", label: "No conflicting active work", ok: !presence?.currentJobId }
  ];
  if (capabilityId) {
    const capabilityStatus = storedCapabilityStatus(driver || {}, capabilityId, { vehicleType: vehicle?.type || "", requestedCapabilities });
    const requirements = capabilityRequirements({ capabilityId, vehicleType: vehicle?.type || "", vehicleId: vehicle?.id || "", documents, application, phase: "operational" });
    checks.push({ id: `capability_${capabilityId}`, label: `${capabilityId.replaceAll("_", " ")} active`, ok: capabilityStatus === "active" });
    checks.push({ id: `session_${capabilityId}`, label: `${capabilityId.replaceAll("_", " ")} enabled for this session`, ok: !Array.isArray(presence?.enabledCapabilities) || presence.enabledCapabilities.length === 0 || presence.enabledCapabilities.includes(capabilityId) });
    checks.push(...requirements.checks.map((item) => ({ ...item, id: `${capabilityId}_${item.id}` })));
  } else {
    const summaries = capabilitySummary({ driver: driver || {}, application, vehicle, documents });
    checks.push({ id: "capability", label: "At least one work type active", ok: summaries.some((item) => item.ready) || (!driver?.capabilities && lifecycleOk) });
  }
  return { eligible: checks.every((item) => item.ok), checks, capability: capabilityId, requestedCapabilities };
}

export function workCapability(workType, fulfilmentMode = "") {
  return capabilityForWorkType(workType, fulfilmentMode);
}

export function makeDeliveryNumber() {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `DL-${stamp}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

export function makeCode(length = 4) {
  const min = 10 ** (length - 1);
  return String(Math.floor(min + Math.random() * 9 * min));
}

export function haversineKm(a, b) {
  if (![a?.lat, a?.lng, b?.lat, b?.lng].every((value) => Number.isFinite(Number(value)))) return Number.POSITIVE_INFINITY;
  const radians = (value) => Number(value) * Math.PI / 180;
  const dLat = radians(Number(b.lat) - Number(a.lat));
  const dLng = radians(Number(b.lng) - Number(a.lng));
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export async function appendDeliveryEvent(transaction, db, { jobId, orderId, type, actorType, actorId, previousState = null, state = null, note = "", metadata = {} }) {
  transaction.create(db.collection("deliveryEvents").doc(), {
    deliveryJobId: jobId,
    orderId: orderId || null,
    type,
    actorType,
    actorId: actorId || null,
    previousState,
    state,
    note: safeText(note, 800),
    metadata,
    createdAt: FieldValue.serverTimestamp()
  });
}

export async function appendAudit(transaction, db, { actorId, action, entityType, entityId, reason = "", metadata = {} }) {
  transaction.create(db.collection("auditLogs").doc(), {
    actorId: actorId || "system",
    action,
    entityType,
    entityId,
    reason: safeText(reason, 800),
    metadata,
    source: "delivery_network",
    createdAt: FieldValue.serverTimestamp()
  });
}

export async function notifyUsers(db, messaging, userIds, { title, body, href, category = "delivery", workspace = "", module = "delivery", eventType = "", importance = "normal", businessId = null, entityType = null, entityId = null, email = false, auth = null, forceOperationalEmail = false }) {
  const resolvedWorkspace = workspace || (String(category).startsWith("driver") ? "driver" : "customer");
  return notifyOperationalUsers({ db, messaging, auth, title, body, href, category, workspace: resolvedWorkspace, module, eventType: eventType || category, importance, businessId, entityType, entityId, email, forceOperationalEmail }, userIds);
}

export function normalizeLocation(value = {}) {
  const lat = Number(value.lat);
  const lng = Number(value.lng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) return null;
  return { lat, lng, accuracy: Number.isFinite(Number(value.accuracy)) ? Math.max(0, Number(value.accuracy)) : null };
}

export function publicOffer(job = {}, offer = {}, business = {}, branch = {}) {
  const shop = job.fulfilmentMode === "driver_shops";
  const workType = shop ? "shop_and_deliver" : "prepared_delivery";
  return {
    id: offer.id,
    deliveryJobId: job.id,
    number: job.number,
    state: offer.state,
    expiresAt: toPlainTimestamp(offer.expiresAt),
    pay: Number(offer.pay ?? job.quotedDriverPay ?? 0),
    currency: job.currency || "USD",
    workType,
    workLabel: shop ? "Shop & Deliver" : "Prepared delivery",
    fulfilmentMode: job.fulfilmentMode || "merchant_prepared",
    pickup: {
      name: business.name || branch.name || (shop ? "Store" : "Pickup"),
      area: branch.area || branch.suburb || branch.city || job.pickup?.area || "Pickup area"
    },
    dropoff: { area: job.dropoff?.suburb || job.dropoff?.area || job.dropoff?.city || "Delivery area" },
    pickupDistanceKm: Number(offer.distanceKm || 0),
    workDistanceKm: Number(offer.workDistanceKm ?? job.deliveryDistanceKm ?? 0),
    expectedMinutes: Number(offer.expectedMinutes || 0),
    preparationMinutes: Number(job.businessPreparationMinutes || 0),
    shoppingMinutes: Number(job.shoppingMinutes || 0),
    itemCount: Array.isArray(job.shopping?.items) ? job.shopping.items.reduce((sum, item) => sum + Number(item.requestedQuantity || 0), 0) : 0,
    bagCount: Number(job.bagCount || 1),
    handlingProfile: job.operatingProfile || null,
    vehicleRequirement: job.requiredVehicleTypes || []
  };
}

export async function dispatchDelivery({ db, messaging, deliveryJobId, actorId = "system", maxCandidates = 3, offerSeconds = 90 }) {
  const jobRef = db.collection("deliveryJobs").doc(deliveryJobId);
  const jobSnap = await jobRef.get();
  if (!jobSnap.exists) throw Object.assign(new Error("The delivery was not found."), { status: 404 });
  const job = { id: jobSnap.id, ...jobSnap.data() };
  if (job.assignedDriverId || ["delivered", "cancelled", "failed", "returned"].includes(job.state)) return { assigned: Boolean(job.assignedDriverId), offered: 0 };
  const settingsSnap = await db.collection("platformSettings").doc("global").get();
  const commerce = settingsSnap.data()?.commerce || {};
  const maxPickupKm = Number(commerce.driverDeliveryMaxPickupKm || 15);
  const averageSpeedKph = Math.max(8, Number(commerce.driverDeliveryAverageSpeedKph || 28));
  const offerWindowSeconds = Math.max(30, Number(commerce.driverDeliveryOfferSeconds || offerSeconds || 90));
  const workCapabilityId = capabilityForWorkType("delivery", job.fulfilmentMode || "merchant_prepared");

  // Re-dispatch is safe: expire old offers, preserve still-live offers, and avoid repeatedly
  // offering the same delivery to Drivers who already declined/expired it.
  const priorOffersSnap = await db.collection("deliveryOffers").where("deliveryJobId", "==", deliveryJobId).limit(100).get();
  const attemptedDriverIds = new Set();
  const liveOffers = [];
  const expiryBatch = db.batch();
  let hasExpiryWrites = false;
  for (const offerDoc of priorOffersSnap.docs) {
    const offer = offerDoc.data();
    attemptedDriverIds.add(offer.driverId);
    const expired = offer.expiresAt?.toMillis?.() ? offer.expiresAt.toMillis() <= Date.now() : false;
    if (["offered", "viewed"].includes(offer.state) && expired) {
      expiryBatch.set(offerDoc.ref, { state: "expired", expiredAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      hasExpiryWrites = true;
    } else if (["offered", "viewed"].includes(offer.state) && !expired) {
      liveOffers.push({ id: offerDoc.id, ...offer });
    }
  }
  if (hasExpiryWrites) await expiryBatch.commit();
  if (liveOffers.length) return { offered: liveOffers.length, candidates: liveOffers.length, existingOffers: true, offerIds: liveOffers.map((item) => item.id) };

  const presenceSnap = await db.collection("driverPresence").where("online", "==", true).limit(100).get();
  const candidates = [];
  for (const presenceDoc of presenceSnap.docs) {
    if (attemptedDriverIds.has(presenceDoc.id)) continue;
    const presence = presenceDoc.data();
    if (presence.currentJobId || !presence.currentLocation) continue;
    if (presence.locationUpdatedAt?.toMillis?.() && Date.now() - presence.locationUpdatedAt.toMillis() > 120000) continue;
    const [driverSnap, vehicleQuery, docsQuery] = await Promise.all([
      db.collection("drivers").doc(presenceDoc.id).get(),
      db.collection("driverVehicles").where("driverId", "==", presenceDoc.id).limit(10).get(),
      db.collection("driverDocuments").where("driverId", "==", presenceDoc.id).limit(30).get()
    ]);
    if (!driverSnap.exists) continue;
    const driver = driverSnap.data();
    const vehicles = vehicleQuery.docs.map((item) => ({ id: item.id, ...item.data() }));
    const vehicle = vehicles.find((item) => item.id === presence.vehicleId && item.status === "approved") || vehicles.find((item) => item.status === "approved") || null;
    const documents = docsQuery.docs.map((item) => ({ id: item.id, ...item.data() }));
    const appSnap = await db.collection("driverApplications").doc(presenceDoc.id).get();
    const application = appSnap.exists ? appSnap.data() : {};
    const eligibility = operationalEligibility({ driver, application, vehicle, documents, presence, capability: workCapabilityId, requiredVehicleTypes: job.requiredVehicleTypes || [] });
    if (!eligibility.eligible) continue;
    if (job.dispatchZoneIds?.length && driver.zoneIds?.length && !driver.zoneIds.some((zone) => job.dispatchZoneIds.includes(zone))) continue;
    const distanceKm = haversineKm(presence.currentLocation, job.pickup);
    if (!Number.isFinite(distanceKm) || distanceKm > maxPickupKm) continue;
    const workDistanceKm = Number.isFinite(Number(job.deliveryDistanceKm)) ? Number(job.deliveryDistanceKm) : haversineKm(job.pickup, job.dropoff);
    const positioningMinutes = Math.max(2, Math.round((distanceKm / averageSpeedKph) * 60));
    const routeMinutes = Number.isFinite(workDistanceKm) ? Math.max(3, Math.round((workDistanceKm / averageSpeedKph) * 60)) : 10;
    const serviceMinutes = job.fulfilmentMode === "driver_shops" ? Math.max(5, Number(job.shoppingMinutes || 20)) : Math.max(0, Number(job.businessPreparationMinutes || 0));
    const expectedMinutes = Math.max(5, positioningMinutes + serviceMinutes + routeMinutes + 3);
    candidates.push({ driverId: presenceDoc.id, distanceKm, workDistanceKm: Number.isFinite(workDistanceKm) ? workDistanceKm : 0, expectedMinutes, vehicleId: vehicle?.id || null });
  }
  candidates.sort((a, b) => a.distanceKm - b.distanceKm);
  const selected = candidates.slice(0, maxCandidates);
  if (!selected.length) {
    await jobRef.set({ state: "searching_driver", dispatchAttemptedAt: FieldValue.serverTimestamp(), exceptionCode: "no_driver_found", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await db.collection("adminQueueItems").doc(`delivery_unassigned_${deliveryJobId}`).set({ queue: "delivery-exceptions", type: "no_driver_found", entityId: deliveryJobId, deliveryJobId, status: "open", priority: "high", title: `${job.number || deliveryJobId} · No Driver found`, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { offered: 0, candidates: 0 };
  }
  const expiresAt = Timestamp.fromMillis(Date.now() + offerWindowSeconds * 1000);
  const batch = db.batch();
  const offerIds = [];
  for (const candidate of selected) {
    const offerRef = db.collection("deliveryOffers").doc();
    offerIds.push(offerRef.id);
    batch.create(offerRef, {
      deliveryJobId, driverId: candidate.driverId, state: "offered", pay: Number(job.quotedDriverPay || 0), distanceKm: Number(candidate.distanceKm.toFixed(1)),
      workDistanceKm: Number(candidate.workDistanceKm.toFixed(1)), expectedMinutes: candidate.expectedMinutes, workCapability: workCapabilityId, vehicleId: candidate.vehicleId, expiresAt, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
    });
  }
  batch.set(jobRef, { state: "searching_driver", dispatchAttemptedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), exceptionCode: null }, { merge: true });
  await batch.commit();
  await Promise.all(selected.map((candidate) => notifyUsers(db, messaging, [candidate.driverId], {
    title: "Delivery available",
    body: `${job.currency || "USD"} ${Number(job.quotedDriverPay || 0).toFixed(2)} · ${job.pickup?.area || "Pickup"} → ${job.dropoff?.suburb || job.dropoff?.area || "Delivery area"}`,
    href: "/jobs",
    category: "driver_offer"
  })));
  await db.collection("auditLogs").add({ actorId, action: "delivery.dispatch.offers_created", entityType: "deliveryJob", entityId: deliveryJobId, metadata: { driverIds: selected.map((item) => item.driverId), offerIds }, source: "delivery_network", createdAt: FieldValue.serverTimestamp() });
  return { offered: selected.length, candidates: candidates.length, offerIds };
}


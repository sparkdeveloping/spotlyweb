import "server-only";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { haversineKm, normalizeLocation, notifyUsers, operationalEligibility } from "@/lib/driver-delivery-server";
import { safeText, toPlainTimestamp } from "@/lib/server-helpers";
import {revealParcelPin,newParcelPin} from "@/lib/send-security";
import {insideCountryBounds} from "@/lib/ride-geography";

export const PARCEL_STATES = Object.freeze([
  "requested", "scheduled", "awaiting_payment", "searching_driver", "driver_assigned", "driver_to_pickup", "driver_arrived_pickup",
  "pickup_verification", "collected", "en_route", "driver_arrived_dropoff", "handoff_verification", "handoff_exception", "return_in_progress", "delivered", "cancelled", "failed", "returned"
]);

export const PARCEL_TRANSITIONS = Object.freeze({
  requested: ["scheduled", "awaiting_payment", "searching_driver", "cancelled"],
  scheduled: ["searching_driver", "cancelled", "failed"],
  awaiting_payment: ["searching_driver", "cancelled", "failed"],
  searching_driver: ["driver_assigned", "cancelled", "failed"],
  driver_assigned: ["driver_to_pickup", "searching_driver", "cancelled"],
  driver_to_pickup: ["driver_arrived_pickup", "cancelled", "failed"],
  driver_arrived_pickup: ["pickup_verification", "cancelled", "failed"],
  pickup_verification: ["collected", "cancelled", "failed"],
  collected: ["en_route", "failed", "returned"],
  en_route: ["driver_arrived_dropoff", "failed", "returned"],
  driver_arrived_dropoff: ["handoff_verification", "failed", "returned"],
  handoff_verification: ["delivered", "handoff_exception","failed", "returned"],
  handoff_exception: ["return_in_progress","delivered","failed"],
  return_in_progress:["returned","failed"],
  delivered: [], cancelled: [], failed: [], returned: []
});

export const DRIVER_PARCEL_TRANSITIONS = Object.freeze({
  start_to_pickup: ["driver_assigned", "driver_to_pickup"],
  arrive_pickup: ["driver_to_pickup", "driver_arrived_pickup"],
  begin_pickup_verification: ["driver_arrived_pickup", "pickup_verification"],
  verify_pickup: ["pickup_verification", "collected"],
  start_delivery: ["collected", "en_route"],
  arrive_dropoff: ["en_route", "driver_arrived_dropoff"],
  begin_handoff: ["driver_arrived_dropoff", "handoff_verification"],
  complete: ["handoff_verification", "delivered"],
  report_handoff_problem:["handoff_verification","handoff_exception"],
  confirm_return:["return_in_progress","returned"]
});

export const DEFAULT_PARCEL_PRICING = Object.freeze({
  currency: "USD",
  baseFare: 2,
  perKm: 0.55,
  bookingFee: 0.25,
  minimumFare: 3.5,
  roadDistanceFactor: 1.22,
  averageSpeedKph: 28,
  driverSharePercent: 80,
  maxPickupKm: 15,
  offerSeconds: 90,
  proofPhotoRequired: false,
  parcelSizes: {
    small: { label: "Small", multiplier: 0.9, maxKg: 5, vehicleTypes: ["bicycle", "motorcycle", "car", "van"] },
    medium: { label: "Medium", multiplier: 1, maxKg: 15, vehicleTypes: ["motorcycle", "car", "van"] },
    large: { label: "Large", multiplier: 1.25, maxKg: 35, vehicleTypes: ["car", "van"] },
    bulky: { label: "Bulky", multiplier: 1.6, maxKg: 80, vehicleTypes: ["van"] }
  }
});

export function parcelSettings(settings = {}) {
  const mobility = settings.mobility || {};
  const send = mobility.send || {};
  const pricing = send.pricing || {};
  const defaults = DEFAULT_PARCEL_PRICING;
  const configuredSizes = pricing.parcelSizes || {};
  const cashEnabled = send.cashEnabled !== false;
  const scheduledEnabled = send.scheduledEnabled !== false;
  const paynowEnabled = settings.integrations?.paynowEnabled === true && (settings.commerce?.paymentMethods || []).includes("paynow");
  return {
    enabled: send.enabled === true, // explicit Send-specific launch approval only
    dispatchSchedulerVerified: send.dispatchSchedulerVerified===true,
    routingVerified:send.routingVerified===true,
    cityGeofences:send.cityGeofences&&typeof send.cityGeofences==="object"?send.cityGeofences:{},
    maxSearchSeconds:Math.max(90,Math.min(1800,Number(send.maxSearchSeconds||480))),
    cashEnabled,
    scheduledEnabled,
    paynowEnabled,
    paymentMethods: [cashEnabled ? "cash" : null, paynowEnabled ? "paynow" : null].filter(Boolean),
    enabledCities: Array.isArray(send.enabledCities) ? send.enabledCities.filter(Boolean) : [],
    enabledAreas: send.enabledAreas && typeof send.enabledAreas === "object" ? send.enabledAreas : {},
    pricing: {
      ...defaults,
      ...pricing,
      parcelSizes: {
        small: { ...defaults.parcelSizes.small, ...(configuredSizes.small || {}) },
        medium: { ...defaults.parcelSizes.medium, ...(configuredSizes.medium || {}) },
        large: { ...defaults.parcelSizes.large, ...(configuredSizes.large || {}) },
        bulky: { ...defaults.parcelSizes.bulky, ...(configuredSizes.bulky || {}) }
      }
    }
  };
}

export function parcelAvailability(settings = {}, pickup = {}) {
  const config = parcelSettings(settings);
  if (!config.enabled) return { enabled: false, reason: "Spotly Send is not accepting requests yet.", config };
  if (!config.paymentMethods.length) return { enabled: false, reason: "Send payments are not configured yet.", config };
  if(!process.env.SPOTLY_SEND_PIN_KEY||process.env.SPOTLY_SEND_PIN_KEY.length<32)
    return {enabled:false,reason:"Secure Send handoff codes are not configured.",config};
  if(!process.env.SPOTLY_GEOCODING_URL||!process.env.SPOTLY_REVERSE_GEOCODING_URL)
    return {enabled:false,reason:"Licensed Send location services are not configured.",config};
  if(!config.routingVerified||!process.env.SPOTLY_ROUTING_URL)
    return {enabled:false,reason:"Verified Send road routing is not ready.",config};
  if(!config.dispatchSchedulerVerified)
    return {enabled:false,reason:"The Send background dispatcher has not been verified.",config};
  if(!insideCountryBounds(pickup,"ZW")||String(pickup?.country||"").toUpperCase()!=="ZW")
    return {enabled:false,reason:"Send is approved only for Zimbabwe.",config};
  const city = String(pickup?.city || "").trim().toLowerCase();
  const area = String(pickup?.area || "").trim().toLowerCase();
  const cities = config.enabledCities.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
  if (!cities.length||!city||!cities.includes(city)) return { enabled: false, reason: "Spotly Send is not available in this city yet.", config };
  const entry = Object.entries(config.enabledAreas || {}).find(([key]) => String(key).trim().toLowerCase() === city);
  const areas = Array.isArray(entry?.[1]) ? entry[1].map((item) => String(item).trim().toLowerCase()).filter(Boolean) : [];
  if (areas.length && (!area || !areas.includes(area))) return { enabled: false, reason: "Spotly Send is not available in this pickup area yet.", config };
  return { enabled: true, reason: "", config };
}

export function normalizeParcelPoint(value = {}) {
  const location = normalizeLocation(value);
  if (!location) return null;
  return {
    ...location,
    label: safeText(value.label || value.address || "", 160),
    formattedAddress: safeText(value.formattedAddress || value.address || value.label || "", 500),
    area: safeText(value.area || value.suburb || value.city || "", 120),
    city: safeText(value.city || "", 120),
    country:safeText(value.country||"",2).toUpperCase()
  };
}

export function estimateParcel({ pickup, dropoff, parcelSize = "medium", settings = {}, route=null }) {
  const config = parcelSettings(settings).pricing;
  const size = config.parcelSizes[parcelSize] || config.parcelSizes.medium;
  const directKm = haversineKm(pickup, dropoff);
  if (!Number.isFinite(directKm) || directKm < 0.15) throw Object.assign(new Error("Choose a drop-off farther from the pickup point."), { status: 400 });
  const routeKm=route?.source==="verified_road_route"?route.distanceKm:Math.max(0.2,directKm*Number(config.roadDistanceFactor||1.22));
  const durationMin=route?.source==="verified_road_route"?route.durationMinutes:Math.max(3,Math.round((routeKm/Math.max(8,Number(config.averageSpeedKph||28)))*60));
  const raw = Number(config.baseFare || 0) + routeKm * Number(config.perKm || 0) + Number(config.bookingFee || 0);
  const total = Number((Math.max(Number(config.minimumFare || 0), raw) * Number(size.multiplier || 1)).toFixed(2));
  const driverPay = Number((total * Math.max(0, Math.min(100, Number(config.driverSharePercent || 80))) / 100).toFixed(2));
  return {
    parcelSize,
    routeSource:route?.source||"approximate",
    routePath:route?.path||[],
    parcelSizeLabel: size.label || parcelSize,
    maxKg: Number(size.maxKg || 15),
    currency: config.currency === "ZWG" ? "ZWG" : "USD",
    distanceKm: Number(routeKm.toFixed(1)),
    durationMinutes: durationMin,
    baseFare: Number(config.baseFare || 0),
    bookingFee: Number(config.bookingFee || 0),
    total,
    driverPay,
    platformFee: Number((total - driverPay).toFixed(2)),
    requiredVehicleTypes: size.vehicleTypes || ["car", "van"],
    proofPhotoRequired: config.proofPhotoRequired === true
  };
}

export function makeParcelNumber() {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `SD-${stamp}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

export function makeParcelPin() { return newParcelPin(); }

export function plainParcel(value) {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(plainParcel);
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plainParcel(item)]));
  return value;
}

export function publicParcel(parcel = {}, { includePins = false, driver = null, driverLocation = null } = {}) {
  const result = {
    id: parcel.id,
    number: parcel.number,
    orderId: parcel.orderId || null,
    state: parcel.state,
    pickup: plainParcel(parcel.pickup),
    dropoff: plainParcel(parcel.dropoff),
    parcelSize: parcel.parcelSize,
    parcelDescription: parcel.parcelDescription || "",
    estimatedWeightKg: Number(parcel.estimatedWeightKg || 0) || null,
    recipientName: parcel.recipientName || "",
    recipientPhone: parcel.recipientPhone || "",
    senderName: parcel.senderName || "",
    senderPhone: parcel.senderPhone || "",
    quote: plainParcel(parcel.quote),
    currency: parcel.currency || "USD",
    paymentMethod: parcel.paymentMethod || "cash",
    paymentStatus: parcel.paymentStatus || "unpaid",
    pickupMode: parcel.pickupMode || "now",
    scheduledPickupAt: toPlainTimestamp(parcel.scheduledPickupAt),
    proofPhotoUrl: parcel.proofPhotoUrl || "",
    proofPhotoRequired: parcel.proofPhotoRequired === true,
    cancellationReason: parcel.cancellationReason || "",
    exceptionCode: parcel.exceptionCode || null,
    createdAt: toPlainTimestamp(parcel.createdAt),
    updatedAt: toPlainTimestamp(parcel.updatedAt),
    driver: driver ? {
      id: driver.id || parcel.assignedDriverId,
      displayName: driver.displayName || driver.legalName || "Spotly Driver",
      phone: driver.phone || "",
      photoURL: driver.photoURL || "",
      rating: Number(driver.rating || 0) || null,
      vehicle: driver.vehicle || null
    } : null,
    driverLocation: driverLocation || null
  };
  if (includePins && !["delivered", "cancelled", "failed", "returned"].includes(parcel.state)) {
    result.pickupPin = revealParcelPin(parcel,"pickup");
    result.dropoffPin = revealParcelPin(parcel,"dropoff");
  }
  return result;
}

export function publicParcelOffer(parcel = {}, offer = {}) {
  return {
    id: offer.id,
    parcelJobId: parcel.id,
    number: parcel.number,
    state: offer.state,
    expiresAt: toPlainTimestamp(offer.expiresAt),
    pay: Number(offer.pay ?? parcel.quote?.driverPay ?? 0),
    currency: parcel.currency || "USD",
    parcelSize: parcel.parcelSize || "medium",
    pickup: { label: parcel.pickup?.label || parcel.pickup?.area || "Pickup", area: parcel.pickup?.area || parcel.pickup?.city || "Pickup" },
    dropoff: { label: parcel.dropoff?.label || parcel.dropoff?.area || "Drop-off", area: parcel.dropoff?.area || parcel.dropoff?.city || "Drop-off" },
    pickupDistanceKm: Number(offer.pickupDistanceKm || 0),
    tripDistanceKm: Number(parcel.quote?.distanceKm || 0),
    expectedTripMinutes: Number(parcel.quote?.durationMinutes || 0),
    requiredVehicleTypes: parcel.requiredVehicleTypes || ["car", "van"]
  };
}

export function appendParcelEvent(transaction, db, { parcelJobId, type, actorType, actorId, previousState = null, state = null, note = "", metadata = {} }) {
  transaction.create(db.collection("parcelEvents").doc(), { parcelJobId, type, actorType, actorId: actorId || null, previousState, state, note: safeText(note, 800), metadata, createdAt: FieldValue.serverTimestamp() });
}

export async function dispatchParcel({ db, messaging, parcelJobId, actorId = "system", maxCandidates = 4 }) {
  const ref = db.collection("parcelJobs").doc(parcelJobId);
  const snap = await ref.get();
  if (!snap.exists) throw Object.assign(new Error("The Send request was not found."), { status: 404 });
  const parcel = { id: snap.id, ...snap.data() };
  if (parcel.assignedDriverId || !["requested", "searching_driver"].includes(parcel.state)) return { assigned: Boolean(parcel.assignedDriverId), offered: 0 };

  const settingsSnap = await db.collection("platformSettings").doc("global").get();
  const settings=parcelSettings(settingsSnap.exists?settingsSnap.data():{});
  if(!settings.enabled||!settings.dispatchSchedulerVerified)return {offered:0,paused:true};
  const config=settings.pricing;
  const ageMs=Date.now()-(parcel.requestedAt?.toMillis?.()||parcel.createdAt?.toMillis?.()||Date.now());
  if(ageMs>settings.maxSearchSeconds*1000){
    await db.runTransaction(async tx=>{
      const current=await tx.get(ref);
      if(!current.exists||!["requested","searching_driver"].includes(current.data().state)||current.data().assignedDriverId)return;
      const now=FieldValue.serverTimestamp();
      tx.update(ref,{state:"failed",exceptionCode:"dispatch_timeout",updatedAt:now});
      if(current.data().orderId)tx.update(db.collection("orders").doc(current.data().orderId),{
        status:"failed",sendStatus:"failed",updatedAt:now});
      tx.set(db.collection("adminQueueItems").doc("send_dispatch_timeout_"+parcelJobId),{
        queue:"parcel-exceptions",type:"dispatch_timeout",entityId:parcelJobId,parcelJobId,
        priority:"high",title:"Send dispatch timed out",status:"open",createdAt:now,updatedAt:now},{merge:true});
      tx.create(db.collection("parcelEvents").doc(),{parcelJobId,type:"dispatch.timeout",actorType:"system",
        state:"failed",createdAt:now});
    });
    return {offered:0,timedOut:true};
  }
  const prior = await db.collection("parcelOffers").where("parcelJobId", "==", parcelJobId).limit(100).get();
  const attempted = new Set(); const live = []; const expiryBatch = db.batch(); let expiryWrites = false;
  prior.docs.forEach((doc) => {
    const offer = doc.data(); attempted.add(offer.driverId);
    const expired = offer.expiresAt?.toMillis?.() ? offer.expiresAt.toMillis() <= Date.now() : false;
    if (["offered", "viewed"].includes(offer.state) && expired) { expiryBatch.set(doc.ref, { state: "expired", expiredAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true }); expiryWrites = true; }
    else if (["offered", "viewed"].includes(offer.state) && !expired) live.push({ id: doc.id, ...offer });
  });
  if (expiryWrites) await expiryBatch.commit();
  if (live.length) return { offered: live.length, candidates: live.length, existingOffers: true, offerIds: live.map((item) => item.id) };

  const presenceSnap = await db.collection("driverPresence").where("online", "==", true).limit(150).get();
  const candidates = [];
  for (const presenceDoc of presenceSnap.docs) {
    if (attempted.has(presenceDoc.id)) continue;
    const presence = presenceDoc.data();
    if (presence.currentJobId || !presence.currentLocation) continue;
    if(!presence.locationUpdatedAt?.toMillis?.()||Date.now()-presence.locationUpdatedAt.toMillis()>120000)continue;
    if(!insideCountryBounds(presence.currentLocation,"ZW"))continue;
    const [driverSnap, applicationSnap, vehicleQuery, docsQuery] = await Promise.all([
      db.collection("drivers").doc(presenceDoc.id).get(),
      db.collection("driverApplications").doc(presenceDoc.id).get(),
      db.collection("driverVehicles").where("driverId", "==", presenceDoc.id).limit(10).get(),
      db.collection("driverDocuments").where("driverId", "==", presenceDoc.id).limit(30).get()
    ]);
    if (!driverSnap.exists) continue;
    const vehicles = vehicleQuery.docs.map((item) => ({ id: item.id, ...item.data() }));
    const vehicle = vehicles.find((item) => item.id === presence.vehicleId && item.status === "approved") || vehicles.find((item) => item.status === "approved") || null;
    const eligibility = operationalEligibility({ driver: driverSnap.data(), application: applicationSnap.exists ? applicationSnap.data() : {}, vehicle, documents: docsQuery.docs.map((item) => item.data()), presence, capability: "send", requiredVehicleTypes: parcel.requiredVehicleTypes || [] });
    if (!eligibility.eligible) continue;
    const pickupDistanceKm = haversineKm(presence.currentLocation, parcel.pickup);
    if (!Number.isFinite(pickupDistanceKm) || pickupDistanceKm > Number(config.maxPickupKm || 15)) continue;
    candidates.push({ driverId: presenceDoc.id, pickupDistanceKm, vehicleId: vehicle?.id || null });
  }
  candidates.sort((a, b) => a.pickupDistanceKm - b.pickupDistanceKm);
  const selected = candidates.slice(0, maxCandidates);
  if (!selected.length) {
    await ref.set({ state: "searching_driver", dispatchAttemptedAt: FieldValue.serverTimestamp(), exceptionCode: "no_driver_found", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await db.collection("adminQueueItems").doc(`parcel_unassigned_${parcelJobId}`).set({ queue: "parcel-exceptions", type: "no_driver_found", entityId: parcelJobId, parcelJobId, status: "open", priority: "high", title: `${parcel.number || parcelJobId} · No Driver found`, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { offered: 0, candidates: 0 };
  }
  const expiresAt = Timestamp.fromMillis(Date.now() + Number(config.offerSeconds || 90) * 1000);
  const batch = db.batch(); const offerIds = [];
  selected.forEach((candidate) => {
    const offerRef = db.collection("parcelOffers").doc(parcelJobId+"_"+candidate.driverId);offerIds.push(offerRef.id);
    batch.create(offerRef, { parcelJobId, driverId: candidate.driverId, state: "offered", pay: Number(parcel.quote?.driverPay || 0), pickupDistanceKm: Number(candidate.pickupDistanceKm.toFixed(1)), vehicleId: candidate.vehicleId, expiresAt, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  });
  batch.set(ref, { state: "searching_driver", dispatchAttemptedAt: FieldValue.serverTimestamp(), exceptionCode: null, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await batch.commit();
  await Promise.all(selected.map((candidate) => notifyUsers(db, messaging, [candidate.driverId], { title: "Send delivery available", body: `${parcel.currency || "USD"} ${Number(parcel.quote?.driverPay || 0).toFixed(2)} · ${parcel.pickup?.area || "Pickup"} → ${parcel.dropoff?.area || "Drop-off"}`, href: "/jobs", category: "driver_send_offer", workspace: "driver", module: "send" })));
  await db.collection("auditLogs").add({ actorId, action: "parcel.dispatch.offers_created", entityType: "parcelJob", entityId: parcelJobId, metadata: { driverIds: selected.map((item) => item.driverId), offerIds }, source: "send_network", createdAt: FieldValue.serverTimestamp() });
  return { offered: selected.length, candidates: candidates.length, offerIds };
}

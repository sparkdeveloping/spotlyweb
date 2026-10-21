import "server-only";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { haversineKm, normalizeLocation, notifyUsers, operationalEligibility } from "@/lib/driver-delivery-server";
import { safeText, toPlainTimestamp } from "@/lib/server-helpers";
import {newRidePin,revealRidePin} from "@/lib/ride-security";
import {insideCountryBounds} from "@/lib/ride-geography";
import {mapTilerReady} from "@/lib/maptiler-geocoding";
import {routingConfiguration} from "@/lib/ride-routing";

export const RIDE_STATES = Object.freeze([
  "requested", "searching_driver", "driver_assigned", "driver_to_pickup", "driver_arrived_pickup",
  "pickup_verification", "no_show_review", "in_trip", "driver_arrived_dropoff", "completed", "cancelled", "failed"
]);

export const RIDE_TRANSITIONS = Object.freeze({
  requested: ["searching_driver", "cancelled"],
  searching_driver: ["driver_assigned", "cancelled", "failed"],
  driver_assigned: ["driver_to_pickup", "searching_driver", "cancelled"],
  driver_to_pickup: ["driver_arrived_pickup", "cancelled", "failed"],
  driver_arrived_pickup: ["pickup_verification", "no_show_review","cancelled", "failed"],
  pickup_verification: ["in_trip", "no_show_review", "cancelled", "failed"],
  no_show_review:["cancelled"],
  in_trip: ["driver_arrived_dropoff", "failed"],
  driver_arrived_dropoff: ["completed", "failed"],
  completed: [], cancelled: [], failed: []
});

export const DRIVER_RIDE_TRANSITIONS = Object.freeze({
  start_to_pickup: ["driver_assigned", "driver_to_pickup"],
  arrive_pickup: ["driver_to_pickup", "driver_arrived_pickup"],
  begin_pickup_verification: ["driver_arrived_pickup", "pickup_verification"],
  verify_pickup: ["pickup_verification", "in_trip"],
  arrive_dropoff: ["in_trip", "driver_arrived_dropoff"],
  complete: ["driver_arrived_dropoff", "completed"]
});

export const DEFAULT_RIDE_PRICING = Object.freeze({
  currency: "USD",
  baseFare: 1.5,
  perKm: 0.65,
  perMinute: 0.12,
  bookingFee: 0.3,
  minimumFare: 3.5,
  roadDistanceFactor: 1.22,
  averageSpeedKph: 30,
  driverSharePercent: 80,
  maxPickupKm: 15,
  offerSeconds: 75,
  serviceTypes: {
    economy: { label: "Economy", multiplier: 1, vehicleTypes: ["car", "van"], seats: 4 },
    comfort: { label: "Comfort", multiplier: 1.25, vehicleTypes: ["car", "van"], seats: 4 },
    xl: { label: "XL", multiplier: 1.55, vehicleTypes: ["van"], seats: 6 }
  }
});

export function rideTransitionAllowed(current, next) {
  return current === next || RIDE_TRANSITIONS[current]?.includes(next) === true;
}

export function makeRideNumber() {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `RD-${stamp}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

export function makeRidePin() {
  return newRidePin();
}

export function plainRide(value) {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(plainRide);
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plainRide(item)]));
  return value;
}

export function rideSettings(settings = {}) {
  const mobility = settings.mobility || {};
  const pricing = mobility.pricing || {};
  const defaults = DEFAULT_RIDE_PRICING;
  const configuredTypes = pricing.serviceTypes || {};
  const cashEnabled = mobility.cashEnabled !== false;
  const paynowEnabled = settings.integrations?.paynowEnabled === true && (settings.commerce?.paymentMethods || []).includes("paynow");
  return {
    enabled: typeof mobility.ridesEnabled === "boolean" ? mobility.ridesEnabled : settings.launch?.ridesEnabled === true,
    scheduledRidesEnabled: mobility.scheduledRidesEnabled === true,
    safetyToolkitEnabled: mobility.safetyToolkitEnabled !== false,
    cashEnabled,
    paynowEnabled,
    paymentMethods: [cashEnabled ? "cash" : null, paynowEnabled ? "paynow" : null].filter(Boolean),
    enabledCountries: Array.isArray(mobility.enabledCountries) ? mobility.enabledCountries.filter(c=>["ZW","MW"].includes(c)) : [],
    cityGeofences:mobility.cityGeofences&&typeof mobility.cityGeofences==="object"?mobility.cityGeofences:{},
    enabledCities: Array.isArray(mobility.enabledCities) ? mobility.enabledCities.filter(Boolean) : [],
    maxSearchSeconds: Math.max(90,Math.min(1200,Number(mobility.maxSearchSeconds||480))),
    routingVerified:mobility.routingVerified===true,
    dispatchSchedulerVerified:mobility.dispatchSchedulerVerified===true,
    enabledAreas:mobility.enabledAreas&&typeof mobility.enabledAreas==="object"?mobility.enabledAreas:{},
    pricing: {
      ...defaults,
      ...pricing,
      serviceTypes: {
        economy: { ...defaults.serviceTypes.economy, ...(configuredTypes.economy || {}) },
        comfort: { ...defaults.serviceTypes.comfort, ...(configuredTypes.comfort || {}) },
        xl: { ...defaults.serviceTypes.xl, ...(configuredTypes.xl || {}) }
      }
    }
  };
}

/** Quote is informational: a licensed, verified road route and an approved
 * service territory are required, but real-time Driver dispatch is not.
 * Booking still uses the stricter rideAvailability() gate. */
export function rideQuoteAvailability(settings = {}, pickup = {}) {
  const config=rideSettings(settings);
  if(!config.enabledCountries.length||!config.enabledCities.length)
    return {enabled:false,reason:"Ride fare previews require an approved country and pickup city.",config};
  // The quote endpoint itself requests and validates road geometry; the manual
  // launch-approval flag is not required for a read-only fare preview.
  const routeReady=routingConfiguration();
  if(!routeReady.ready)
    return {enabled:false,reason:"Road-based fare estimates are not available yet. "+routeReady.reason,config};
  if(!process.env.SPOTLY_GEOCODING_URL&&!mapTilerReady())
    return {enabled:false,reason:"Verified address lookup is not available yet.",config};
  return {enabled:true,reason:"",config};
}

export function rideAvailability(settings = {}, pickup = {}) {
  const config = rideSettings(settings);
  if (!config.enabled) return { enabled: false, reason: "Spotly Ride is not accepting requests yet.", config };
  if (!config.paymentMethods.length) return { enabled: false, reason: "Ride payments are not configured yet.", config };
  if(!config.enabledCountries.length||!config.enabledCities.length)return {enabled:false,reason:"Approved Ride countries and cities must be configured first.",config};
  if(!config.dispatchSchedulerVerified)return {enabled:false,reason:"Ride dispatch background recovery has not been verified.",config};
  if(!config.routingVerified||!routingConfiguration().ready)return {enabled:false,reason:"Verified authenticated road routing is not approved for Ride yet.",config};
  if(!process.env.SPOTLY_RIDE_PIN_KEY||process.env.SPOTLY_RIDE_PIN_KEY.length<32)return {enabled:false,reason:"Secure Ride pickup verification is not configured.",config};
  if(!process.env.SPOTLY_GEOCODING_URL&&!mapTilerReady())return {enabled:false,reason:"Licensed Ride address search has not been configured.",config};
  if(!config.enabledCountries.includes(String(pickup?.country||"").toUpperCase())||
     !insideCountryBounds(pickup,pickup?.country))
   return {enabled:false,reason:"Choose a pickup in an approved Ride country.",config};
  const city = String(pickup?.city || "").trim().toLowerCase();
  const area = String(pickup?.area || "").trim().toLowerCase();
  const enabledCities = config.enabledCities.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
  if(!config.cityGeofences[String(pickup.country||"").toUpperCase()+":"+city])return {enabled:false,reason:"This city has no approved Ride service geofence.",config};
  if (!city || !enabledCities.includes(city)) return { enabled: false, reason: "Spotly Ride is not available in this city yet.", config };
  if (city && config.enabledAreas && typeof config.enabledAreas === "object") {
    const entry = Object.entries(config.enabledAreas).find(([key]) => String(key).trim().toLowerCase() === city);
    const allowedAreas = Array.isArray(entry?.[1]) ? entry[1].map((item) => String(item).trim().toLowerCase()).filter(Boolean) : [];
    if (allowedAreas.length && (!area || !allowedAreas.includes(area))) return { enabled: false, reason: "Spotly Ride is not available in this pickup area yet.", config };
  }
  return { enabled: true, reason: "", config };
}

export function normalizeRidePoint(value = {}) {
  const location = normalizeLocation(value);
  if (!location) return null;
  return {
    ...location,
    label: safeText(value.label || value.address || "", 160),
    formattedAddress: safeText(value.formattedAddress || value.address || value.label || "", 500),
    area: safeText(value.area || value.suburb || value.city || "", 120),
    city: safeText(value.city || "", 120),
    country: safeText(value.country || "", 2).toUpperCase()
  };
}

export function estimateRide({ pickup, dropoff, serviceType = "economy", settings = {}, route = null }) {
  const config = rideSettings(settings).pricing;
  const type = config.serviceTypes[serviceType] || config.serviceTypes.economy;
  const directKm = haversineKm(pickup, dropoff);
  if (!Number.isFinite(directKm) || directKm < 0.15) throw Object.assign(new Error("Choose a destination farther from the pickup point."), { status: 400 });
  const routeKm = route?.source==="verified_road_route" ? route.distanceKm :
    Math.max(0.2, directKm * Number(config.roadDistanceFactor || 1.22));
  const durationMin = route?.source==="verified_road_route" ? route.durationMinutes :
    Math.max(3, Math.round((routeKm / Math.max(8, Number(config.averageSpeedKph || 30))) * 60));
  const raw = Number(config.baseFare || 0) + routeKm * Number(config.perKm || 0) + durationMin * Number(config.perMinute || 0) + Number(config.bookingFee || 0);
  const fare = Math.max(Number(config.minimumFare || 0), raw) * Number(type.multiplier || 1);
  const total = Number(fare.toFixed(2));
  const driverPay = Number((total * Math.max(0, Math.min(100, Number(config.driverSharePercent || 80))) / 100).toFixed(2));
  const platformFee = Number((total - driverPay).toFixed(2));
  return {
    serviceType,
    routeSource:route?.source||"approximate",
    routePath:route?.path||[],
    serviceLabel: type.label || serviceType,
    seats: Number(type.seats || 4),
    currency: config.currency === "ZWG" ? "ZWG" : "USD",
    distanceKm: Number(routeKm.toFixed(1)),
    directDistanceKm: Number(directKm.toFixed(1)),
    durationMinutes: durationMin,
    baseFare: Number(Number(config.baseFare || 0).toFixed(2)),
    bookingFee: Number(Number(config.bookingFee || 0).toFixed(2)),
    total,
    driverPay,
    platformFee,
    requiredVehicleTypes: Array.isArray(type.vehicleTypes) ? type.vehicleTypes : ["car", "van"]
  };
}

export function publicRide(ride = {}, { includePin = false, driver = null, driverLocation = null } = {}) {
  const result = {
    id: ride.id,
    number: ride.number,
    state: ride.state,
    serviceType: ride.serviceType || "economy",
    currency: ride.currency || "USD",
    pickup: plainRide(ride.pickup),
    dropoff: plainRide(ride.dropoff),
    quote: plainRide(ride.quote),
    paymentMethod: ride.paymentMethod || "cash",
    paymentStatus: ride.paymentStatus || "unpaid",
    paymentReviewRequired:ride.paymentReviewRequired===true,
    safetyReviewHold:ride.safetyReviewHold===true,
    driverEarningsStatus:ride.driverEarningsStatus||null,
    noShowReportedAt:toPlainTimestamp(ride.noShowReportedAt),
    assignedDriverId: ride.assignedDriverId || null,
    requestedAt: toPlainTimestamp(ride.requestedAt || ride.createdAt),
    assignedAt: toPlainTimestamp(ride.assignedAt),
    arrivedPickupAt: toPlainTimestamp(ride.arrivedPickupAt),
    startedAt: toPlainTimestamp(ride.startedAt),
    completedAt: toPlainTimestamp(ride.completedAt),
    cancelledAt: toPlainTimestamp(ride.cancelledAt),
    cancellationReason: ride.cancellationReason || "",
    driver: driver ? {
      id: driver.id || ride.assignedDriverId,
      displayName: driver.displayName || driver.legalName || "Spotly Driver",
      phone: driver.phone || "",
      photoURL: driver.photoURL || "",
      rating: Number(driver.rating || 0) || null,
      vehicle: driver.vehicle || null
    } : null,
    driverLocation: driverLocation || null
  };
  if (includePin && !["completed", "cancelled", "failed"].includes(ride.state)) result.pickupPin = revealRidePin(ride);
  return result;
}

export function publicRideOffer(ride = {}, offer = {}) {
  return {
    id: offer.id,
    rideId: ride.id,
    number: ride.number,
    state: offer.state,
    expiresAt: toPlainTimestamp(offer.expiresAt),
    pay: Number(offer.pay ?? ride.quote?.driverPay ?? 0),
    currency: ride.currency || "USD",
    serviceType: ride.serviceType || "economy",
    pickup: { label: ride.pickup?.label || ride.pickup?.area || "Pickup", area: ride.pickup?.area || ride.pickup?.city || "Pickup" },
    dropoff: { label: ride.dropoff?.label || ride.dropoff?.area || "Destination", area: ride.dropoff?.area || ride.dropoff?.city || "Destination" },
    pickupDistanceKm: Number(offer.pickupDistanceKm || 0),
    tripDistanceKm: Number(ride.quote?.distanceKm || 0),
    expectedTripMinutes: Number(ride.quote?.durationMinutes || 0),
    requiredVehicleTypes: ride.requiredVehicleTypes || ["car", "van"]
  };
}

export async function appendRideEvent(transaction, db, { rideId, type, actorType, actorId, previousState = null, state = null, note = "", metadata = {} }) {
  transaction.create(db.collection("rideEvents").doc(), {
    rideId, type, actorType, actorId: actorId || null, previousState, state,
    note: safeText(note, 800), metadata, createdAt: FieldValue.serverTimestamp()
  });
}

export async function dispatchRide({ db, messaging, rideId, actorId = "system", maxCandidates = 4 }) {
  const rideRef = db.collection("rideTrips").doc(rideId);
  const rideSnap = await rideRef.get();
  if (!rideSnap.exists) throw Object.assign(new Error("The ride was not found."), { status: 404 });
  const ride = { id: rideSnap.id, ...rideSnap.data() };
  if (ride.assignedDriverId || ["completed", "cancelled", "failed"].includes(ride.state)) return { assigned: Boolean(ride.assignedDriverId), offered: 0 };

  const settingsSnap = await db.collection("platformSettings").doc("global").get();
  const rules=rideSettings(settingsSnap.exists ? settingsSnap.data() : {});
  if(!rules.enabled||!rules.dispatchSchedulerVerified)return {offered:0,paused:true};
  const config=rules.pricing;
  const requestedAt=ride.requestedAt?.toMillis?.()||ride.createdAt?.toMillis?.()||Date.now();
  if(Date.now()-requestedAt>rules.maxSearchSeconds*1000){
    await db.runTransaction(async tx=>{
      const current=await tx.get(rideRef);
      if(!current.exists||!["requested","searching_driver"].includes(current.data().state)||current.data().assignedDriverId)return;
      const now=FieldValue.serverTimestamp();
      tx.update(rideRef,{state:"failed",exceptionCode:"dispatch_timeout",updatedAt:now});
      if(current.data().orderId)tx.update(db.collection("orders").doc(current.data().orderId),{
        status:"failed",rideStatus:"failed",updatedAt:now});
      tx.set(db.collection("adminQueueItems").doc("ride_timeout_"+rideId),{
        queue:"ride-exceptions",type:"dispatch_timeout",entityId:rideId,rideId,
        status:"open",priority:"high",title:(current.data().number||rideId)+" · Dispatch timed out",
        updatedAt:now,createdAt:now},{merge:true});
      tx.create(db.collection("rideEvents").doc(),{rideId,type:"dispatch.timeout",
        actorType:"system",state:"failed",createdAt:now});
    });
    return {offered:0,timedOut:true};
  }
  const priorOffers = await db.collection("rideOffers").where("rideId", "==", rideId).limit(100).get();
  const attempted = new Set();
  const live = [];
  const expiryBatch = db.batch(); let expiryWrites = false;
  priorOffers.docs.forEach((doc) => {
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
    if (!presence.locationUpdatedAt?.toMillis?.() || Date.now() - presence.locationUpdatedAt.toMillis() > 120000) continue;
    const [driverSnap, applicationSnap, vehicleQuery, docsQuery] = await Promise.all([
      db.collection("drivers").doc(presenceDoc.id).get(),
      db.collection("driverApplications").doc(presenceDoc.id).get(),
      db.collection("driverVehicles").where("driverId", "==", presenceDoc.id).limit(10).get(),
      db.collection("driverDocuments").where("driverId", "==", presenceDoc.id).limit(30).get()
    ]);
    if (!driverSnap.exists) continue;
    const driver = driverSnap.data();
    const vehicles = vehicleQuery.docs.map((item) => ({ id: item.id, ...item.data() }));
    const vehicle = vehicles.find((item) => item.id === presence.vehicleId && item.status === "approved") || vehicles.find((item) => item.status === "approved") || null;
    const documents = docsQuery.docs.map((item) => ({ id: item.id, ...item.data() }));
    const eligibility = operationalEligibility({ driver, application: applicationSnap.exists ? applicationSnap.data() : {}, vehicle, documents, presence, capability: "ride_passenger", requiredVehicleTypes: ride.requiredVehicleTypes || [] });
    if (!eligibility.eligible) continue;
    if(!insideCountryBounds(presence.currentLocation,ride.pickup?.country||ride.country))continue;
    const pickupDistanceKm = haversineKm(presence.currentLocation, ride.pickup);
    if (!Number.isFinite(pickupDistanceKm) || pickupDistanceKm > Number(config.maxPickupKm || 15)) continue;
    candidates.push({ driverId: presenceDoc.id, pickupDistanceKm, vehicleId: vehicle?.id || null, vehicle });
  }
  candidates.sort((a, b) => a.pickupDistanceKm - b.pickupDistanceKm);
  const selected = candidates.slice(0, maxCandidates);
  if (!selected.length) {
    await rideRef.set({ state: "searching_driver", dispatchAttemptedAt: FieldValue.serverTimestamp(), exceptionCode: "no_driver_found", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await db.collection("adminQueueItems").doc(`ride_unassigned_${rideId}`).set({ queue: "ride-exceptions", type: "no_driver_found", entityId: rideId, rideId, status: "open", priority: "high", title: `${ride.number || rideId} · No Driver found`, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { offered: 0, candidates: 0 };
  }
  const expiresAt = Timestamp.fromMillis(Date.now() + Number(config.offerSeconds || 75) * 1000);
  const batch = db.batch(); const offerIds = [];
  selected.forEach((candidate) => {
    const ref=db.collection("rideOffers").doc(rideId+"_"+candidate.driverId);
    offerIds.push(ref.id);
    batch.create(ref, { rideId, driverId: candidate.driverId, state: "offered", pay: Number(ride.quote?.driverPay || 0), pickupDistanceKm: Number(candidate.pickupDistanceKm.toFixed(1)), vehicleId: candidate.vehicleId, expiresAt, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  });
  batch.set(rideRef, { state: "searching_driver", dispatchAttemptedAt: FieldValue.serverTimestamp(), exceptionCode: null, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await batch.commit();
  await Promise.all(selected.map((candidate) => notifyUsers(db, messaging, [candidate.driverId], { title: "Ride available", body: `${ride.currency || "USD"} ${Number(ride.quote?.driverPay || 0).toFixed(2)} · ${ride.pickup?.area || "Pickup"} → ${ride.dropoff?.area || "Destination"}`, href: "/jobs", category: "driver_ride_offer", workspace: "driver", module: "rides" })));
  await db.collection("auditLogs").add({ actorId, action: "ride.dispatch.offers_created", entityType: "rideTrip", entityId: rideId, metadata: { driverIds: selected.map((item) => item.driverId), offerIds }, source: "ride_network", createdAt: FieldValue.serverTimestamp() });
  return { offered: selected.length, candidates: candidates.length, offerIds };
}

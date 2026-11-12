import { createDecipheriv, createHash, timingSafeEqual } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { spotlyAdmin } from "./admin.js";
import { sendUserPush } from "./notifications.js";
import { writeFunctionAudit } from "./audit.js";

const ACTIVE_DRIVER_STATES = new Set(["approved", "ready", "active"]);
const LIVE_OFFER_STATES = new Set(["offered", "viewed"]);
const FINISHED = {
  delivery: new Set(["delivered", "failed", "cancelled", "returned"]),
  ride: new Set(["completed", "failed", "cancelled"]),
  send: new Set(["delivered", "failed", "cancelled", "returned"])
};
const COLLECTIONS = {
  delivery: { offers: "deliveryOffers", work: "deliveryJobs", idField: "deliveryJobId", event: "deliveryEvents" },
  ride: { offers: "rideOffers", work: "rideTrips", idField: "rideId", event: "rideEvents" },
  send: { offers: "parcelOffers", work: "parcelJobs", idField: "parcelJobId", event: "parcelEvents" }
};
const DRIVER_CAPABILITY_VEHICLES = Object.freeze({
  prepared_delivery: new Set(["bicycle", "motorcycle", "car", "van"]),
  shop_and_deliver: new Set(["bicycle", "motorcycle", "car", "van"]),
  send: new Set(["bicycle", "motorcycle", "car", "van"]),
  ride_passenger: new Set(["car", "van"]),
  bulky_delivery: new Set(["van"])
});
const MOTORIZED_DRIVER_VEHICLES = new Set(["motorcycle", "car", "van"]);
const VEHICLE_SCOPED_DRIVER_DOCUMENTS = new Set(["registration", "insurance", "vehicle_fitness"]);
const TRANSITIONS = {
  delivery: {
    driver_assigned: { start_to_pickup: "driver_to_pickup" }, driver_to_pickup: { arrive_pickup: "driver_arrived_pickup" },
    driver_arrived_pickup: { begin_pickup_verification: "pickup_verification", start_shopping: "shopping" }, pickup_verification: { verify_pickup: "collected" },
    shopping: { finish_shopping: "shopping_review" }, shopping_review: { finish_shopping: "collected" }, collected: { start_delivery: "en_route" },
    en_route: { arrive_customer: "driver_arrived_customer" }, driver_arrived_customer: { begin_handoff: "handoff_verification", complete: "delivered" }, handoff_verification: { complete: "delivered" }
  },
  ride: {
    driver_assigned: { start_to_pickup: "driver_to_pickup" }, driver_to_pickup: { arrive_pickup: "driver_arrived_pickup" }, driver_arrived_pickup: { begin_pickup_verification: "pickup_verification" },
    pickup_verification: { verify_pickup: "in_trip" }, in_trip: { arrive_dropoff: "driver_arrived_dropoff" }, driver_arrived_dropoff: { complete: "completed" }
  },
  send: {
    driver_assigned: { start_to_pickup: "driver_to_pickup" }, driver_to_pickup: { arrive_pickup: "driver_arrived_pickup" }, driver_arrived_pickup: { begin_pickup_verification: "pickup_verification" },
    pickup_verification: { verify_pickup: "collected" }, collected: { start_delivery: "en_route" }, en_route: { arrive_dropoff: "driver_arrived_dropoff" },
    driver_arrived_dropoff: { begin_handoff: "handoff_verification" }, handoff_verification: { complete: "delivered", report_handoff_problem: "handoff_exception" },
    handoff_exception: { start_return: "return_in_progress" }, return_in_progress: { confirm_return: "returned" }
  }
};

function plain(value) {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(plain);
  if (value instanceof Timestamp || typeof value?.toDate === "function") return value.toDate().toISOString();
  if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plain(item)]));
  return value;
}
function row(doc) { return doc?.exists ? { id: doc.id, ...plain(doc.data()) } : null; }
function rows(snapshot) { return snapshot?.docs?.map((doc) => ({ id: doc.id, ...plain(doc.data()) })) || []; }
function text(value, max = 220) { return String(value || "").trim().slice(0, max); }
function num(value, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
// Invalid or absent account territory is never silently treated as Zimbabwe.
function country(value) { const result = text(value, 2).toUpperCase(); return ["MW", "ZW"].includes(result) ? result : ""; }
function area(value) { return text(value || "default", 80).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "default"; }
function approvedTerritory(driver = {}, application = {}) {
  const code = country(driver.country || application.country);
  const city = text(driver.city || application.city, 80).trim();
  const cityArea = city ? area(city) : "";
  const verified = Boolean(code && city && cityArea && cityArea !== "default");
  return { verified, country: verified ? code : "", city: verified ? city : "",
    defaultArea: verified ? cityArea : "", defaultAreaLabel: verified ? city : "",
    reason: verified ? "" : "Your operating country or city needs approval in Spotly Driver." };
}
function matchingActiveDispatchZone(zone, territory, requestedArea) {
  return territory.verified && zone && country(zone.country) === territory.country &&
    (!zone.city || text(zone.city, 80).trim().toLowerCase() === territory.city.toLowerCase()) &&
    zone.active !== false && zone.status !== "disabled" &&
    area(zone.id) === requestedArea;
}
function finished(kind, state) { return FINISHED[kind]?.has(String(state || "")) === true; }
function canonicalVehicleType(value) {
  const raw = text(value, 40).toLowerCase();
  if (["motorcycle", "motorbike"].includes(raw)) return "motorcycle";
  if (["bicycle", "bike"].includes(raw)) return "bicycle";
  if (["van", "truck"].includes(raw)) return "van";
  return raw === "car" ? "car" : raw;
}
function capabilityForWork(kind, work = {}) {
  if (kind === "ride") return "ride_passenger";
  if (kind === "send") return "send";
  if (kind === "delivery" && work.fulfilmentMode === "driver_shops") return "shop_and_deliver";
  return "prepared_delivery";
}
function normalizedCapabilities(values, vehicleTypeValue) {
  const requested = Array.isArray(values) ? values.filter((id) => DRIVER_CAPABILITY_VEHICLES[id]) : [];
  if (requested.length) return [...new Set(requested)];
  const fallback = ["prepared_delivery", "send", "shop_and_deliver"];
  if (["car", "van"].includes(vehicleTypeValue)) fallback.push("ride_passenger");
  if (vehicleTypeValue === "van") fallback.push("bulky_delivery");
  return fallback;
}
function requiredDriverDocuments(vehicleTypeValue, capability) {
  const result = new Set(["identity"]);
  if (MOTORIZED_DRIVER_VEHICLES.has(vehicleTypeValue)) { result.add("licence"); result.add("registration"); }
  if (capability === "ride_passenger") { result.add("licence"); result.add("registration"); result.add("insurance"); result.add("vehicle_fitness"); }
  return [...result];
}
function timestampMs(value) {
  if (!value) return null;
  if (typeof value?.toMillis === "function") return value.toMillis();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}
function approvedDriverDocument(documents, type, vehicleId = "") {
  const vehicleScoped = VEHICLE_SCOPED_DRIVER_DOCUMENTS.has(type);
  const matches = documents.filter((item) => {
    if (item.type !== type) return false;
    if (!vehicleScoped || !vehicleId) return true;
    if (item.vehicleId === vehicleId) return true;
    return vehicleId.endsWith("_primary") && !item.vehicleId;
  }).sort((a, b) => (timestampMs(b.updatedAt || b.uploadedAt) || 0) - (timestampMs(a.updatedAt || a.uploadedAt) || 0));
  const current = matches[0];
  if (!current || current.status !== "approved") return false;
  const expiresAt = timestampMs(current.expiresAt);
  return !expiresAt || expiresAt > Date.now();
}
function storedCapabilityActive(driver, application, capability, vehicleTypeValue) {
  const stored = driver?.capabilities?.[capability];
  if (typeof stored === "string") return stored === "active";
  if (stored?.status) return stored.status === "active";
  if (!ACTIVE_DRIVER_STATES.has(driver?.status)) return false;
  const requested = normalizedCapabilities(application?.requestedCapabilities || driver?.requestedCapabilities || [], vehicleTypeValue);
  return requested.includes(capability) && DRIVER_CAPABILITY_VEHICLES[capability]?.has(vehicleTypeValue) === true;
}
function capabilityReady({ driver, application, vehicle, documents, capability, requiredVehicleTypes = [] }) {
  const vehicleTypeValue = canonicalVehicleType(vehicle?.type);
  if (!capability || !DRIVER_CAPABILITY_VEHICLES[capability]?.has(vehicleTypeValue)) return false;
  if (requiredVehicleTypes.length && !requiredVehicleTypes.map(canonicalVehicleType).includes(vehicleTypeValue)) return false;
  if (!storedCapabilityActive(driver, application, capability, vehicleTypeValue)) return false;
  return requiredDriverDocuments(vehicleTypeValue, capability).every((type) => approvedDriverDocument(documents, type, vehicle?.id || ""));
}
function evaluateDriverEligibility({ driver = {}, application = {}, vehicles = [], documents = [], kind = null, work = null }) {
  const vehicle = vehicles.find((item) => item.id === driver.selectedVehicleId && item.status === "approved") || vehicles.find((item) => item.status === "approved") || null;
  const territory = approvedTerritory(driver, application);
  if (!territory.verified) return { eligible: false, reason: territory.reason, vehicle };
  if (!ACTIVE_DRIVER_STATES.has(driver.status) || !vehicle) return { eligible: false, reason: "Your Driver account and vehicle must be approved before accepting work.", vehicle: null };
  if (driver.complianceHold === true) return { eligible: false, reason: "A compliance review is preventing new Driver work.", vehicle };
  if (driver.safetyHold === true) return { eligible: false, reason: "A safety review is preventing new Driver work.", vehicle };
  if (driver.payoutVerificationState && driver.payoutVerificationState !== "verified") return { eligible: false, reason: "Verify your payout destination before accepting Driver work.", vehicle };
  const capability = kind ? capabilityForWork(kind, work || {}) : null;
  if (capability) {
    const requiredVehicleTypes = Array.isArray(work?.requiredVehicleTypes) ? work.requiredVehicleTypes : [];
    if (!capabilityReady({ driver, application, vehicle, documents, capability, requiredVehicleTypes })) return { eligible: false, reason: "Your approved vehicle, capability, or Driver documents do not meet this work request.", vehicle, capability };
    return { eligible: true, vehicle, capability };
  }
  const vehicleTypeValue = canonicalVehicleType(vehicle.type);
  const capabilities = normalizedCapabilities(application.requestedCapabilities || driver.requestedCapabilities || [], vehicleTypeValue);
  const ready = capabilities.some((id) => capabilityReady({ driver, application, vehicle, documents, capability: id }));
  if (!ready && driver.capabilities) return { eligible: false, reason: "At least one approved Driver work type with valid documents is required before going online.", vehicle };
  // Backward compatibility for legacy approved Drivers that predate per-capability records.
  if (!ready && !driver.capabilities) {
    const fallbackReady = capabilities.some((id) => DRIVER_CAPABILITY_VEHICLES[id]?.has(vehicleTypeValue) && requiredDriverDocuments(vehicleTypeValue, id).every((type) => approvedDriverDocument(documents, type, vehicle.id || "")));
    if (!fallbackReady) return { eligible: false, reason: "Approved Driver documents are required before going online.", vehicle };
  }
  return { eligible: true, vehicle };
}
function pinKey(secret) {
  if (typeof secret !== "string" || secret.length < 32) throw new HttpsError("failed-precondition", "Driver PIN verification is not configured.");
  return createHash("sha256").update(`spotly:ride:pickup-pin:v1:${secret}`).digest();
}
function revealEncryptedPin(ciphertext, secret) {
  if (!ciphertext) return null;
  const [version, iv, tag, payload] = String(ciphertext).split(".");
  if (version !== "v1" || !iv || !tag || !payload) throw new HttpsError("failed-precondition", "Unknown Driver PIN encoding.");
  const decipher = createDecipheriv("aes-256-gcm", pinKey(secret), Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(payload, "hex")), decipher.final()]).toString("utf8");
}
function matchesSecretPin({ plaintext, ciphertext, value, secret }) {
  const supplied = String(value || "").trim();
  if (!/^[0-9]{4,6}$/.test(supplied)) return false;
  const actual = ciphertext ? revealEncryptedPin(ciphertext, secret) : (plaintext == null ? null : String(plaintext));
  if (!actual || actual.length !== supplied.length) return false;
  return timingSafeEqual(Buffer.from(actual), Buffer.from(supplied));
}
async function validateDriverProofUrl(storage, { actorId, kind, workId, url }) {
  const raw = text(url, 1200);
  if (!raw) return "";
  if (!["delivery", "send"].includes(kind)) throw new HttpsError("invalid-argument", "Proof is not supported for this work type.");
  let parsed;
  try { parsed = new URL(raw); } catch { throw new HttpsError("invalid-argument", "Choose a valid Spotly proof upload."); }
  if (parsed.protocol !== "https:" || parsed.hostname !== "firebasestorage.googleapis.com" || !parsed.pathname.includes("/o/")) throw new HttpsError("invalid-argument", "Proof must come from Spotly Driver Storage.");
  const encoded = parsed.pathname.split("/o/")[1] || "";
  let objectPath = "";
  try { objectPath = decodeURIComponent(encoded); } catch { throw new HttpsError("invalid-argument", "Proof path is invalid."); }
  const expected = kind === "send" ? `driver-send-proof/${actorId}/${workId}/` : `driver-delivery-proof/${actorId}/${workId}/`;
  if (!objectPath.startsWith(expected)) throw new HttpsError("permission-denied", "Proof must belong to this Driver and work request.");
  const [exists] = await storage.bucket().file(objectPath).exists();
  if (!exists) throw new HttpsError("failed-precondition", "Upload the proof image before completing this work.");
  return raw;
}
function driverBalanceAccountId(driverId, currency = "USD") { return `${driverId}_${String(currency || "USD").toUpperCase()}`; }
function driverLedgerEntryId(type, reference) { return createHash("sha256").update(`${type}:${reference}`).digest("hex").slice(0, 40); }
function postDriverLedgerEntry(transaction, firestore, entry) {
  const currencyCode = String(entry.currency || "USD").toUpperCase();
  const amount = Number(Number(entry.amount || 0).toFixed(2));
  if (!Number.isFinite(amount) || amount === 0) return false;
  const ledgerRef = firestore.collection("driverEarningsLedger").doc(entry.id || driverLedgerEntryId(entry.type, entry.reference));
  const balanceRef = firestore.collection("driverBalanceAccounts").doc(driverBalanceAccountId(entry.driverId, currencyCode));
  transaction.create(ledgerRef, {
    driverId: entry.driverId, deliveryJobId: entry.deliveryJobId || null, orderId: entry.orderId || null, payoutId: null,
    type: entry.type, amount, currency: currencyCode, bucket: "available", effects: { available: amount },
    description: entry.description || "Driver earnings", reference: entry.reference || "", source: entry.source || "driver_runtime",
    createdBy: entry.createdBy || "system", createdAt: FieldValue.serverTimestamp()
  });
  transaction.set(balanceRef, { driverId: entry.driverId, currency: currencyCode, available: FieldValue.increment(amount), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return true;
}
function creditCompletion(transaction, firestore, kind, workId, work, driverId) {
  const currencyCode = work.currency || "USD";
  if (kind === "delivery") {
    return postDriverLedgerEntry(transaction, firestore, { id: driverLedgerEntryId("delivery_earned", workId), driverId, deliveryJobId: workId, orderId: work.orderId || null, type: "delivery_earned", amount: work.acceptedDriverPay ?? work.quotedDriverPay ?? 0, currency: currencyCode, description: "Delivery earnings", reference: workId, source: "delivery_completion" });
  }
  if (kind === "ride") {
    if (work.paymentMethod === "cash") {
      const fee = Number(work.quote?.platformFee || 0);
      return fee > 0 && postDriverLedgerEntry(transaction, firestore, { id: driverLedgerEntryId("ride_cash_platform_fee", workId), driverId, orderId: work.orderId || null, type: "ride_cash_platform_fee", amount: -fee, currency: currencyCode, description: "Spotly fee for cash ride", reference: workId, source: "ride_cash_completion" });
    }
    if (work.paymentStatus === "paid") return postDriverLedgerEntry(transaction, firestore, { id: driverLedgerEntryId("ride_earned", workId), driverId, orderId: work.orderId || null, type: "ride_earned", amount: work.acceptedDriverPay ?? work.quote?.driverPay ?? 0, currency: currencyCode, description: "Ride earnings", reference: workId, source: "ride_completion" });
    return false;
  }
  if (kind === "send") {
    if (work.paymentMethod === "cash") {
      const fee = Number(work.quote?.platformFee || 0);
      return fee > 0 && postDriverLedgerEntry(transaction, firestore, { id: driverLedgerEntryId("parcel_cash_platform_fee", workId), driverId, orderId: work.orderId || null, type: "parcel_cash_platform_fee", amount: -fee, currency: currencyCode, description: "Spotly fee for cash Send delivery", reference: workId, source: "send_cash_completion" });
    }
    if (work.paymentStatus === "paid") return postDriverLedgerEntry(transaction, firestore, { id: driverLedgerEntryId("parcel_earned", workId), driverId, orderId: work.orderId || null, type: "parcel_earned", amount: work.acceptedDriverPay ?? work.quote?.driverPay ?? 0, currency: currencyCode, description: "Send delivery earnings", reference: workId, source: "send_completion" });
  }
  return false;
}
function vehicleType(value) {
  const v = text(value, 40).toLowerCase();
  if (["motorcycle", "motorbike"].includes(v)) return "motorbike";
  if (["bicycle", "bike"].includes(v)) return "bike";
  if (["van", "truck"].includes(v)) return "van";
  return "car";
}
function verificationStatus(driver, application) {
  if (ACTIVE_DRIVER_STATES.has(driver?.status)) return "verified";
  if (["rejected", "offboarded"].includes(driver?.status) || application?.status === "rejected") return "rejected";
  if (["application_submitted", "under_review", "information_required"].includes(application?.status)) return "pending";
  return "not_started";
}
function profile(actor, application, driver, vehicle) {
  const fullName = text(driver?.displayName || driver?.legalName || application?.legalName || actor.profile?.displayName || actor.profile?.name || actor.profile?.email || "Driver", 160);
  return {
    id: actor.uid, fullName, phone: text(driver?.phone || application?.phone || actor.profile?.phone, 40), email: text(actor.profile?.email || application?.email || actor.token?.email, 160),
    city: text(driver?.city || application?.city, 80), country: country(driver?.country || application?.country),
    avatarInitials: fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((item) => item[0]?.toUpperCase() || "").join("") || "D",
    verificationStatus: verificationStatus(driver, application), rating: num(driver?.rating), completedJobs: Math.max(0, Math.floor(num(driver?.completedJobs))),
    joinedAt: plain(driver?.createdAt || application?.createdAt || new Date()),
    vehicle: { id: vehicle?.id || null, type: vehicleType(vehicle?.type), make: text(vehicle?.make, 80), model: text(vehicle?.model, 80), plateNumber: text(vehicle?.registration || vehicle?.plateNumber, 40), color: text(vehicle?.color, 40), status: text(vehicle?.status, 40) }
  };
}
function locationPayload(raw, fallback) {
  const value = raw || {};
  return { label: text(value.label || value.formattedAddress || value.address || value.name || fallback, 220), area: text(value.suburb || value.area || value.city || fallback, 100), lat: num(value.lat, null), lng: num(value.lng, null) };
}
function offerPayload(kind, offer, work) {
  return {
    id: offer.id, kind, workId: offer.deliveryJobId || offer.rideId || offer.parcelJobId || work.id, number: work.number || work.id, state: offer.state, expiresAt: offer.expiresAt || null,
    pay: num(offer.pay ?? work.acceptedDriverPay ?? work.quotedDriverPay ?? work.quote?.driverPay), currency: work.currency || "USD", pickup: locationPayload(work.pickup, "Pickup"), dropoff: locationPayload(work.dropoff, "Drop-off"),
    pickupDistanceKm: num(offer.pickupDistanceKm ?? offer.distanceKm), workDistanceKm: num(offer.workDistanceKm ?? work.deliveryDistanceKm ?? work.quote?.distanceKm), expectedMinutes: Math.max(0, Math.round(num(offer.expectedMinutes ?? work.expectedMinutes ?? work.quote?.durationMinutes))),
    serviceType: work.serviceType || null, fulfilmentMode: work.fulfilmentMode || null, itemCount: Array.isArray(work.shopping?.items) ? work.shopping.items.length : Array.isArray(work.items) ? work.items.length : 0
  };
}
function workPayload(kind, work) {
  if (!work) return null;
  const paymentMethod = text(work.paymentMethod, 40).toLowerCase();
  return {
    id: work.id, kind, number: work.number || work.id, state: String(work.state || ""), orderId: work.orderId || "", businessId: work.businessId || "",
    businessName: text(work.businessName || work.pickup?.name || (kind === "ride" ? "Spotly Ride" : kind === "send" ? "Spotly Send" : "Spotly"), 160), businessCategory: text(work.businessCategory || (kind === "ride" ? "Ride" : kind === "send" ? "Send" : "Delivery"), 80),
    pickup: locationPayload(work.pickup, "Pickup"), dropoff: locationPayload(work.dropoff, "Drop-off"), customerName: text(work.customerName || work.recipientName || "Customer", 120), maskedPhone: "",
    items: Array.isArray(work.shopping?.items) ? plain(work.shopping.items) : Array.isArray(work.items) ? plain(work.items) : [], substitutionsAllowed: work.substitutionsAllowed !== false,
    distanceKm: num(work.deliveryDistanceKm ?? work.quote?.distanceKm), estimatedDurationMinutes: Math.max(0, Math.round(num(work.expectedMinutes ?? work.quote?.durationMinutes))), earnings: num(work.acceptedDriverPay ?? work.quotedDriverPay ?? work.quote?.driverPay), tip: num(work.tip),
    createdAt: plain(work.createdAt || new Date()), acceptedAt: plain(work.assignedAt || work.acceptedAt || null), completedAt: plain(work.deliveredAt || work.completedAt || null), notes: text(work.notes || work.parcelDescription, 500),
    // Driver-specific routing is a projection of the previously verified customer
    // road route. Never request Apple directions or synthesize a straight line.
    serviceType: kind === "ride" ? text(work.serviceType || work.quote?.serviceType || "economy", 20) : null,
    routePath: kind === "ride" && work.quote?.routeSource === "verified_road_route" && Array.isArray(work.quote?.routePath)
      ? work.quote.routePath.filter((point) => point && Number.isFinite(point.lat) && Number.isFinite(point.lng)
        && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180).slice(0, 250)
        .map((point) => ({ lat: point.lat, lng: point.lng })) : [],
    fulfilmentMode: work.fulfilmentMode || null, proofPhotoRequired: work.proofPhotoRequired === true, proofPhotoUploaded: Boolean(work.proofPhotoUrl), paymentMethod, amountToCollect: paymentMethod === "cash" ? num(work.quote?.total || work.cashToCollect) : num(work.cashToCollect), currency: work.currency || "USD",
    pickupCodeRequired: Boolean(work.pickupCode || work.pickupPin || work.pickupPinCiphertext), dropoffCodeRequired: Boolean(work.customerPin || work.dropoffPin || work.dropoffPinCiphertext)
  };
}
async function offersFor(firestore, uid, kind) {
  const config = COLLECTIONS[kind];
  const snap = await firestore.collection(config.offers).where("driverId", "==", uid).where("state", "in", ["offered", "viewed"]).limit(30).get();
  const result = [];
  for (const offerDoc of snap.docs) {
    const offer = { id: offerDoc.id, ...plain(offerDoc.data()) };
    if (offer.expiresAt && new Date(offer.expiresAt).getTime() <= Date.now()) continue;
    const workId = offer[config.idField]; if (!workId) continue;
    const workDoc = await firestore.collection(config.work).doc(workId).get(); if (!workDoc.exists) continue;
    result.push(offerPayload(kind, offer, { id: workDoc.id, ...plain(workDoc.data()) }));
  }
  return result;
}
async function assignedFor(firestore, uid, kind) {
  const config = COLLECTIONS[kind];
  const snap = await firestore.collection(config.work).where("assignedDriverId", "==", uid).limit(100).get();
  return snap.docs.map((doc) => workPayload(kind, { id: doc.id, ...plain(doc.data()) })).filter(Boolean).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}
function earningsSummary(entries) {
  const startDay = new Date(); startDay.setHours(0, 0, 0, 0); const startWeek = Date.now() - 7 * 86400000;
  let todayEarnings = 0, weeklyEarnings = 0, completedToday = 0, pendingPayout = 0;
  for (const entry of entries) {
    const amount = num(entry.amount); const at = new Date(entry.createdAt || entry.availableAt || 0).getTime();
    if (at >= startWeek) weeklyEarnings += amount; if (at >= startDay.getTime()) { todayEarnings += amount; completedToday += 1; }
    if (!["paid", "settled"].includes(String(entry.status || "").toLowerCase())) pendingPayout += Math.max(0, amount);
  }
  return { todayEarnings, weeklyEarnings, completedToday, acceptanceRate: 0, onlineHours: 0, pendingPayout };
}

export async function driverBootstrapData(actor) {
  const { firestore, database } = spotlyAdmin();
  const [applicationDoc, driverDoc, vehiclesSnap, documentsSnap, zonesSnap, earningsSnap, notificationsSnap, incidentsSnap, deliveryOffers, rideOffers, sendOffers, deliveries, rides, sends, presenceDoc] = await Promise.all([
    firestore.collection("driverApplications").doc(actor.uid).get(), firestore.collection("drivers").doc(actor.uid).get(), firestore.collection("driverVehicles").where("driverId", "==", actor.uid).limit(20).get(), firestore.collection("driverDocuments").where("driverId", "==", actor.uid).limit(100).get(),
    firestore.collection("dispatchZones").limit(200).get(), firestore.collection("driverEarningsLedger").where("driverId", "==", actor.uid).limit(250).get(), firestore.collection("notifications").where("userId", "==", actor.uid).limit(100).get().catch(() => ({ docs: [] })), firestore.collection("driverIncidents").where("driverId", "==", actor.uid).limit(100).get().catch(() => ({ docs: [] })),
    offersFor(firestore, actor.uid, "delivery"), offersFor(firestore, actor.uid, "ride"), offersFor(firestore, actor.uid, "send"), assignedFor(firestore, actor.uid, "delivery"), assignedFor(firestore, actor.uid, "ride"), assignedFor(firestore, actor.uid, "send"), database.ref(`driverPresence/${actor.uid}`).get().catch(() => null)
  ]);
  const application = row(applicationDoc) || {}; const driver = row(driverDoc) || {}; const vehicles = rows(vehiclesSnap);
  const selectedVehicle = vehicles.find((item) => item.id === driver.selectedVehicleId && item.status === "approved") || vehicles.find((item) => item.status === "approved") || vehicles.find((item) => item.id === `${actor.uid}_primary`) || vehicles[0] || null;
  const work = [...deliveries, ...rides, ...sends]; const activeWork = work.find((item) => !finished(item.kind, item.state)) || null;
  const completedWork = work.filter((item) => finished(item.kind, item.state) && ["delivered", "completed"].includes(item.state)).slice(0, 50); const cancelledWork = work.filter((item) => finished(item.kind, item.state) && !["delivered", "completed"].includes(item.state)).slice(0, 50);
  const earnings = rows(earningsSnap).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))); const driverCountry = country(driver.country || application.country); const city = text(driver.city || application.city, 80);
  const zones = rows(zonesSnap).filter((zone) => country(zone.country) === driverCountry && (!city || !zone.city || text(zone.city, 80).toLowerCase() === city.toLowerCase())).map((zone) => ({ id: zone.id, name: text(zone.name || zone.label || zone.id, 120), city: text(zone.city, 80), areas: Array.isArray(zone.areas) ? zone.areas.map((v) => text(v, 80)) : [], isActive: zone.active !== false && zone.status !== "disabled", demandLevel: ["low", "normal", "high"].includes(zone.demandLevel) ? zone.demandLevel : "normal", estimatedRequests: Math.max(0, Math.floor(num(zone.estimatedRequests))), notes: text(zone.notes, 300) }));
  const walletTransactions = earnings.slice(0, 100).map((entry) => ({ id: entry.id, type: entry.type === "tip" ? "tipReceived" : "deliveryCompleted", amount: num(entry.amount), relatedJobID: entry.deliveryJobId || entry.rideId || entry.parcelJobId || entry.referenceId || null, createdAt: entry.createdAt || new Date().toISOString(), status: text(entry.status || "Pending payout", 80), notes: text(entry.note || entry.description || entry.type || "Driver earnings", 300) }));
  const notifications = rows(notificationsSnap).map((item) => ({ id: item.id, title: text(item.title, 180), message: text(item.body || item.message, 500), type: text(item.type || item.category || "general", 80), createdAt: item.createdAt || new Date().toISOString(), isRead: item.read === true || item.isRead === true, relatedJobId: item.entityId || item.relatedJobID || null })).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const incidents = rows(incidentsSnap).map((item) => ({ id: item.id, workId: item.deliveryJobId || item.rideId || item.parcelJobId || "", category: text(item.category || "other", 60), description: text(item.description, 2000), status: text(item.status || "open", 40), createdAt: item.createdAt || new Date().toISOString() })).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const documents = rows(documentsSnap);
  const runtimeEligibility = evaluateDriverEligibility({ driver, application, vehicles, documents });
  // City scope is the safe default even when no optional dispatchZones exist.
  // The app may offer active zones as optional finer-grained selections.
  const dispatchReadiness = {
    ...approvedTerritory(driver, application),
    eligible: runtimeEligibility.eligible,
    eligibilityReason: runtimeEligibility.eligible ? "" : runtimeEligibility.reason
  };
  return { profile: profile(actor, application, driver, selectedVehicle), dispatchReadiness, application, vehicle: selectedVehicle, documents, zones, presence: presenceDoc?.exists?.() ? plain(presenceDoc.val()) : null, offers: [...deliveryOffers, ...rideOffers, ...sendOffers], activeWork, completedWork, cancelledWork, earnings: earningsSummary(earnings), walletTransactions, notifications, incidents, canGoOnline: runtimeEligibility.eligible && !activeWork, applicationStatus: application.status || "not_started" };
}

async function eligibility(firestore, uid, { kind = null, work = null } = {}) {
  const [driverDoc, applicationDoc, vehicleSnap, documentSnap] = await Promise.all([
    firestore.collection("drivers").doc(uid).get(), firestore.collection("driverApplications").doc(uid).get(),
    firestore.collection("driverVehicles").where("driverId", "==", uid).limit(20).get(), firestore.collection("driverDocuments").where("driverId", "==", uid).limit(100).get()
  ]);
  const driver = row(driverDoc) || {}; const application = row(applicationDoc) || {}; const vehicles = rows(vehicleSnap); const documents = rows(documentSnap);
  const result = evaluateDriverEligibility({ driver, application, vehicles, documents, kind, work });
  if (!result.eligible) throw new HttpsError("failed-precondition", result.reason);
  const territory = approvedTerritory(driver, application);
  if (!territory.verified) throw new HttpsError("failed-precondition", territory.reason);
  return { vehicle: result.vehicle, capability: result.capability || null,
    country: territory.country, city: territory.city, defaultArea: territory.defaultArea };
}
async function activeWorkExists(firestore, uid) {
  const all = await Promise.all(Object.keys(COLLECTIONS).map((kind) => firestore.collection(COLLECTIONS[kind].work).where("assignedDriverId", "==", uid).limit(40).get()));
  return all.some((snap, index) => snap.docs.some((doc) => !finished(Object.keys(COLLECTIONS)[index], doc.data().state)));
}

export async function updateDriverApplication(actor, data = {}) {
  const { firestore } = spotlyAdmin(); const ref = firestore.collection("driverApplications").doc(actor.uid); const snap = await ref.get(); const current = snap.exists ? snap.data() || {} : {};
  if (["approved", "ready", "active", "suspended", "offboarded"].includes(current.status)) throw new HttpsError("failed-precondition", "This Driver profile is already managed as an active account.");
  const requestedTerritory = approvedTerritory({ country: data.country || current.country, city: data.city || current.city });
  if (!requestedTerritory.verified)
    throw new HttpsError("invalid-argument", "Choose a supported operating country and city.");
  const legalName = text(data.fullName || current.legalName, 160); const phone = text(data.phone || current.phone, 40); const city = requestedTerritory.city; if (!legalName || !phone || !city) throw new HttpsError("invalid-argument", "Name, phone, country and city are required.");
  const now = FieldValue.serverTimestamp();
  await ref.set({ userId: actor.uid, legalName, phone, country: country(data.country || current.country), city, email: actor.profile?.email || actor.token?.email || "", agreementsAccepted: data.agreementsAccepted === true || current.agreementsAccepted === true, locationConsent: data.locationConsent === true || current.locationConsent === true, currentStep: Math.max(num(current.currentStep), num(data.currentStep)), status: current.status || "application_started", createdAt: current.createdAt || now, updatedAt: now }, { merge: true });
  if (data.vehicle) {
    const rawType = text(data.vehicle.type, 40).toLowerCase(); const type = rawType === "motorbike" ? "motorcycle" : rawType === "bike" ? "bicycle" : rawType;
    if (!["motorcycle", "car", "van", "bicycle"].includes(type)) throw new HttpsError("invalid-argument", "Choose a supported vehicle type.");
    await firestore.collection("driverVehicles").doc(`${actor.uid}_primary`).set({ driverId: actor.uid, type, make: text(data.vehicle.make, 80), model: text(data.vehicle.model, 80), registration: text(data.vehicle.plateNumber || data.vehicle.registration, 40).toUpperCase(), color: text(data.vehicle.color, 40), status: "pending_review", setupComplete: true, createdAt: now, updatedAt: now }, { merge: true });
  }
  return { saved: true };
}
export async function registerDriverDocument(actor, data = {}) {
  const { firestore } = spotlyAdmin(); const type = text(data.type, 40); if (!["identity", "licence", "registration", "insurance", "vehicle_fitness", "other"].includes(type)) throw new HttpsError("invalid-argument", "Choose a valid Driver document type.");
  const storagePath = text(data.storagePath, 500); if (!storagePath.startsWith(`driver-applications/${actor.uid}/documents/`)) throw new HttpsError("permission-denied", "Driver evidence must use your scoped Storage path.");
  const ref = firestore.collection("driverDocuments").doc(); await ref.set({ driverId: actor.uid, type, storagePath, fileName: text(data.fileName, 180), vehicleId: ["registration", "insurance", "vehicle_fitness"].includes(type) ? `${actor.uid}_primary` : null, status: "uploaded", uploadedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }); return { documentId: ref.id };
}
export async function submitDriverApplication(actor) {
  const { firestore } = spotlyAdmin(); const [appDoc, vehicleDoc, documents] = await Promise.all([firestore.collection("driverApplications").doc(actor.uid).get(), firestore.collection("driverVehicles").doc(`${actor.uid}_primary`).get(), firestore.collection("driverDocuments").where("driverId", "==", actor.uid).limit(100).get()]);
  if (!appDoc.exists || !vehicleDoc.exists) throw new HttpsError("failed-precondition", "Complete your Driver profile and vehicle first."); const application = appDoc.data() || {}; if ([application.legalName, application.phone, application.country, application.city].some((v) => !text(v))) throw new HttpsError("failed-precondition", "Complete your Driver profile before submitting.");
  const types = new Set(documents.docs.map((doc) => doc.data().type)); const required = vehicleDoc.data()?.type === "bicycle" ? ["identity"] : ["identity", "licence", "registration", "insurance"]; for (const type of required) if (!types.has(type)) throw new HttpsError("failed-precondition", `Upload your ${type} before submitting.`);
  await appDoc.ref.set({ status: "application_submitted", submittedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await writeFunctionAudit({ action: "driver.application_submitted", actor, entityType: "driverApplication", entityId: actor.uid, metadata: { requiredDocumentCount: required.length } });
  return { status: "application_submitted" };
}
export async function driverRealtimeSession(actor, data = {}) {
  const action = text(data.action, 20);
  if (!["online", "pause", "offline"].includes(action)) throw new HttpsError("invalid-argument", "Choose online, pause or offline.");
  const { firestore, database } = spotlyAdmin();
  const active = await activeWorkExists(firestore, actor.uid);
  if (["pause", "offline"].includes(action) && active) throw new HttpsError("failed-precondition", "Finish active work before changing availability.");
  if (action === "online" && active) throw new HttpsError("failed-precondition", "Your active work restores automatically. Finish it before returning to dispatch.");

  const currentPresence = await database.ref(`driverPresence/${actor.uid}`).get().catch(() => null);
  const current = currentPresence?.exists?.() ? currentPresence.val() || {} : {};
  const allowed = action === "online" ? await eligibility(firestore, actor.uid) : null;
  // Never allow client input to override the approved country or invent a zone.
  const countryCode = action === "online" ? allowed.country : country(current.country || data.country);
  const requestedCountry = text(data.country, 2).toUpperCase();
  if (action === "online" && requestedCountry && requestedCountry !== allowed.country)
    throw new HttpsError("permission-denied", "Your country does not match your approved Driver territory.");
  let areaCode = action === "online" ? allowed.defaultArea : area(current.area || data.area);
  if (action === "online") {
    const requestedArea = data.area ? area(data.area) : allowed.defaultArea;
    if (requestedArea !== allowed.defaultArea) {
      const zonesSnap = await firestore.collection("dispatchZones").limit(200).get();
      const authorizedZone = zonesSnap.docs.some((doc) =>
        matchingActiveDispatchZone({ id: doc.id, ...doc.data() },
          { verified: true, country: allowed.country, city: allowed.city }, requestedArea));
      if (!authorizedZone)
        throw new HttpsError("failed-precondition", "This dispatch zone is not active for your approved city.");
    }
    areaCode = requestedArea;
  }
  const now = Date.now();
  const scopeRef = database.ref(`runtimeAccess/driverDispatchScope/${actor.uid}`);

  if (action === "online") {
    if (current.country && current.area && (current.country !== countryCode || current.area !== areaCode))
      await database.ref(`dispatchPresence/${current.country}/${current.area}/${actor.uid}`).remove().catch(() => null);
    await scopeRef.remove();
    await database.ref(`runtimeAccess/driverEligible/${actor.uid}`).set(true);
    await database.ref(`runtimeAccess/driverDispatchScope/${actor.uid}/${countryCode}/${areaCode}`).set(true);
    await database.ref(`driverPresence/${actor.uid}`).update({ uid: actor.uid, state: "online", country: countryCode, area: areaCode, vehicleId: allowed.vehicle.id, currentJobId: null, currentWorkType: null, updatedAt: now });
  } else {
    await database.ref(`runtimeAccess/driverEligible/${actor.uid}`).set(false);
    await scopeRef.remove();
    if (current.country && current.area) await database.ref(`dispatchPresence/${current.country}/${current.area}/${actor.uid}`).remove().catch(() => null);
    await database.ref(`driverPresence/${actor.uid}`).update({ uid: actor.uid, state: "offline", country: countryCode, area: areaCode, currentJobId: null, currentWorkType: null, location: null, updatedAt: now });
  }
  await writeFunctionAudit({ action: `driver.presence_${action}`, actor, entityType: "driverPresence", entityId: actor.uid, metadata: { country: countryCode, area: areaCode } });
  return { state: action === "online" ? "online" : "offline", country: countryCode, area: areaCode, vehicleId: allowed?.vehicle?.id || current.vehicleId || null };
}
export async function registerDriverPushToken(actor, data = {}) {
  const token = text(data.token, 4096); if (!token) throw new HttpsError("invalid-argument", "A push token is required."); const { firestore } = spotlyAdmin(); const id = createHash("sha256").update(token).digest("hex"); await firestore.collection("pushTokens").doc(id).set({ userId: actor.uid, token, workspace: "driver", platform: "ios", active: true, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true }); return { registered: true };
}
export async function registerDriverWorkProof(actor, data = {}) {
  const kind = text(data.kind, 20); const workId = text(data.workId, 180); const config = COLLECTIONS[kind];
  if (!config || !["delivery", "send"].includes(kind) || !workId) throw new HttpsError("invalid-argument", "Choose the work request that needs proof.");
  const { firestore, storage } = spotlyAdmin();
  const proofPhotoUrl = await validateDriverProofUrl(storage, { actorId: actor.uid, kind, workId, url: data.proofPhotoUrl });
  const ref = firestore.collection(config.work).doc(workId); const doc = await ref.get();
  if (!doc.exists) throw new HttpsError("not-found", "This work request no longer exists.");
  const work = doc.data() || {};
  if (work.assignedDriverId !== actor.uid) throw new HttpsError("permission-denied", "This work is assigned to another Driver.");
  if (finished(kind, work.state)) throw new HttpsError("failed-precondition", "Completed work cannot accept new proof.");
  const now = FieldValue.serverTimestamp();
  const batch = firestore.batch();
  batch.set(ref, { proofPhotoUrl, proofUploadedAt: now, updatedAt: now }, { merge: true });
  batch.create(firestore.collection(config.event).doc(), { ...(kind === "send" ? { parcelJobId: workId } : { deliveryJobId: workId, orderId: work.orderId || null }), type: `${kind}.proof_uploaded`, actorType: "driver", actorId: actor.uid, previousState: work.state, state: work.state, createdAt: now });
  await batch.commit();
  return { workId, kind, proofPhotoUrl };
}
async function noActiveWork(transaction, firestore, uid) {
  for (const kind of Object.keys(COLLECTIONS)) { const snap = await transaction.get(firestore.collection(COLLECTIONS[kind].work).where("assignedDriverId", "==", uid).limit(40)); if (snap.docs.some((doc) => !finished(kind, doc.data().state))) throw new HttpsError("failed-precondition", "Finish your active Spotly work before accepting another request."); }
}
export async function driverOfferAction(actor, data = {}) {
  const kind = text(data.kind, 20); const action = text(data.action, 20); const offerId = text(data.offerId, 180); const config = COLLECTIONS[kind]; if (!config || !offerId || !["view", "accept", "decline"].includes(action)) throw new HttpsError("invalid-argument", "Review the Driver offer action."); const { firestore, database } = spotlyAdmin(); let allowed = null; let workId = ""; let customerId = "";
  if (action === "accept") {
    const offerDoc = await firestore.collection(config.offers).doc(offerId).get();
    if (!offerDoc.exists) throw new HttpsError("not-found", "This Driver offer is no longer available.");
    const offer = offerDoc.data() || {};
    if (offer.driverId !== actor.uid) throw new HttpsError("permission-denied", "This offer belongs to another Driver.");
    const candidateWorkId = offer[config.idField];
    const workDoc = candidateWorkId ? await firestore.collection(config.work).doc(candidateWorkId).get() : null;
    if (!workDoc?.exists) throw new HttpsError("not-found", "This work request no longer exists.");
    allowed = await eligibility(firestore, actor.uid, { kind, work: workDoc.data() || {} });
  }
  await firestore.runTransaction(async (transaction) => { const offerRef = firestore.collection(config.offers).doc(offerId); const offerDoc = await transaction.get(offerRef); if (!offerDoc.exists) throw new HttpsError("not-found", "This Driver offer is no longer available."); const offer = offerDoc.data() || {}; if (offer.driverId !== actor.uid) throw new HttpsError("permission-denied", "This offer belongs to another Driver."); if (offer.expiresAt?.toMillis?.() && offer.expiresAt.toMillis() <= Date.now()) throw new HttpsError("deadline-exceeded", "This offer expired. Refresh your work queue."); workId = offer[config.idField]; const workRef = firestore.collection(config.work).doc(workId); const workDoc = await transaction.get(workRef); if (!workDoc.exists) throw new HttpsError("not-found", "This work request no longer exists."); const work = workDoc.data() || {};
    if (action === "view") { if (offer.state === "offered") transaction.set(offerRef, { state: "viewed", viewedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true }); return; }
    if (!LIVE_OFFER_STATES.has(offer.state)) throw new HttpsError("failed-precondition", "This Driver offer is no longer available."); if (action === "decline") { transaction.set(offerRef, { state: "declined", declinedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true }); return; }
    await noActiveWork(transaction, firestore, actor.uid); const allowedStates = kind === "delivery" ? ["awaiting_dispatch", "searching_driver"] : ["requested", "searching_driver"]; if (work.assignedDriverId || !allowedStates.includes(work.state)) throw new HttpsError("aborted", "Another Driver already accepted this request."); const now = FieldValue.serverTimestamp();
    transaction.set(offerRef, { state: "accepted", acceptedAt: now, updatedAt: now }, { merge: true });
    transaction.set(workRef, { state: "driver_assigned", assignedDriverId: actor.uid, assignedVehicleId: offer.vehicleId || allowed.vehicle.id, acceptedDriverPay: num(offer.pay ?? work.quotedDriverPay ?? work.quote?.driverPay), assignedAt: now, updatedAt: now }, { merge: true });
    transaction.create(firestore.collection("auditLogs").doc(), { actorId: actor.uid, action: `${kind}.offer_accepted`, entityType: config.work, entityId: workId, metadata: { offerId, customerId: work.customerId || null }, source: "driver_firebase_runtime", createdAt: now });
    customerId = work.customerId || "";
  });
  if (action === "accept") {
    const siblings = await firestore.collection(config.offers).where(config.idField, "==", workId).limit(100).get();
    const batch = firestore.batch(); let changed = false;
    for (const doc of siblings.docs) if (doc.id !== offerId && LIVE_OFFER_STATES.has(doc.data().state)) { batch.set(doc.ref, { state: "withdrawn", updatedAt: FieldValue.serverTimestamp() }, { merge: true }); changed = true; }
    if (changed) await batch.commit();
    const presence = await database.ref(`driverPresence/${actor.uid}`).get().catch(() => null); const current = presence?.exists?.() ? presence.val() || {} : {};
    if (current.country && current.area) await database.ref(`dispatchPresence/${current.country}/${current.area}/${actor.uid}`).remove().catch(() => null);
    await database.ref(`runtimeAccess/driverDispatchScope/${actor.uid}`).remove();
    await database.ref(`driverPresence/${actor.uid}`).update({ state: "busy", currentJobId: workId, currentWorkType: kind, updatedAt: Date.now() });
    await database.ref(`runtimeAccess/activeTrips/${workId}`).update({ [`drivers/${actor.uid}`]: true, [`readers/${actor.uid}`]: true, ...(customerId ? { [`readers/${customerId}`]: true } : {}) });
    if (customerId) await sendUserPush({ userId: customerId, title: "Driver assigned", body: "A Spotly Driver accepted your request.", data: { kind, workId }, workspace: "customer" }).catch(() => null);
  }
  return { kind, action, workId };
}
export async function driverWorkAction(actor, data = {}) {
  const kind = text(data.kind, 20); const workId = text(data.workId, 180); const action = text(data.action, 40); const code = text(data.code, 20); const config = COLLECTIONS[kind];
  if (!config || !workId || !action) throw new HttpsError("invalid-argument", "Review the active Driver work action.");
  const { firestore, database, storage } = spotlyAdmin(); let resultState = ""; let customerId = "";
  const proofPhotoUrl = data.proofPhotoUrl ? await validateDriverProofUrl(storage, { actorId: actor.uid, kind, workId, url: data.proofPhotoUrl }) : "";
  await firestore.runTransaction(async (transaction) => {
    const ref = firestore.collection(config.work).doc(workId); const doc = await transaction.get(ref);
    if (!doc.exists) throw new HttpsError("not-found", "This active work no longer exists.");
    const work = doc.data() || {};
    if (work.assignedDriverId !== actor.uid) throw new HttpsError("permission-denied", "This work is assigned to another Driver.");
    if (work.safetyReviewHold === true) throw new HttpsError("failed-precondition", "A safety review has paused this work. Contact Spotly Operations.");
    const next = TRANSITIONS[kind]?.[work.state]?.[action];
    if (!next) throw new HttpsError("failed-precondition", "Refresh the job and follow the current next action.");

    if (action === "verify_pickup") {
      let valid = true;
      if (kind === "ride" && (work.pickupPin || work.pickupPinCiphertext)) valid = matchesSecretPin({ plaintext: work.pickupPin, ciphertext: work.pickupPinCiphertext, value: code, secret: process.env.SPOTLY_RIDE_PIN_KEY });
      else if (kind === "send" && (work.pickupPin || work.pickupPinCiphertext)) valid = matchesSecretPin({ plaintext: work.pickupPin, ciphertext: work.pickupPinCiphertext, value: code, secret: process.env.SPOTLY_SEND_PIN_KEY });
      else if (kind === "delivery" && work.pickupCode) valid = String(work.pickupCode) === code;
      if (!valid) throw new HttpsError("failed-precondition", "The pickup code is not correct.");
    }
    if (action === "complete" || (kind === "send" && action === "confirm_return")) {
      if (work.proofPhotoRequired === true && ["delivery", "send"].includes(kind) && !proofPhotoUrl && !work.proofPhotoUrl && !work.returnProofPhotoUrl) throw new HttpsError("failed-precondition", action === "confirm_return" ? "Upload return proof before confirming the parcel was returned." : "Upload delivery proof before completing this work.");
      if (action === "complete") {
        let valid = true;
        if (kind === "send" && (work.dropoffPin || work.dropoffPinCiphertext)) valid = matchesSecretPin({ plaintext: work.dropoffPin, ciphertext: work.dropoffPinCiphertext, value: code, secret: process.env.SPOTLY_SEND_PIN_KEY });
        else if (kind === "delivery" && work.customerPin) valid = String(work.customerPin) === code;
        if (!valid) throw new HttpsError("failed-precondition", "The handoff code is not correct.");
        if (["ride", "send"].includes(kind) && work.paymentMethod === "cash") {
          const expected = Number(work.quote?.total || work.cashToCollect || 0); const supplied = Number(data.cashAmount);
          if (data.cashReceived !== true || !Number.isFinite(supplied) || Math.round(supplied * 100) !== Math.round(expected * 100)) throw new HttpsError("failed-precondition", "Confirm the exact cash amount before completing this work.");
        }
      }
    }

    const now = FieldValue.serverTimestamp();
    const patch = { state: next, updatedAt: now };
    if (action === "arrive_pickup") patch.arrivedPickupAt = now;
    if (action === "verify_pickup") { if (kind === "ride") patch.startedAt = now; else patch.collectedAt = now; }
    if (["arrive_dropoff", "arrive_customer"].includes(action)) patch[kind === "delivery" ? "arrivedCustomerAt" : "arrivedDropoffAt"] = now;
    if (kind === "send" && action === "report_handoff_problem") { patch.handoffExceptionAt = now; patch.exceptionCode = text(data.reason || "recipient_unavailable", 120) || "recipient_unavailable"; }
    if (kind === "send" && action === "start_return") { patch.returnStartedAt = now; patch.exceptionCode = work.exceptionCode || "handoff_failed_return"; }
    if (kind === "send" && action === "confirm_return") { patch.returnedAt = now; patch.paymentReviewRequired = work.paymentStatus === "paid"; patch.driverEarningsStatus = "on_hold"; if (proofPhotoUrl) { patch.returnProofPhotoUrl = proofPhotoUrl; patch.returnProofUploadedAt = now; } }
    if (action === "complete") {
      if (kind === "ride") patch.completedAt = now; else patch.deliveredAt = now;
      if (proofPhotoUrl) { patch.proofPhotoUrl = proofPhotoUrl; patch.proofUploadedAt = now; }
      if (["ride", "send"].includes(kind) && work.paymentMethod === "cash") { patch.paymentStatus = "cash_driver_attested"; patch.cashReceived = Number(data.cashAmount); patch.cashAttestedAt = now; patch.cashAttestedBy = actor.uid; }
      else if (["ride", "send"].includes(kind) && work.paymentStatus !== "paid") patch.driverEarningsStatus = "awaiting_customer_payment";
    }
    transaction.set(ref, patch, { merge: true });
    transaction.create(firestore.collection(config.event).doc(), { ...(kind === "ride" ? { rideId: workId } : kind === "send" ? { parcelJobId: workId } : { deliveryJobId: workId, orderId: work.orderId || null }), type: `${kind}.${action}`, actorType: "driver", actorId: actor.uid, previousState: work.state, state: next, createdAt: now });

    if (work.orderId) {
      const orderPatch = { updatedAt: now };
      if (kind === "delivery") orderPatch.deliveryStatus = next;
      else if (kind === "ride") orderPatch.rideStatus = next;
      else orderPatch.sendStatus = next;
      if (action === "complete") { orderPatch.status = "completed"; orderPatch.completedAt = now; if (patch.paymentStatus) { orderPatch.paymentStatus = patch.paymentStatus; orderPatch.cashAttestedAt = now; } }
      else if (kind === "send" && action === "confirm_return") { orderPatch.status = "exception"; orderPatch.returnedAt = now; orderPatch.paymentReviewRequired = work.paymentStatus === "paid"; }
      else orderPatch.status = "in_progress";
      transaction.set(firestore.collection("orders").doc(work.orderId), orderPatch, { merge: true });
    }
    const finishesWork = action === "complete" || (kind === "send" && action === "confirm_return");
    if (kind === "send" && action === "report_handoff_problem") transaction.set(firestore.collection("adminQueueItems").doc(`send_handoff_${workId}`), { queue: "parcel-exceptions", type: "handoff_failed", status: "open", priority: "high", entityId: workId, parcelJobId: workId, driverId: actor.uid, title: "Send handoff failed", createdAt: now, updatedAt: now }, { merge: true });
    if (kind === "send" && action === "confirm_return" && work.paymentStatus === "paid") {
      transaction.set(firestore.collection("sendFinanceReviews").doc(workId), { parcelJobId: workId, driverId: actor.uid, issueType: "parcel_returned_after_collection", status: "open", createdAt: now, updatedAt: now }, { merge: true });
      transaction.set(firestore.collection("adminQueueItems").doc(`send_return_finance_${workId}`), { queue: "parcel-exceptions", type: "returned_parcel_finance_review", status: "open", priority: "high", entityId: workId, parcelJobId: workId, driverId: actor.uid, title: "Returned Send · Finance review", createdAt: now, updatedAt: now }, { merge: true });
    }
    if (finishesWork) {
      const credited = action === "complete" ? creditCompletion(transaction, firestore, kind, workId, work, actor.uid) : false;
      if (credited && kind !== "delivery" && work.paymentMethod !== "cash") transaction.set(ref, { driverEarningsStatus: "available", earningsCreditedAt: now }, { merge: true });
      transaction.set(firestore.collection("driverPresence").doc(actor.uid), { currentJobId: null, currentWorkType: null, availabilityState: "availability_pending", updatedAt: now }, { merge: true });
      transaction.create(firestore.collection("auditLogs").doc(), { actorId: actor.uid, action: action === "complete" ? `${kind}.completed` : `${kind}.returned`, entityType: config.work, entityId: workId, metadata: { orderId: work.orderId || null }, source: "driver_firebase_runtime", createdAt: now });
    }
    customerId = work.customerId || ""; resultState = next;
  });
  if (action === "complete" || (kind === "send" && action === "confirm_return")) {
    const presence = await database.ref(`driverPresence/${actor.uid}`).get(); const current = presence.exists() ? presence.val() : {};
    await database.ref(`runtimeAccess/activeTrips/${workId}`).remove();
    let dispatchEligible = false;
    try { await eligibility(firestore, actor.uid); dispatchEligible = true; } catch { dispatchEligible = false; }
    if (dispatchEligible && current.country && current.area) {
      await database.ref(`runtimeAccess/driverEligible/${actor.uid}`).set(true);
      await database.ref(`runtimeAccess/driverDispatchScope/${actor.uid}`).remove();
      await database.ref(`runtimeAccess/driverDispatchScope/${actor.uid}/${current.country}/${current.area}`).set(true);
      if (current.location?.lat != null && current.location?.lng != null) await database.ref(`dispatchPresence/${current.country}/${current.area}/${actor.uid}`).set({ uid: actor.uid, lat: current.location.lat, lng: current.location.lng, updatedAt: Date.now() }).catch(() => null);
      await database.ref(`driverPresence/${actor.uid}`).update({ state: "online", currentJobId: null, currentWorkType: null, updatedAt: Date.now() });
      await firestore.collection("driverPresence").doc(actor.uid).set({ currentJobId: null, currentWorkType: null, availabilityState: "online_current", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    } else {
      await database.ref(`runtimeAccess/driverEligible/${actor.uid}`).set(false);
      await database.ref(`runtimeAccess/driverDispatchScope/${actor.uid}`).remove();
      if (current.country && current.area) await database.ref(`dispatchPresence/${current.country}/${current.area}/${actor.uid}`).remove().catch(() => null);
      await database.ref(`driverPresence/${actor.uid}`).update({ state: "offline", currentJobId: null, currentWorkType: null, location: null, updatedAt: Date.now() });
      await firestore.collection("driverPresence").doc(actor.uid).set({ currentJobId: null, currentWorkType: null, availabilityState: "offline", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
  }
  if (customerId) await sendUserPush({ userId: customerId, title: "Spotly update", body: action === "complete" ? "Your Driver completed the trip." : action === "confirm_return" ? "Your parcel was returned to the sender. Spotly Support is reviewing the exception." : "Your Driver updated the trip.", data: { kind, workId, state: resultState }, workspace: "customer" }).catch(() => null);
  return { kind, workId, state: resultState };
}

export async function createDriverIncident(actor, data = {}) {
  const { firestore } = spotlyAdmin(); const kind = text(data.kind, 20); const workId = text(data.workId, 180); const category = text(data.category, 60) || "other"; const description = text(data.description, 2000); const severity = ["low", "medium", "high", "critical"].includes(data.severity) ? data.severity : "medium";
  if (!description || description.length < 3) throw new HttpsError("invalid-argument", "Describe what happened.");
  let work = null; let config = null;
  if (workId) { config = COLLECTIONS[kind]; if (!config) throw new HttpsError("invalid-argument", "Choose the related work type."); const doc = await firestore.collection(config.work).doc(workId).get(); if (!doc.exists || doc.data()?.assignedDriverId !== actor.uid) throw new HttpsError("permission-denied", "This work is not assigned to your Driver account."); work = doc.data() || {}; }
  const ref = firestore.collection("driverIncidents").doc(); const now = FieldValue.serverTimestamp();
  await ref.set({ driverId: actor.uid, deliveryJobId: kind === "delivery" ? workId || null : null, rideId: kind === "ride" ? workId || null : null, parcelJobId: kind === "send" ? workId || null : null, orderId: work?.orderId || null, businessId: work?.businessId || null, customerId: work?.customerId || null, category, description, severity, status: "open", createdAt: now, updatedAt: now });
  if (["high", "critical"].includes(severity)) { await firestore.collection("drivers").doc(actor.uid).set({ safetyHold: true, updatedAt: now }, { merge: true }); if (workId && !finished(kind, work?.state)) await firestore.collection(config.work).doc(workId).set({ safetyReviewHold: true, safetyIncidentId: ref.id, exceptionCode: "safety_review", updatedAt: now }, { merge: true }); }
  await firestore.collection("adminQueueItems").doc(`driver_incident_${ref.id}`).set({ queue: "driver-incidents", type: "driver_incident", entityId: ref.id, driverId: actor.uid, priority: severity === "critical" ? "urgent" : severity, status: "open", title: `${category.replaceAll("_", " ")} incident`, createdAt: now, updatedAt: now });
  await writeFunctionAudit({ action: "driver.incident_reported", actor, entityType: "driverIncident", entityId: ref.id, metadata: { kind, workId: workId || null, category, severity } });
  return { incidentId: ref.id };
}

export async function markDriverNotificationRead(actor, data = {}) { const { firestore } = spotlyAdmin(); const id = text(data.id, 180); if (!id) throw new HttpsError("invalid-argument", "Choose a notification."); const ref = firestore.collection("notifications").doc(id); const doc = await ref.get(); if (!doc.exists || doc.data()?.userId !== actor.uid) throw new HttpsError("not-found", "This notification was not found."); await ref.set({ read: true, readAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true }); return { id, read: true }; }

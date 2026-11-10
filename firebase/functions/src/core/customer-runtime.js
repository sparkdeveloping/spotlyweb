import { HttpsError } from "firebase-functions/v2/https";
import { resolveServiceAvailabilitySet } from "./service-availability.js";
import { loadOperationGrants, operationContext } from "./operations-grants.js";
import { SPOTLY_COUNTRY_CONTRACT } from "./platform.js";

const COUNTRIES = new Map((SPOTLY_COUNTRY_CONTRACT.countries || []).map((item) => [item.code, item]));
const RIDE_TYPES = Object.freeze({
  economy: { label: "Economy", multiplier: 1, vehicleTypes: ["car", "van"], seats: 4 },
  comfort: { label: "Comfort", multiplier: 1.25, vehicleTypes: ["car", "van"], seats: 4 },
  xl: { label: "XL", multiplier: 1.55, vehicleTypes: ["van"], seats: 6 }
});
const PARCEL_SIZES = Object.freeze({
  small: { label: "Small", multiplier: 0.9, maxKg: 5, vehicleTypes: ["bicycle", "motorcycle", "car", "van"] },
  medium: { label: "Medium", multiplier: 1, maxKg: 15, vehicleTypes: ["motorcycle", "car", "van"] },
  large: { label: "Large", multiplier: 1.25, maxKg: 35, vehicleTypes: ["car", "van"] },
  bulky: { label: "Bulky", multiplier: 1.6, maxKg: 80, vehicleTypes: ["van"] }
});
const text = (value, max = 500) => String(value || "").trim().slice(0, max);
const number = (value) => Number(value);
const citySlug = (value) => text(value, 120).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function normalizeRuntimeCountry(value) {
  const code = text(value, 2).toUpperCase();
  return COUNTRIES.has(code) ? code : "";
}
export function countryForCity(value) {
  const clean = citySlug(value);
  if (!clean) return "";
  for (const country of COUNTRIES.values()) if ((country.cities || []).some((city) => city.id === clean || citySlug(city.name) === clean)) return country.code;
  return "";
}
export function normalizeMobilityPoint(value = {}) {
  const lat = number(value.lat), lng = number(value.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const country = normalizeRuntimeCountry(value.country) || countryForCity(value.city);
  if (!country) return null;
  return { lat, lng, label: text(value.label || value.address, 160), formattedAddress: text(value.formattedAddress || value.address || value.label, 500), area: text(value.area || value.suburb || value.city, 120), city: text(value.city, 120), country };
}
function withinCountry(point) {
  const bounds = COUNTRIES.get(point?.country)?.bounds;
  return Boolean(bounds && point.lat >= bounds.minLat && point.lat <= bounds.maxLat && point.lng >= bounds.minLng && point.lng <= bounds.maxLng);
}
function haversineKm(a, b) {
  const rad = Math.PI / 180, a1 = a.lat * rad, a2 = b.lat * rad, d1 = (b.lat - a.lat) * rad, d2 = (b.lng - a.lng) * rad;
  const h = Math.sin(d1 / 2) ** 2 + Math.cos(a1) * Math.cos(a2) * Math.sin(d2 / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(Math.max(0, h))));
}
function pointInCityGeofence(point, config = {}) {
  const key = `${point.country}:${citySlug(point.city)}`;
  const fence = config.cityGeofences?.[key];
  if (!fence || text(fence.country, 2).toUpperCase() !== point.country) return false;
  const center = { lat: number(fence.lat), lng: number(fence.lng) };
  const radius = number(fence.radiusKm);
  return Number.isFinite(center.lat) && Number.isFinite(center.lng) && Number.isFinite(radius) && radius >= 3 && radius <= 100 && haversineKm(point, center) <= radius;
}
function countrySupportsCurrency(country, currency) {
  return (COUNTRIES.get(country)?.currencyPriority || []).includes(String(currency || "").toUpperCase());
}
function paymentMethods(settings = {}, cashEnabled = true, country = "", currency = "") {
  const paynow = settings.integrations?.paynowEnabled === true &&
    (settings.commerce?.paymentMethods || []).includes("paynow") &&
    ["USD", "ZWG"].includes(String(currency || "").toUpperCase());
  return [cashEnabled ? "cash" : null, paynow ? "paynow" : null].filter(Boolean);
}
function countryPricing(config = {}, country = "", defaults = {}) {
  const code = normalizeRuntimeCountry(country);
  if (!code) return null;
  const explicit = config.pricingByCountry?.[code];
  const raw = explicit || (code === "ZW" ? config.pricing : null);
  if (!raw) return null;
  const pricing = { ...defaults, ...raw };
  return countrySupportsCurrency(code, pricing.currency) ? pricing : null;
}
function routeReady() {
  try {
    const endpoint = new URL(process.env.SPOTLY_ROUTING_URL || "");
    return endpoint.protocol === "https:" && endpoint.username === "" && endpoint.password === "" && endpoint.search === "";
  } catch { return false; }
}
async function verifiedRoute(from, to) {
  if (!routeReady()) throw new HttpsError("failed-precondition", "Verified road routing is not configured in Firebase Functions.");
  const base = new URL(process.env.SPOTLY_ROUTING_URL);
  const coords = `${Number(from.lng).toFixed(6)},${Number(from.lat).toFixed(6)};${Number(to.lng).toFixed(6)},${Number(to.lat).toFixed(6)}`;
  base.pathname = `${base.pathname.replace(/\/$/, "")}/route/v1/driving/${coords}`;
  base.searchParams.set("overview", "simplified"); base.searchParams.set("geometries", "geojson"); base.searchParams.set("steps", "false");
  const headers = { Accept: "application/json" };
  if (base.hostname === "api.mapmap.ai") {
    const key = text(process.env.SPOTLY_ROUTING_API_KEY, 220);
    if (!/^snk_[A-Za-z0-9_-]{16,180}$/.test(key)) throw new HttpsError("failed-precondition", "Firebase Functions routing credentials are not configured.");
    headers.Authorization = `Bearer ${key}`;
  }
  let response;
  try { response = await fetch(base.toString(), { headers, signal: AbortSignal.timeout(8500) }); }
  catch { throw new HttpsError("unavailable", "Road routing could not be reached."); }
  if (!response.ok) throw new HttpsError(response.status === 429 ? "resource-exhausted" : "failed-precondition", "No verified driving route is available for these locations.");
  let data;
  try { data = await response.json(); } catch { throw new HttpsError("unavailable", "The road-routing provider returned unreadable data."); }
  const route = data?.routes?.[0];
  const distance = number(route?.distance), duration = number(route?.duration);
  if (data?.code !== "Ok" || !Number.isFinite(distance) || distance < 150 || distance > 1_500_000 ||
      !Number.isFinite(duration) || duration <= 0 || duration > 604_800) {
    throw new HttpsError("failed-precondition", "No safe driving route was returned.");
  }
  const raw = route?.geometry?.coordinates;
  if (!Array.isArray(raw) || raw.length < 2) throw new HttpsError("failed-precondition", "No drivable road geometry was returned.");
  const points = raw.map((pair) => ({ lng: number(pair?.[0]), lat: number(pair?.[1]) }));
  if (points.some((point) => !Number.isFinite(point.lat) || !Number.isFinite(point.lng) ||
      Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180)) {
    throw new HttpsError("failed-precondition", "The routing provider returned invalid road geometry.");
  }
  // Avoid presenting a valid route in the wrong part of the city.
  if (haversineKm(from, points[0]) > 3 || haversineKm(to, points.at(-1)) > 3) {
    throw new HttpsError("failed-precondition", "Both locations must be near a drivable road.");
  }
  const stride = Math.max(1, Math.ceil(points.length / 110));
  const path = points.filter((_, index) => index % stride === 0 || index === points.length - 1);
  return {
    distanceKm: Number((distance / 1000).toFixed(2)),
    durationMinutes: Math.max(1, Math.ceil(duration / 60)),
    source: "verified_road_route",
    path
  };
}
// Quote discovery may remain visible during First Access, but requests must
// observe the same launch gate as the existing trusted website mutations.
async function customerTransactionLaunchReadiness(firestore, settings, actor) {
  const mode = text(settings.launch?.publicMode || "first_access", 40).toLowerCase();
  if (mode === "maintenance") return {
    allowed: false, reason: "Spotly is temporarily under maintenance. New requests are paused."
  };
  if (["first_access", "coming-soon", "private-beta"].includes(mode)) {
    const grants = actor?.uid ? await loadOperationGrants(firestore, actor.uid) : [];
    const preview = grants.some((grant) => ["service_preview", "service_operations"].includes(grant.type));
    if (!preview) return {
      allowed: false, reason: "New requests are currently reserved for accounts with an active Spotly Operations preview grant."
    };
  }
  return { allowed: true, reason: "" };
}
function liveDecision(settings, service, country, city) {
  return resolveServiceAvailabilitySet(settings, { country, city }).find((row) => row.service === service);
}
function ensureTerritory(point, config = {}, { send = false } = {}) {
  if (!withinCountry(point)) throw new HttpsError("failed-precondition", "That location is outside the supported country boundary.");
  const enabledCountries = (config.enabledCountries || []).map((value) => normalizeRuntimeCountry(value)).filter(Boolean);
  if (!enabledCountries.includes(point.country)) throw new HttpsError("failed-precondition", `${send ? "Send" : "Ride"} is not enabled in this country.`);
  const cities = (config.enabledCities || []).map(citySlug);
  if (!point.city || !cities.includes(citySlug(point.city))) throw new HttpsError("failed-precondition", `${send ? "Send" : "Ride"} is not configured for this city.`);
  if (!pointInCityGeofence(point, config)) throw new HttpsError("failed-precondition", `This city has no approved ${send ? "Send" : "Ride"} geofence for the selected pickup.`);
}
export function nativeMobilityReadiness(settings = {}) {
  return { routeReady: routeReady(), rideQuoteReady: routeReady(), sendQuoteReady: routeReady(), directMutations: false };
}
export async function customerRuntimeSnapshot({ firestore, actor, requestedCountry, requestedCity }) {
  const settingsSnap = await firestore.collection("platformSettings").doc("global").get();
  const settings = settingsSnap.exists ? settingsSnap.data() || {} : {};
  let country = normalizeRuntimeCountry(requestedCountry), city = text(requestedCity, 120), source = country ? "explicit_selection" : "";
  if (actor?.uid) {
    const overrideSnap = await firestore.collection("accountCountryOverrides").doc(actor.uid).get();
    const override = normalizeRuntimeCountry(overrideSnap.data()?.countryCode);
    const preference = normalizeRuntimeCountry(actor.profile?.preferences?.countryCode || actor.profile?.countryCode);
    if (override) { country = override; source = "admin_override"; }
    else if (!country && preference) { country = preference; source = "account_preference"; }
    if (!city) city = text(actor.profile?.preferences?.city || actor.profile?.preferredCity || "", 120);
  }
  if (!country && city) { country = countryForCity(city); if (country) source = "city_inference"; }
  const services = country ? resolveServiceAvailabilitySet(settings, { country, city }) : [];
  const grants = actor?.uid ? await loadOperationGrants(firestore, actor.uid) : [];
  const operationsByService = actor ? Object.fromEntries((services || []).map((row) => [row.service, operationContext(grants, { service: row.service, country, city })])) : {};
  return { country, city, countrySource: source || "unresolved", revision: { id: settings.serviceAvailabilityRevisionId || null, number: Number(settings.serviceAvailabilityRevisionNumber || 0) }, services, operationsByService, nativeMobility: nativeMobilityReadiness(settings) };
}
export async function rideQuote({ firestore, data, actor }) {
  const pickup = normalizeMobilityPoint(data?.pickup), dropoff = normalizeMobilityPoint(data?.dropoff), serviceType = text(data?.serviceType, 24).toLowerCase();
  if (!pickup || !dropoff || !RIDE_TYPES[serviceType] || pickup.country !== dropoff.country) throw new HttpsError("invalid-argument", "Review the Ride pickup, destination and service type.");
  const settingsSnap = await firestore.collection("platformSettings").doc("global").get(); const settings = settingsSnap.exists ? settingsSnap.data() || {} : {};
  const decision = liveDecision(settings, "ride", pickup.country, pickup.city); if (!decision?.discoverable) throw new HttpsError("failed-precondition", decision?.reason || "Ride is not available here.");
  const mobility = settings.mobility || {}; ensureTerritory(pickup, mobility); if (!withinCountry(dropoff)) throw new HttpsError("failed-precondition", "The Ride destination is outside the supported country boundary.");
  const pricing = countryPricing(mobility, pickup.country, { currency: "USD", baseFare: 1.5, perKm: .65, perMinute: .12, bookingFee: .3, minimumFare: 3.5, driverSharePercent: 80 });
  if (!pricing) throw new HttpsError("failed-precondition", `Ride pricing has not been approved for ${pickup.country}.`);
  const route = await verifiedRoute(pickup, dropoff);
  const type = { ...RIDE_TYPES[serviceType], ...(pricing.serviceTypes?.[serviceType] || {}) };
  const raw = number(pricing.baseFare) + route.distanceKm * number(pricing.perKm) + route.durationMinutes * number(pricing.perMinute) + number(pricing.bookingFee); const total = Number((Math.max(number(pricing.minimumFare), raw) * number(type.multiplier || 1)).toFixed(2)); const driverPay = Number((total * Math.max(0, Math.min(100, number(pricing.driverSharePercent || 80))) / 100).toFixed(2));
  const quote = { serviceType, routeSource: route.source, routePath: route.path, serviceLabel: type.label || serviceType, seats: number(type.seats || 4), currency: String(pricing.currency || "USD").toUpperCase(), distanceKm: Number(route.distanceKm.toFixed(1)), directDistanceKm: Number(haversineKm(pickup, dropoff).toFixed(1)), durationMinutes: route.durationMinutes, baseFare: Number(number(pricing.baseFare).toFixed(2)), bookingFee: Number(number(pricing.bookingFee).toFixed(2)), total, driverPay, platformFee: Number((total - driverPay).toFixed(2)), requiredVehicleTypes: type.vehicleTypes || ["car", "van"] };
  const methods = paymentMethods(settings, mobility.cashEnabled !== false, pickup.country, pricing.currency);
  const launchAccess = await customerTransactionLaunchReadiness(firestore, settings, actor);
  const bookingAvailable = launchAccess.allowed && decision.transactable === true &&
    mobility.routingVerified === true && mobility.dispatchSchedulerVerified === true && methods.length > 0;
  const bookingReason = bookingAvailable ? "" : launchAccess.reason || decision.reason || "Ride requests are not live here yet.";
  return { ok: true, quote, serviceAvailability: decision, bookingAvailable, bookingReason, serviceTypes: Object.fromEntries(Object.entries(RIDE_TYPES).map(([key, value]) => [key, { ...value, ...(pricing.serviceTypes?.[key] || {}) }])), paymentMethods: methods };
}
export async function sendQuote({ firestore, data, actor }) {
  const pickup = normalizeMobilityPoint(data?.pickup), dropoff = normalizeMobilityPoint(data?.dropoff), parcelSize = text(data?.parcelSize, 24).toLowerCase();
  if (!pickup || !dropoff || !PARCEL_SIZES[parcelSize] || pickup.country !== dropoff.country) throw new HttpsError("invalid-argument", "Review the Send pickup, destination and parcel size.");
  const settingsSnap = await firestore.collection("platformSettings").doc("global").get(); const settings = settingsSnap.exists ? settingsSnap.data() || {} : {};
  const decision = liveDecision(settings, "send", pickup.country, pickup.city); if (!decision?.discoverable) throw new HttpsError("failed-precondition", decision?.reason || "Send is not available here.");
  const send = settings.mobility?.send || {}; ensureTerritory(pickup, send, { send: true }); if (!withinCountry(dropoff) || dropoff.country !== pickup.country) throw new HttpsError("failed-precondition", "Spotly Send supports domestic deliveries only.");
  const pricing = countryPricing(send, pickup.country, { currency: "USD", baseFare: 2, perKm: .55, bookingFee: .25, minimumFare: 3.5, driverSharePercent: 80 });
  if (!pricing) throw new HttpsError("failed-precondition", `Send pricing has not been approved for ${pickup.country}.`);
  const route = await verifiedRoute(pickup, dropoff); const size = { ...PARCEL_SIZES[parcelSize], ...(pricing.parcelSizes?.[parcelSize] || {}) };
  const raw = number(pricing.baseFare) + route.distanceKm * number(pricing.perKm) + number(pricing.bookingFee); const total = Number((Math.max(number(pricing.minimumFare), raw) * number(size.multiplier || 1)).toFixed(2)); const driverPay = Number((total * Math.max(0, Math.min(100, number(pricing.driverSharePercent || 80))) / 100).toFixed(2));
  const quote = { parcelSize, routeSource: route.source, routePath: route.path, parcelSizeLabel: size.label || parcelSize, maxKg: number(size.maxKg || 15), currency: String(pricing.currency || "USD").toUpperCase(), distanceKm: Number(route.distanceKm.toFixed(1)), durationMinutes: route.durationMinutes, baseFare: number(pricing.baseFare), bookingFee: number(pricing.bookingFee), total, driverPay, platformFee: Number((total - driverPay).toFixed(2)), requiredVehicleTypes: size.vehicleTypes || ["car", "van"], proofPhotoRequired: pricing.proofPhotoRequired === true };
  const methods = paymentMethods(settings, send.cashEnabled !== false, pickup.country, pricing.currency);
  const launchAccess = await customerTransactionLaunchReadiness(firestore, settings, actor);
  const bookingAvailable = launchAccess.allowed && decision.transactable === true &&
    send.routingVerified === true && send.dispatchSchedulerVerified === true && methods.length > 0;
  const bookingReason = bookingAvailable ? "" : launchAccess.reason || decision.reason || "Send requests are not live here yet.";
  return { ok: true, quote, parcelSizes: Object.fromEntries(Object.entries(PARCEL_SIZES).map(([key, value]) => [key, { ...value, ...(pricing.parcelSizes?.[key] || {}) }])), paymentMethods: methods, scheduledEnabled: send.scheduledEnabled !== false, serviceAvailability: decision, bookingAvailable, bookingReason };
}

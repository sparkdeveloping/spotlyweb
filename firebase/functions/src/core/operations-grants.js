import { HttpsError } from "firebase-functions/v2/https";

export const OPERATION_GRANT_TYPES = Object.freeze(["service_preview", "service_operations", "payment_sandbox", "location_override", "driver_operations"]);
const TYPES = new Set(OPERATION_GRANT_TYPES);

function date(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function listMatches(values, requested) { return !Array.isArray(values) || values.length === 0 ? true : Boolean(requested && values.includes(requested)); }
function cityKey(country, city) { return country && city ? `${String(country).toUpperCase()}:${String(city).trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}` : ""; }

export function operationGrantMatches(grant, { type, service = "", country = "", city = "", now = new Date() } = {}) {
  const requestedType = String(type || "").trim();
  const grantType = String(grant?.type || "").trim();
  if (!TYPES.has(requestedType) || !TYPES.has(grantType) || grant?.status !== "active") return false;
  const expiry = date(grant.expiresAt);
  if (!expiry || expiry.getTime() <= now.getTime()) return false;
  if (!(grantType === requestedType || (requestedType === "service_preview" && grantType === "service_operations"))) return false;
  const normalizedCountry = String(country || "").trim().toUpperCase();
  if (!listMatches(grant.services, String(service || "").trim().toLowerCase())) return false;
  if (!listMatches(grant.countries, normalizedCountry)) return false;
  if (!listMatches(grant.cities, cityKey(normalizedCountry, city))) return false;
  return true;
}

export function operationContext(grants = [], scope = {}) {
  const has = (type) => grants.some((grant) => operationGrantMatches(grant, { ...scope, type }));
  return { servicePreview: has("service_preview"), serviceOperations: has("service_operations"), paymentSandbox: has("payment_sandbox"), locationOverride: has("location_override"), driverOperations: has("driver_operations") };
}

export async function loadOperationGrants(firestore, userId) {
  const snapshot = await firestore.collection("operationGrants").where("userId", "==", userId).limit(100).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })).filter((grant) => operationGrantMatches(grant, { type: grant.type }));
}

export function requireOperationGrant(grants, scope) {
  if (!grants.some((grant) => operationGrantMatches(grant, scope))) throw new HttpsError("permission-denied", "This account does not have the required Operations grant for this action.");
}

export function serializeGrant(grant) {
  return { id: grant.id || "", type: grant.type || "", services: Array.isArray(grant.services) ? grant.services : [], countries: Array.isArray(grant.countries) ? grant.countries : [], cities: Array.isArray(grant.cities) ? grant.cities : [], expiresAt: date(grant.expiresAt)?.toISOString() || null, reason: grant.reason || "" };
}

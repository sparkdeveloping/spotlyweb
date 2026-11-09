import { normalizeCountryCode } from "./country-engine.js";
import { normalizeServiceId, serviceAvailabilityCityKey } from "./service-availability.js";

export const OPERATION_GRANT_TYPES = Object.freeze([
  "service_preview",
  "service_operations",
  "payment_sandbox",
  "location_override",
  "driver_operations"
]);

const TYPE_SET = new Set(OPERATION_GRANT_TYPES);

export function normalizeOperationGrantType(value) {
  const type = String(value || "").trim().toLowerCase();
  return TYPE_SET.has(type) ? type : null;
}

function asDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function operationGrantActive(grant, now = new Date()) {
  if (!grant || grant.status !== "active") return false;
  const expiresAt = asDate(grant.expiresAt);
  return Boolean(expiresAt && expiresAt.getTime() > now.getTime());
}

function scopeMatches(values, requested) {
  if (!Array.isArray(values) || values.length === 0) return true;
  if (!requested) return false;
  return values.includes(requested);
}

export function operationGrantMatches(grant, { type, service = "", country = "", city = "", now = new Date() } = {}) {
  const requestedType = normalizeOperationGrantType(type);
  const grantType = normalizeOperationGrantType(grant?.type);
  if (!requestedType || !grantType || !operationGrantActive(grant, now)) return false;
  const typeMatches = grantType === requestedType || (requestedType === "service_preview" && grantType === "service_operations");
  if (!typeMatches) return false;
  const serviceId = service ? normalizeServiceId(service) : null;
  const countryCode = country ? normalizeCountryCode(country) : null;
  const cityKey = countryCode && city ? serviceAvailabilityCityKey(countryCode, city) : null;
  if (!scopeMatches(grant.services, serviceId)) return false;
  if (!scopeMatches(grant.countries, countryCode)) return false;
  if (!scopeMatches(grant.cities, cityKey)) return false;
  return true;
}

export function hasOperationGrant(grants = [], context = {}) {
  return grants.some((grant) => operationGrantMatches(grant, context));
}

export function operationContext(grants = [], { service = "", country = "", city = "", now = new Date() } = {}) {
  return {
    servicePreview: hasOperationGrant(grants, { type: "service_preview", service, country, city, now }),
    serviceOperations: hasOperationGrant(grants, { type: "service_operations", service, country, city, now }),
    paymentSandbox: hasOperationGrant(grants, { type: "payment_sandbox", service, country, city, now }),
    locationOverride: hasOperationGrant(grants, { type: "location_override", service, country, city, now }),
    driverOperations: hasOperationGrant(grants, { type: "driver_operations", service, country, city, now })
  };
}

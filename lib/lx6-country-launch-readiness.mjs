/**
 * LX6 release evidence evaluator. Advisory until SPOTLY_LX6_ENFORCE_COUNTRY_LAUNCH_GATE=true.
 * A populated settings object is NOT proof a regulator granted an authorization;
 * reviewers must inspect evidence and obtain jurisdiction-specific legal advice.
 * Never use this to compute charges or authorize a driver, merchant or payment.
 */
const SUPPORTED = new Set(["ZW", "MW"]);
const SERVICES = new Set(["ride", "send", "business"]);
const BASE = ["privacyReview", "legalEntity", "supportResponse", "financialSettlement"];
const SERVICE = {
  ride: ["transportAuthorityReview", "driverVehicleVerification", "safetyResponse"],
  send: ["deliveryAuthorityReview", "driverVehicleVerification"],
  business: ["merchantAgreement", "merchantVerification"]
};

function validEvidence(entry, now) {
  if (!entry || typeof entry !== "object" || entry.status !== "approved") return false;
  if (typeof entry.reviewedBy !== "string" || !entry.reviewedBy.trim()) return false;
  if (typeof entry.evidenceRef !== "string" || !entry.evidenceRef.trim()) return false;
  const date = Date.parse(entry.reviewedAt || "");
  if (!Number.isFinite(date) || date > now) return false;
  if (entry.expiresAt) {
    const expiry = Date.parse(entry.expiresAt);
    if (!Number.isFinite(expiry) || expiry <= now) return false;
  }
  return true;
}

export function countryLaunchReadiness(settings = {}, country, service, now = Date.now()) {
  if (!SUPPORTED.has(country) || !SERVICES.has(service)) {
    return { country, service, ready: false, blockers: ["unsupported-country-or-service"] };
  }
  // Avoid implicit global fallback: ZW approval must never approve MW, or Ride approve Send.
  const scoped = settings.launchCompliance?.[country]?.[service] || {};
  const requirements = [...BASE, ...SERVICE[service]];
  const blockers = requirements.filter((requirement) => !validEvidence(scoped[requirement], now));
  return { country, service, ready: blockers.length === 0, blockers, verifiedCount: requirements.length - blockers.length, requiredCount: requirements.length };
}

export const LX6_COUNTRIES = Object.freeze(["ZW", "MW"]);
export const LX6_SERVICES = Object.freeze(["ride", "send", "business"]);

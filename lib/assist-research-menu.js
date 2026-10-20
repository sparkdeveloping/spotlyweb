/**
 * Spotly Assist uses independently checked factual price references,
 * never auto-imported merchant products. Review is branch-scoped.
 */
export const ASSIST_PRICE_MAX_AGE_MS = 14 * 86400_000;
export const ASSIST_RESEARCH_NOTICE = "Independent Spotly shopping; this restaurant is not necessarily a Spotly partner. Items and estimated prices must be reconfirmed before any purchase.";

export function simpleBrand(value) {
  return String(value || "").trim().toLowerCase().normalize("NFKD")
    .replace(/[\u0027\u2019]/g, "").replace(/[^a-z0-9]+/g, " ").replace(/\b(zimbabwe|restaurant|harare|location|branch)\b/g, " ")
    .replace(/\s+/g, " ").trim();
}
export function brandCompatible(restaurant, reference) {
  const a = simpleBrand(restaurant);
  const b = simpleBrand(reference);
  return Boolean(a && b && a === b);
}
function atMillis(value) {
  if (value?.toMillis) return value.toMillis();
  if (value?.toDate) return value.toDate().getTime();
  const date = Date.parse(String(value || ""));
  return Number.isFinite(date) ? date : NaN;
}
export function verifiedResearchPrice(price = {}, brand = "", now = Date.now()) {
  const review = price.priceReview;
  const time = atMillis(price.priceCheckedAt);
  const amount = review?.verifiedPrice;
  return brandCompatible(brand, price.brand) &&
    price.status === "independently_verified_reference" &&
    review?.decision === "verified" &&
    ["in_person","phone","business_confirmed"].includes(review?.method) &&
    review?.factualDataRightsReviewed === true &&
    price.currency === "USD" &&
    typeof amount === "number" && Number.isFinite(amount) && amount >= 0 && amount <= 100000 &&
    Number.isFinite(time) && time <= now && now - time <= ASSIST_PRICE_MAX_AGE_MS;
}
export function claimSafeUnpartnered(record = {}) {
  const claims = String(record.claimStatus || record.ownershipStatus || "").toLowerCase();
  return record.country === "ZW" &&
    record.public === true && record.status !== "archived" && record.status !== "removed" &&
    !["claimed","owner_verified","claim_pending","claimed_pending_verification"].includes(claims) &&
    (!Array.isArray(record.ownerIds) || record.ownerIds.length === 0) &&
    record.commerceEnabled !== true && record.commerceVerified !== true &&
    record.verificationStatus !== "approved" && record.verificationStatus !== "verified";
}
export function canonicalStoreId(businessId) {
  if (!/^[a-zA-Z0-9_-]{4,160}$/.test(businessId)) throw new Error("Invalid business.");
  return "assistresearch_" + businessId;
}

import { marketplaceTrust } from "./marketplace-trust.js";
import { marketplaceEditorial } from "./marketplace-curation.js";

// Stable, explainable merchandising tiers. Unverified directory imports can
// appear in Search, but must never displace genuinely usable services.
export function marketplaceTier(record = {}) {
  const trust = marketplaceTrust(record);
  const commerce = record.commerce || trust.commerce;
  if (trust.commerceVerified && (commerce.merchantOrdering || commerce.booking || commerce.ticketing || commerce.pickup || commerce.merchantDelivery)) return 4;
  // Assist must be explicitly enabled by the platform. A research import alone
  // never claims that an order is possible.
  if ((record.assistStoreId && record.assistAccepting !== false) || record.spotlyAssistEnabled === true || record.assistOrderable === true || record.assistRequestAvailable === true) return 3;
  if (trust.commerceVerified || trust.verified || trust.claimed) return 2;
  return 1;
}

export function marketplaceRank(record = {}, { distance = null } = {}) {
  const tier = marketplaceTier(record);
  const count = Math.max(0, Number(record.reviewCount || 0));
  const rating = Math.min(5, Math.max(0, Number(record.rating || 0)));
  const distanceBonus = Number.isFinite(distance) && distance >= 0 ? Math.max(0, 15 - Math.min(distance, 15)) : 0;
  // Featured boosts within the same tier only, never across commerce-readiness.
  const editorial = marketplaceEditorial(record);
  // Unverified imported listings cannot buy a strong ranking with a stale featured flag.
  const score = editorial.score + (record.isFeatured && tier >= 2 ? 15 : 0) +
    Math.min(18, Math.log1p(count) * 3) +
    (count >= 5 ? rating * 2 : 0) +
    distanceBonus +
    (record.coverImage || record.image ? 3 : 0);
  return { tier, score, editorial };
}

export function compareMarketplaceBusinesses(left, right) {
  const a = left.business || left, b = right.business || right;
  const ar = marketplaceRank(a, { distance: left.distance });
  const br = marketplaceRank(b, { distance: right.distance });
  return br.tier - ar.tier || br.score - ar.score ||
    String(a.name || "").localeCompare(String(b.name || ""));
}

export function rankMarketplaceBusinesses(rows = []) {
  return [...rows].sort(compareMarketplaceBusinesses);
}

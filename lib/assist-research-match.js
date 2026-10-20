/**
 * Read-only similarity signals for provisional restaurant research.
 * These are REVIEW suggestions, never approval or ownership decisions.
 */
export function normalizeRestaurantText(value) {
  return String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
const normalizedPhone = value => String(value || "").replace(/\D/g, "").replace(/^00/, "").slice(-9);
const same = (a, b) => Boolean(a && b && a === b);
function similarAddress(a, b) {
  const na = normalizeRestaurantText(a);
  const nb = normalizeRestaurantText(b);
  if (!na || !nb) return false;
  if (na === nb || (na.length > 12 && nb.includes(na)) || (nb.length > 12 && na.includes(nb))) return true;
  const ignored = new Set(["road", "street", "shop", "avenue", "harare", "bulawayo", "city", "centre", "center", "the", "and", "mall", "unit", "zw", "zimbabwe"]);
  const termsA = new Set(na.split(" ").filter(x => x.length >= 3 && !ignored.has(x)));
  const termsB = new Set(nb.split(" ").filter(x => x.length >= 3 && !ignored.has(x)));
  const common = [...termsA].filter(x => termsB.has(x)).length;
  const minCount = Math.min(termsA.size, termsB.size);
  return minCount >= 2 && common >= 2 && common / minCount >= .6;
}
export function restaurantMatchSignals(research, official) {
  const cityA = normalizeRestaurantText(research.city);
  const cityB = normalizeRestaurantText(official.city);
  if (!cityA || !cityB || cityA !== cityB) return null;
  const nameA = normalizeRestaurantText(research.name);
  const nameB = normalizeRestaurantText(official.name || official.displayName);
  const brandA = normalizeRestaurantText(research.brandName);
  const brandB = normalizeRestaurantText(official.brandName);
  const phoneA = normalizedPhone(research.phone);
  const phoneB = normalizedPhone(official.phone);
  const phoneMatch = phoneA.length === 9 && same(phoneA, phoneB);
  const nameMatch = same(nameA, nameB);
  const brandMatch = same(brandA, brandB) || same(nameA, brandB) || same(brandA, nameB);
  const addressMatch = similarAddress(research.address, official.address);
  const reasons = [];
  let score = 0;
  if (nameMatch) { score += 55; reasons.push("same_name_and_city"); }
  if (brandMatch && !nameMatch) { score += 22; reasons.push("same_brand_and_city"); }
  if (addressMatch) { score += 34; reasons.push("similar_address"); }
  if (phoneMatch) { score += 45; reasons.push("matching_phone"); }
  if (score < 22) return null;
  const rank = nameMatch && (addressMatch || phoneMatch) || (addressMatch && phoneMatch)
    ? "high" : (addressMatch || phoneMatch || nameMatch ? "review" : "brand_only");
  return { score, rank, reasons };
}
export function rankRestaurantCandidates(research, candidates, max = 5) {
  return candidates
    .map(candidate => ({ candidate, match: restaurantMatchSignals(research, candidate) }))
    .filter(item => item.match)
    .sort((a,b) => b.match.score - a.match.score)
    .slice(0, max);
}

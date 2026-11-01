// Discovery groups are a view of locations, never a replacement for operational IDs.
import { foodBrandKeys } from "./food-brand.js";
export const normalizedBusinessName = (value = "") => String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
const BRANDS = [
  [/^bon\s*marche(?:\s|$)/, "Bon Marché"],
  [/^(?:tm\s*)?pick\s*(?:n|and)?\s*pay(?:\s|$)/, "Pick n Pay"],
  [/^chicken inn(?:\s|$)/, "Chicken Inn"], [/^pizza inn(?:\s|$)/, "Pizza Inn"],
  [/^creamy inn(?:\s|$)/, "Creamy Inn"], [/^bakers inn(?:\s|$)/, "Baker’s Inn"],
  [/^nandos(?:\s|$)/, "Nando’s"], [/^kfc(?:\s|$)/, "KFC"],
  [/^cafe nush(?:\s|$)/, "Cafe Nush"], [/^roco ?mamas(?:\s|$)/, "RocoMamas"], [/^steers(?:\s|$)/, "Steers"],
  [/^chicken slice(?:\s|$)/, "Chicken Slice"], [/^chop chop(?:\s|$)/, "Chop Chop"], [/^doppio zero(?:\s|$)/, "Doppio Zero"],
  [/(?:^|\s)o\s*k(?:\s|$)/, "OK"], [/^tm(?:\s|$)/, "Pick n Pay"], [/^pnp(?:\s|$)/, "Pick n Pay"],
  [/(?:^|\s)spar(?:\s|$)/, "SPAR"], [/^choppies(?:\s|$)/, "Choppies"],
  [/^food lovers? market(?:\s|$)/, "Food Lover’s Market"], [/^food\s*world(?:\s|$)/, "Food World"],
  [/^shop (?:and )?go(?:\s|$)/, "Shop & Go"], [/^texas meats(?:\s|$)/, "Texas Meats"],
  [/^electrosales(?:\s|$)/, "Electrosales"], [/^edgars(?:\s|$)/, "Edgars"]
];
export function businessBrand(record = {}) {
  if (foodBrandKeys({ name: record.name }).length > 1) return String(record.name).trim();
  const named = BRANDS.find(([pattern]) => pattern.test(normalizedBusinessName(record.name)));
  if (named) return named[1];
  const name = normalizedBusinessName(record.brandName || record.sourceTags?.brand || record.name);
  return BRANDS.find(([pattern]) => pattern.test(name))?.[1] || String(record.brandName || record.sourceTags?.brand || record.name || "Business").trim();
}
export function businessGroupKey(record = {}) {
  const brand = normalizedBusinessName(businessBrand(record));
  const generic = /^(business|store|shop|pharmacy|supermarket|restaurant|salon|school|market|bar|cafe)$/.test(brand);
  const known = BRANDS.some(([pattern])=>pattern.test(brand));
  const subtype = /alcohol|liquor|bottle|wine/.test(normalizedBusinessName([record.name, record.category, record.sourceTags?.shop].join(" "))) ? "bottle" : known ? "brand" : record.businessType || "business";
  return [record.country || "ZW", normalizedBusinessName(record.city), generic ? record.id : brand, subtype].join("|");
}
function coordinates(record) {
  const lat = record.latitude ?? record.coordinates?.lat ?? record.location?.lat;
  const lng = record.longitude ?? record.coordinates?.lng ?? record.location?.lng;
  return lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) ? [Number(lat), Number(lng)] : null;
}
function close(a, b) {
  const x = coordinates(a), y = coordinates(b);
  if (!x || !y) return false;
  const rad = Math.PI / 180;
  const dLat = (y[0] - x[0]) * rad, dLng = (y[1] - x[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(x[0] * rad) * Math.cos(y[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 12742000 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) <= 60;
}
export function businessLocationLabel(record = {}, index = 0) {
  const brand = normalizedBusinessName(businessBrand(record));
  const suffix = normalizedBusinessName(record.name).startsWith(brand) ? String(record.name).slice(businessBrand(record).length).trim() : "";
  return record.branchName || record.area || record.suburb || record.address || suffix || `${record.city || "Map"} · Location ${index + 1}`;
}
export function groupMarketplaceBusinesses(records = []) {
  const groups = new Map();
  for (const record of records) {
    const key = businessGroupKey(record);
    const items = groups.get(key) || [];
    if (!items.some(item => item.id === record.id)) items.push(record);
    groups.set(key, items);
  }
  return [...groups.entries()].map(([key, candidates]) => {
    const ranked = [...candidates].sort((a, b) => Number(Boolean(b.commerceVerified)) - Number(Boolean(a.commerceVerified)) || Number(Boolean(b.address || b.area)) - Number(Boolean(a.address || a.area)) || String(a.id).localeCompare(String(b.id)));
    const locations = [];
    for (const item of ranked) {
      // Only coalesce imported points for the same physical branch. Merchant IDs stay separate.
      if (!locations.some(other => !item.commerceVerified && !other.commerceVerified && close(other, item))) locations.push(item);
    }
    locations.sort((a, b) => String(a.area || a.address || a.name).localeCompare(String(b.area || b.address || b.name)) || String(a.id).localeCompare(String(b.id)));
    const representative = ranked[0];
    if (locations.length === 1 && candidates.length === 1) return representative;
    return { ...representative, name: businessBrand(representative), discoveryGroupKey: key,
      groupedLocations: locations.map((item, index) => ({ id: item.id, name: item.name, branchName: businessLocationLabel(item, index), city: item.city || "", area: item.area || "", address: item.address || "", coordinates: item.coordinates || null, latitude: item.latitude ?? null, longitude: item.longitude ?? null, commerceVerified: item.commerceVerified === true })),
      locationCount: locations.length, branchCount: locations.length };
  });
}

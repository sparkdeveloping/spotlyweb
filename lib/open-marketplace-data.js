import "server-only";
import placeDataset from "@/lib/generated/open-marketplace-places";
import productDataset from "@/lib/generated/open-marketplace-products";
import { publicTrustRecord } from "@/lib/marketplace-trust";
import { enrichMarketplaceProduct } from "@/lib/marketplace-product-taxonomy";
import { SPOTLY_MENU_BUSINESSES } from "../data/spotly-restaurant-menus.js";

// Curated datasets are compiled into normal JavaScript modules. This avoids both
// runtime filesystem reads and Git/Vercel omissions caused by blanket JSON ignore rules.
export function openPlaceDataset() {
  return placeDataset;
}

export function openProductDataset() {
  return productDataset;
}

export function openPlaces() { return [...(openPlaceDataset().records || []), ...SPOTLY_MENU_BUSINESSES]; }
export function openProducts() { return openProductDataset().records || []; }
export function openPlaceById(id) { return openPlaces().find((item) => item.id === id) || null; }
export function openProductById(id) { return openProducts().find((item) => item.id === id) || null; }

function norm(value = "") { return String(value || "").trim().toLowerCase(); }
function haystack(record = {}) { return [record.name, record.brandName, record.category, ...(record.categories || []), record.city, record.area, record.address, ...(record.aliases || [])].filter(Boolean).join(" ").toLowerCase(); }

function distanceMeters(a = {}, b = {}) {
  const lat1 = Number(a.latitude ?? a.lat); const lon1 = Number(a.longitude ?? a.lng);
  const lat2 = Number(b.latitude ?? b.lat); const lon2 = Number(b.longitude ?? b.lng);
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return Number.POSITIVE_INFINITY;
  const toRad = (value) => value * Math.PI / 180;
  const dLat = toRad(lat2 - lat1); const dLon = toRad(lon2 - lon1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function placeDetailScore(place = {}) {
  return [place.area, place.address, place.phone, place.website, place.image, place.openingHours].reduce((score, value) => score + (value ? 1 : 0), 0);
}

export function dedupeOpenPlaces(records = []) {
  const groups = new Map();
  for (const place of records) {
    const key = `${norm(place.name || place.brandName)}|${norm(place.city)}`;
    if (!key.split("|")[0]) { groups.set(`id:${place.id}`, [place]); continue; }
    const candidates = groups.get(key) || [];
    const duplicateIndex = candidates.findIndex((candidate) => {
      const close = distanceMeters(candidate, place) <= 150;
      const addressMatch = norm(candidate.address) && norm(candidate.address) === norm(place.address);
      const areaMatch = norm(candidate.area) && norm(candidate.area) === norm(place.area);
      return close || addressMatch || areaMatch;
    });
    if (duplicateIndex < 0) candidates.push(place);
    else if (placeDetailScore(place) > placeDetailScore(candidates[duplicateIndex])) candidates[duplicateIndex] = place;
    groups.set(key, candidates);
  }
  return [...groups.values()].flat();
}

export function placeMatchesService(service, place = {}) {
  const type = String(place.businessType || "");
  const category = norm(place.category);
  if (service === "eat") return type === "restaurant_food" || ["restaurants", "nightlife"].includes(category);
  if (service === "shop") return type === "grocery_retail" || ["groceries","retail","pharmacy","fashion","electronics","hardware","home & living","shopping centre","automotive"].includes(category);
  if (service === "book") return type === "appointments_services" || ["beauty & wellness","fitness","health","professional services","home & auto services"].includes(category);
  if (service === "events") return type === "ticketing_events" || ["events & activities","activities"].includes(category);
  return true;
}

export function queryOpenPlaces({ city = "", q = "", service = "", limit = 250, offset = 0 } = {}) {
  const cityKey = norm(city); const terms = norm(q).split(/\s+/).filter((x) => x.length >= 2);
  const records = dedupeOpenPlaces(openPlaces().filter((item) => (!cityKey || norm(item.city) === cityKey) && (!service || placeMatchesService(service, item)) && (!terms.length || terms.every((term) => haystack(item).includes(term)))));
  return { total: records.length, records: records.slice(offset, offset + limit).map((item) => ({ ...item, ...publicTrustRecord(item), curated: true })) };
}

export function queryOpenProducts({ q = "", limit = 80, offset = 0 } = {}) {
  const terms = norm(q).split(/\s+/).filter((x) => x.length >= 2);
  const records = openProducts().filter((item) => !item.ageRestricted).map(enrichMarketplaceProduct).filter((item) => !terms.length || terms.every((term) => [item.canonicalName, item.brand, item.packSize, ...(item.categoryPath || []), ...(item.searchTerms || [])].join(" ").toLowerCase().includes(term)));
  return { total: records.length, records: records.slice(offset, offset + limit) };
}

export function mergeCuratedWithFirestore(curated = [], firestore = []) {
  const byId = new Map(curated.map((item) => [item.id, item]));
  for (const item of firestore) byId.set(item.id, { ...(byId.get(item.id) || {}), ...item, curated: Boolean(byId.get(item.id)?.curated || item.curated) });
  return [...byId.values()];
}

export function marketplaceDataSummary() {
  const place = openPlaceDataset(); const product = openProductDataset();
  return { places: place.meta, products: product.meta };
}

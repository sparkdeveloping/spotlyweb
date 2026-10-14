import "server-only";
import placeDataset from "@/data/open-marketplace/zimbabwe-open-places.json";
import productDataset from "@/data/open-marketplace/zimbabwe-open-products.json";
import { publicTrustRecord } from "@/lib/marketplace-trust";

// Static JSON imports are intentional. Next/Vercel traces these datasets into the
// server function bundle; dynamic runtime filesystem reads may be omitted from
// serverless bundles and caused production marketplace 500s.
export function openPlaceDataset() {
  return placeDataset;
}

export function openProductDataset() {
  return productDataset;
}

export function openPlaces() { return openPlaceDataset().records || []; }
export function openProducts() { return openProductDataset().records || []; }
export function openPlaceById(id) { return openPlaces().find((item) => item.id === id) || null; }
export function openProductById(id) { return openProducts().find((item) => item.id === id) || null; }

function norm(value = "") { return String(value || "").trim().toLowerCase(); }
function haystack(record = {}) { return [record.name, record.brandName, record.category, ...(record.categories || []), record.city, record.area, record.address, ...(record.aliases || [])].filter(Boolean).join(" ").toLowerCase(); }

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
  const records = openPlaces().filter((item) => (!cityKey || norm(item.city) === cityKey) && (!service || placeMatchesService(service, item)) && (!terms.length || terms.every((term) => haystack(item).includes(term))));
  return { total: records.length, records: records.slice(offset, offset + limit).map((item) => ({ ...item, ...publicTrustRecord(item), curated: true })) };
}

export function queryOpenProducts({ q = "", limit = 80, offset = 0 } = {}) {
  const terms = norm(q).split(/\s+/).filter((x) => x.length >= 2);
  const records = openProducts().filter((item) => !item.ageRestricted && (!terms.length || terms.every((term) => [item.canonicalName, item.brand, item.packSize, ...(item.categoryPath || []), ...(item.searchTerms || [])].join(" ").toLowerCase().includes(term))));
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

import { businessPhotoFamily } from "./business-photography.js";
import { marketplaceProfile } from "./marketplace-taxonomy.js";
import { marketplaceTrust } from "./marketplace-trust.js";
import { menuItemsForBusiness } from "../data/spotly-restaurant-menus.js";
import { retailItemsForBusiness, retailCatalogueScope, SPOTLY_CATALOGUE_VERSION } from "../data/spotly-retail-products.js";
import { foodBrandKeys } from "./food-brand.js";

const RESTRICTED = new Set(["betting-shop", "tobacco-shop", "bottle-store", "banking", "fuel-station", "fuel-supplies", "gas-supplies", "medical-supplies"]);
export function catalogueService(record = {}) {
  if (record.assistService) return record.assistService;
  if (foodBrandKeys(record).length && ["fried-chicken","grilled-chicken","pizza","burger","cafe","bakery","ice-cream","takeaway","restaurant-interior","asian-food"].includes(businessPhotoFamily(record))) return "eat";
  return record.assistService || (marketplaceProfile(record).service === "eat" ? "eat" : "shop");
}
export function directoryShoppingEligible(record = {}) {
  const trust = marketplaceTrust(record), service = marketplaceProfile(record).service;
  const claims = [record.claimStatus,record.ownershipStatus].filter(Boolean).map(value=>String(value).toLowerCase());
  if (claims.some(value=>value !== "unclaimed") || record.ownerIds?.length || record.claimed === true) return false;
  return trust.discoveryAllowed && !trust.commerceVerified && !trust.claimed && !["claim_pending"].includes(trust.trustState) &&
    (record.country || "ZW") === "ZW" && ["eat", "shop"].includes(service) && record.assistAccepting !== false &&
    record.ageRestricted !== true && !RESTRICTED.has(businessPhotoFamily(record)) && !["archived", "removed", "closed"].includes(record.status);
}
export const directoryStoreId = (id, branchId = "") => `directory_${id}${branchId ? `__branch__${branchId}` : ""}`;
export function spotlyCatalogueItems(record = {}) {
  const menu = menuItemsForBusiness(record);
  if (menu.length) return menu;
  return catalogueService(record) === "shop" ? retailItemsForBusiness(record) : [];
}
export function directoryIntakeStore(id, record = {}) {
  if (!directoryShoppingEligible(record)) return null;
  const items = spotlyCatalogueItems(record);
  return { id: directoryStoreId(id), directoryBusinessId: id, name: record.name, city: record.city || "", country: record.country || "ZW", currency: "USD", area: record.area || record.suburb || "", address: record.address || "", coordinates: record.coordinates || null,
    category: record.category || "Business", businessType: record.businessType, sourceTags: record.sourceTags || {},
    status: "published", assistAccepting: true, affiliation: "unaffiliated", sourcingModel: "independent_in_person", catalogueMode: "quote_first", assistService: catalogueService(record),
    operationalReviewed: false, financeReady: false, catalogueOrigin: "spotly_reference", catalogueVersion: SPOTLY_CATALOGUE_VERSION,
    catalogueScope: items.some(item=>item.catalogueKind === "menu_reference") ? "menu" : retailCatalogueScope(record,items), items };
}

// Automatically materialized catalogues follow reviewed source updates. Manual
// operator catalogues and all operational pauses/readiness fields stay intact.
export function refreshDirectoryCatalogue(saved, seed) {
  const oldAutomatic = !saved.catalogueOrigin && Array.isArray(saved.items) && saved.items.length > 0 && saved.items.every(item=>item.catalogueKind === "request_suggestion" || /^menu_(?:doppio-zero-harare|fishmonger-chisipite)_/.test(item.id || ""));
  if (!seed || !(saved.catalogueOrigin === "spotly_reference" || oldAutomatic)) return saved;
  return {...saved,items:seed.items,catalogueOrigin:seed.catalogueOrigin,catalogueVersion:seed.catalogueVersion,catalogueScope:seed.catalogueScope};
}

export function directoryBookingEligible(record = {}) {
  return marketplaceTrust(record).discoveryAllowed && !marketplaceTrust(record).commerceVerified && (record.country || "ZW") === "ZW" && marketplaceProfile(record).service === "book" && record.assistAccepting !== false && !["clinic", "dental", "medical-supplies", "pharmacy", "optometry"].includes(businessPhotoFamily(record));
}

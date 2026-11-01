import { businessPhotoFamily } from "./business-photography.js";
import { marketplaceProfile } from "./marketplace-taxonomy.js";
import { marketplaceTrust } from "./marketplace-trust.js";
import { menuItemsForBusiness } from "../data/spotly-restaurant-menus.js";

// Request suggestions are Spotly-authored shopping intents, not claims of store stock.
const SUGGESTIONS = {
  supermarket: ["Bread", "Milk", "Eggs", "Rice", "Maize meal", "Cooking oil", "Fresh vegetables", "Fresh fruit", "Household cleaning supplies"],
  convenience: ["Bread", "Milk", "Bottled water", "Snacks", "Everyday essentials"],
  "fresh-produce": ["Fresh vegetables", "Fresh fruit", "Potatoes", "Tomatoes", "Onions"],
  butchery: ["Beef", "Chicken", "Sausages"], bakery: ["Bread", "Bread rolls", "Pastries", "Cake enquiry"],
  "fried-chicken": ["Chicken and chips", "Chicken pieces", "Family chicken meal", "Chips", "Soft drink"],
  "grilled-chicken": ["Grilled chicken meal", "Chicken and chips", "Family chicken meal", "Sides", "Soft drink"],
  pizza: ["Pizza", "Family pizza order", "Sides", "Soft drink"], "ice-cream": ["Ice cream", "Milkshake", "Dessert"],
  cafe: ["Coffee", "Tea", "Breakfast", "Sandwich", "Pastry"],
  burger: ["Burger", "Burger meal", "Chips", "Soft drink"],
  pharmacy: ["Personal care essentials", "Toiletries", "Baby care essentials"],
  electronics: ["Phone accessories", "Charger or cable", "Headphones", "Electronics enquiry"],
  appliances: ["Kitchen appliance enquiry", "Home appliance enquiry", "Appliance accessories"],
  hardware: ["Hand tools", "Fasteners", "Plumbing supplies", "Electrical accessories"],
  fashion: ["Clothing enquiry", "Accessories", "Specific size or colour request"], footwear: ["Shoes", "Specific shoe size request"],
  stationery: ["Notebooks", "Pens", "Printer paper", "School supplies"], bookshop: ["Book enquiry", "School books", "Stationery"],
  "beauty-products": ["Hair care", "Skin care", "Beauty accessories"], florist: ["Flower bouquet", "Occasion arrangement"],
  gifts: ["Gift enquiry", "Gift wrapping", "Greeting card"], "pet-supplies": ["Pet food", "Pet accessories"],
  "auto-parts": ["Vehicle part enquiry", "Tyre enquiry", "Car accessories"], furniture: ["Furniture enquiry", "Home accessories"],
  homeware: ["Kitchenware", "Home essentials", "Household accessories"], toys: ["Toy enquiry", "Children’s gift"],
  "agricultural-supplies": ["Seeds", "Garden tools", "Farming supplies enquiry"], "solar-equipment": ["Solar equipment enquiry", "Solar accessories"],
};
const RESTRICTED = new Set(["betting-shop", "tobacco-shop", "bottle-store", "banking", "fuel-station", "fuel-supplies", "gas-supplies", "medical-supplies"]);
export function catalogueService(record = {}) {
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
  const family = businessPhotoFamily(record);
  const names = SUGGESTIONS[family] || (catalogueService(record) === "eat" ? ["Meal request", "Side dish", "Drink", "Something specific from the menu"] : ["Item enquiry", "Everyday supplies", "Something specific from this shop"]);
  return names.map((name, index) => ({ id: `request_${family}_${index + 1}`, name, category: "Shopping requests", unit: "", priceEstimate: null, priceCheckedAt: null, priceStatus: "to_confirm", status: "requestable", catalogueKind: "request_suggestion" }));
}
export function directoryIntakeStore(id, record = {}) {
  if (!directoryShoppingEligible(record)) return null;
  return { id: directoryStoreId(id), directoryBusinessId: id, name: record.name, city: record.city || "", country: record.country || "ZW", currency: "USD", area: record.area || record.suburb || "", address: record.address || "", coordinates: record.coordinates || null,
    category: record.category || "Business", businessType: record.businessType, sourceTags: record.sourceTags || {},
    status: "published", assistAccepting: true, affiliation: "unaffiliated", sourcingModel: "independent_in_person", catalogueMode: "quote_first", assistService: catalogueService(record),
    operationalReviewed: false, financeReady: false, items: spotlyCatalogueItems(record) };
}

export function directoryBookingEligible(record = {}) {
  return marketplaceTrust(record).discoveryAllowed && !marketplaceTrust(record).commerceVerified && (record.country || "ZW") === "ZW" && marketplaceProfile(record).service === "book" && record.assistAccepting !== false && !["clinic", "dental", "medical-supplies", "pharmacy", "optometry"].includes(businessPhotoFamily(record));
}

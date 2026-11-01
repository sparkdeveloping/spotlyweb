import catalogues from "./spotly-specific-catalogues.js";
import { foodBrandKeys, normalizeFoodName } from "../lib/food-brand.js";

export const SPOTLY_RESTAURANT_MENUS = catalogues.menus;
function locationMatches(scope, record) {
  if (!scope) return true;
  const place = normalizeFoodName([record.name, record.branchName, record.area, record.suburb, record.address].filter(Boolean).join(" "));
  const locations = scope === "Highland Park" ? ["highland park", "highlands"] : scope === "Chitepo and Avondale" ? ["chitepo", "avondale"] : [normalizeFoodName(scope)];
  return locations.some(location=>place.includes(location));
}
export function menuItemsForBusiness(record = {}) {
  if ((record.country || "ZW") !== "ZW") return [];
  const brands = foodBrandKeys(record);
  return SPOTLY_RESTAURANT_MENUS.filter(menu => brands.includes(menu.key) && (!menu.city || normalizeFoodName(record.city) === normalizeFoodName(menu.city)))
    .flatMap(menu => menu.items.filter(item => locationMatches(item.locationScope, record)));
}
// Preserve the stable existing business ID and old links. The current official
// Zimbabwe source names Cardinal's Corner; collection is still confirmed.
export const SPOTLY_MENU_BUSINESSES = [{ id: "spotly-menu-doppio-zero-harare", name: "Doppio Zero Harare", brandName: "Doppio Zero", category: "Restaurants", categories: ["Restaurants"], businessType: "restaurant_food", city: "Harare", area: "Cardinal’s Corner", country: "ZW", address: "", public: true, status: "provisional", claimStatus: "unclaimed", ownershipStatus: "unclaimed", verificationStatus: "listed", commerceEnabled: false, source: { type: "spotly_catalogue", rightsStatus: "spotly_created" }, description: "Explore the menu and ask Spotly to arrange your order. The selected location, prices and availability are confirmed before payment." }];

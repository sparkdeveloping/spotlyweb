// Factual dish names retained in Spotly's own catalogue. Historical observations
// are not current branch quotes; an operator confirms the requested basket.
export const SPOTLY_RESTAURANT_MENUS = [
  { key: "doppio-zero-harare", name: "Doppio Zero Harare", city: "Harare", area: "Chisipite", observedAt: "2026-10-21T12:00:00Z", category: "Italian · Pizza · Breakfast", dishes: [
    ["Margherita pizza", 12], ["Smashed avo on toast", 8], ["BBQ burger", 15], ["Grilled calamari", 18], ["Classic bolognese", 15], ["Chicken Caesar salad", 14], ["Wood-fired prawns (6)", 25], ["Malva pudding", 6]
  ] },
  { key: "fishmonger-chisipite", name: "Fishmonger", city: "Harare", area: "Chisipite", observedAt: "2026-10-21T12:00:00Z", category: "Seafood · Fish", dishes: [
    ["Soup of the day", 5], ["Calamari, grilled with lemon", 7.5], ["Garlic prawns", 12], ["Mussels in creamy garlic sauce", 8.5], ["Halloumi cheese", 8.5], ["Chicken livers", 6], ["Tempura prawns", 11], ["Salmon pasta", 17]
  ] }
];
const norm = value => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export function menuItemsForBusiness(record = {}) {
  const menu = SPOTLY_RESTAURANT_MENUS.find(item => norm(record.city) === norm(item.city) &&
    (norm(record.name) === norm(item.name) || (item.key === "doppio-zero-harare" && norm(record.name) === "doppio zero")));
  return menu ? menu.dishes.map(([name, historicalPrice], index) => ({ id: `menu_${menu.key}_${index + 1}`, name, category: "Menu", status: "requestable", catalogueKind: "menu_reference", priceEstimate: null, priceCheckedAt: null, priceStatus: "to_confirm", referenceObservedAt: menu.observedAt, historicalPrice, currency: "USD" })) : [];
}
export const SPOTLY_MENU_BUSINESSES = [{ id: "spotly-menu-doppio-zero-harare", name: "Doppio Zero Harare", brandName: "Doppio Zero", category: "Restaurants", categories: ["Restaurants"], businessType: "restaurant_food", city: "Harare", area: "Chisipite", country: "ZW", address: "", public: true, status: "provisional", claimStatus: "unclaimed", ownershipStatus: "unclaimed", verificationStatus: "listed", commerceEnabled: false, source: { type: "spotly_catalogue", rightsStatus: "spotly_created" }, description: "Explore the menu and ask Spotly to arrange your order. The selected location, prices and availability are confirmed before payment." }];

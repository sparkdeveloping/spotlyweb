// Public source observations from The Menu. Read from the source on 21 October 2026.
// These are NOT merchant offers or a claim of direct partnership with restaurants.
export const THEMENU_RESTAURANT_SPOTLIGHTS = Object.freeze([
  {
    id: "doppio-zero-harare",
    name: "Doppio Zero Harare",
    area: "Chisipite, Harare",
    category: "Italian · Pizza · Breakfast",
    menuHighlight: "Margherita pizza",
    listedPrice: 12,
    currency: "USD",
    listingUrl: "https://themenu.co.zw/listings/restaurants/doppio-zero-harare.html",
    observedAt: "2026-10-21T12:00:00Z"
  },
  {
    id: "fishmonger-chisipite",
    name: "Fishmonger",
    area: "Chisipite, Harare",
    category: "Seafood · Fish",
    menuHighlight: "Prawn special (Wednesday to Sunday)",
    listedPrice: 16,
    currency: "USD",
    listingUrl: "https://themenu.co.zw/listings/restaurants/fishmonger.html",
    observedAt: "2026-10-21T12:00:00Z"
  }
]);

export function themenuPriceLabel(record, now = Date.now()) {
  const age = now - new Date(record.observedAt).getTime();
  if (!Number.isFinite(age) || age < 0 || age > 14*86400000) return null;
  return `Listed at US$${record.listedPrice.toFixed(2)} on The Menu`;
}

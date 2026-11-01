// A place name identifies the outlet; a parent-company label or imported cuisine
// must not silently turn Chicken Inn into Pizza Inn (or Nando's into Simbisa).
export const normalizeFoodName = value => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const BRANDS = [
  ["chicken-inn", /\bchicken inn\b/, "fried-chicken"],
  ["pizza-inn", /\bpizza inn\b/, "pizza"],
  ["creamy-inn", /\bcreamy inn\b/, "ice-cream"],
  ["bakers-inn", /\bbakers? inn\b/, "bakery"],
  ["nandos", /\bnandos\b/, "grilled-chicken"],
  ["kfc", /\b(?:kfc|kentucky fried chicken)\b/, "fried-chicken"],
  ["pizza-hut", /\bpizza hut\b/, "pizza"],
  ["steers", /\bsteers\b/, "burger"],
  ["chicken-slice", /\bchicken slice\b/, "fried-chicken"],
  ["pizza-slice", /\bpizza slice\b/, "pizza"],
  ["rocomamas", /\broco ?mamas\b/, "burger"],
  ["cafe-nush", /\b(?:cafe nush|nush pizzeria)\b/, "cafe"],
  ["chop-chop", /\bchop chop\b/, "restaurant-interior"],
  ["ocean-basket", /\bocean basket\b/, "restaurant-interior"],
  ["mugg-and-bean", /\bmugg (?:and )?bean\b/, "cafe"],
  ["fishmonger", /\b(?:the )?fishmonger\b/, "restaurant-interior"],
  ["doppio-zero", /\bdoppio zero\b/, "restaurant-interior"],
  ["sabai-thai", /\bsabai thai\b/, "asian-food"],
  ["amanzi", /^amanzi(?: restaurant)?$/, "restaurant-interior"]
];
export function foodBrandKeys(record = {}) {
  const name = normalizeFoodName(record.name || record.title);
  if (/\b(pharmacy|chemist|hardware|school|bank|fuel|garage|supplies)\b/.test(name)) return [];
  const named = BRANDS.filter(([,pattern]) => pattern.test(name));
  if (named.length) return named.map(([key]) => key);
  const brand = normalizeFoodName(record.brandName || record.sourceTags?.brand);
  return BRANDS.filter(([,pattern]) => pattern.test(brand)).map(([key]) => key);
}
export function foodBrandPhotoFamily(record = {}) {
  const keys = foodBrandKeys(record);
  if (keys.length > 1) return "takeaway";
  return BRANDS.find(([key]) => key === keys[0])?.[2] || null;
}

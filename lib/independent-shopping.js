/**
 * Independent shopping is a *different* commercial model from merchant orders.
 * Never decorate a provisional business with commerceVerified or merchant capabilities.
 * No customer payment or dispatch may be initiated from this module.
 */
export const INDEPENDENT_SHOPPING_DISCLOSURE =
  "Independent shopping service. Spotly is not affiliated with, endorsed by, or acting for this store. A Spotly shopper may purchase requested items in person after we confirm your request.";

export const INDEPENDENT_PRICE_MAX_AGE_DAYS = 14;
const MAX_AGE_MS = INDEPENDENT_PRICE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

function validMoney(value) {
  const amount = Number(value);
  return value !== null && value !== "" && Number.isFinite(amount) && amount >= 0 && amount <= 100000;
}

export function asMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function timeValue(value) {
  if (value && typeof value.toMillis === "function") return value.toMillis();
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function independentShoppingFlags(settings = {}) {
  const feature = settings?.independentShopping || {};
  return {
    browseEnabled: feature.browseEnabled !== false,
    requestEnabled: feature.browseEnabled !== false && feature.requestEnabled !== false
  };
}

export function currentIndependentItem(item, now = Date.now()) {
  const checked = timeValue(item?.priceCheckedAt);
  return item?.status === "available" &&
    typeof item?.id === "string" && item.id.length > 0 &&
    typeof item?.name === "string" && item.name.trim().length > 0 &&
    validMoney(item?.priceEstimate) &&
    Number.isFinite(checked) && checked <= now &&
    now - checked <= MAX_AGE_MS;
}

export function independentPublicStore(id, record = {}, now = Date.now()) {
  if (!id || record.status !== "published" ||
      record.affiliation !== "unaffiliated" ||
      record.sourcingModel !== "independent_in_person" ||
      !record.name || !record.city || !record.address || record.assistAccepting === false) return null;
  const items = (Array.isArray(record.items) ? record.items : [])
    .filter((item) => currentIndependentItem(item, now))
    .slice(0, 120)
    .map((item) => ({
      id: String(item.id),
      name: String(item.name).trim(),
      category: String(item.category || "").trim(),
      unit: String(item.unit || "").trim(),
      priceEstimate: asMoney(item.priceEstimate),
      priceCheckedAt: item.priceCheckedAt,
      currency: String(record.currency || (record.country === "MW" ? "MWK" : "USD")).toUpperCase()
    }));
  if (!items.length) return null;
  return {
    id: String(id),
    name: String(record.name).trim(),
    country: String(record.country || "ZW").toUpperCase(),
    currency: String(record.currency || (record.country === "MW" ? "MWK" : "USD")).toUpperCase(),
    city: String(record.city).trim(),
    area: String(record.area || "").trim(),
    address: String(record.address).trim(),
    category: String(record.category || "Restaurant").trim(),
    affiliation: "unaffiliated",
    model: "independent_shopping",
    pricing: "estimate_pending_confirmation",
    disclaimer: INDEPENDENT_SHOPPING_DISCLOSURE,
    items
  };
}

export function independentQuote(store, selections = [], options = {}, now = Date.now()) {
  if (!store || store.model !== "independent_shopping" || store.affiliation !== "unaffiliated") {
    throw new Error("Choose an independently sourced shopping location.");
  }
  if (!Array.isArray(selections) || !selections.length || selections.length > 25) {
    throw new Error("Choose between 1 and 25 items.");
  }
  const catalog = new Map(store.items.map((item) => [item.id, item]));
  const seen = new Set();
  const items = selections.map(({ itemId, quantity }) => {
    if (!itemId || seen.has(itemId)) throw new Error("Each selected item may appear only once.");
    seen.add(itemId);
    const item = catalog.get(itemId);
    if (!item || !currentIndependentItem({ ...item, status: "available" }, now)) {
      throw new Error("Some prices need checking again before we can accept a request.");
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      throw new Error("Choose 1 to 10 of each item.");
    }
    return {
      itemId, name: item.name, quantity,
      unitPriceEstimate: item.priceEstimate,
      lineEstimate: asMoney(quantity * item.priceEstimate),
      priceCheckedAt: item.priceCheckedAt
    };
  });
  const merchandiseEstimate = asMoney(items.reduce((sum, item) => sum + item.lineEstimate, 0));
  const shoppingFeeEstimate = validMoney(options.shoppingFee) ? asMoney(options.shoppingFee) : 0;
  const deliveryFeeEstimate = validMoney(options.deliveryFee) ? asMoney(options.deliveryFee) : 0;
  return {
    items,
    currency: store.currency || "USD",
    merchandiseEstimate,
    shoppingFeeEstimate,
    deliveryFeeEstimate,
    totalEstimate: asMoney(merchandiseEstimate + shoppingFeeEstimate + deliveryFeeEstimate),
    isFinalPrice: false,
    paymentRequired: false,
    dispatchCreated: false
  };
}

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

function publicReference(item) {
  const source = item.reference || {};
  let url;
  try { const parsed = new URL(source.url); if (parsed.protocol === "https:" && !parsed.username && !parsed.password) url = parsed.href; } catch {}
  return url && source.label ? { label: String(source.label).slice(0, 100), url, observedAt: String(source.observedAt || "").slice(0, 30) } : null;
}
function publicItemImage(item) {
  // Only the reviewed, bundled item assets are published. No arbitrary URL or
  // category fallback can masquerade as an exact branded product photo.
  return /^\/marketplace\/items\/[a-z0-9_-]+\.webp$/.test(item.image || "") ? item.image : "";
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
      !record.name || !record.city || (!record.address && record.catalogueMode !== "quote_first") || record.assistAccepting === false) return null;
  const items = (Array.isArray(record.items) ? record.items : [])
    .filter((item) => currentIndependentItem(item, now) || (record.catalogueMode === "quote_first" && ["requestable", "available"].includes(item.status) && /^[a-zA-Z0-9_-]{2,80}$/.test(item.id || "") && typeof item.name === "string" && item.name.trim().length > 0 && item.name.length <= 160))
    .slice(0, 200)
    .map((item) => ({
      id: String(item.id),
      name: String(item.name).trim(),
      category: String(item.category || "").trim(),
      unit: String(item.unit || "").trim(),
      brand: String(item.brand || "").trim().slice(0, 100),
      packSize: String(item.packSize || "").trim().slice(0, 80),
      description: String(item.description || "").trim().slice(0, 300),
      options: (Array.isArray(item.options) ? item.options : []).filter(option => typeof option.group === "string" && Array.isArray(option.values)).slice(0, 6).map(option => ({ group: option.group.slice(0, 60), values: [...new Set(option.values.filter(value => typeof value === "string" && value.trim()).map(value => value.trim().slice(0, 120)))].slice(0, 30) })).filter(option => option.values.length),
      image: publicItemImage(item),
      imageKind: item.imageKind === "dish" ? "dish" : "product",
      reference: publicReference(item),
      availability: record.catalogueMode === "quote_first" ? "to_confirm" : "reviewed_estimate",
      priceEstimate: currentIndependentItem(item, now) ? asMoney(item.priceEstimate) : null,
      priceCheckedAt: currentIndependentItem(item, now) ? item.priceCheckedAt : null,
      priceStatus: currentIndependentItem(item, now) ? "estimate" : "to_confirm",
      catalogueKind: ["menu_reference", "product_reference", "request_suggestion"].includes(item.catalogueKind) ? item.catalogueKind : "curated_item",
      currency: String(record.currency || (record.country === "MW" ? "MWK" : "USD")).toUpperCase()
    }));
  if (!items.length && record.catalogueMode !== "quote_first") return null;
  return {
    id: String(id),
    name: String(record.name).trim(),
    directoryBusinessId: record.directoryBusinessId || "",
    directoryBranchId: record.directoryBranchId || "",
    branchName: record.branchName || record.area || "",
    assistService: record.assistService || "eat",
    catalogueMode: record.catalogueMode || "curated",
    catalogueVersion: String(record.catalogueVersion || ""),
    catalogueScope: record.catalogueScope === "retailer" ? "retailer" : record.catalogueScope === "product_library" ? "product_library" : "menu",
    coordinates: record.coordinates || null,
    allowCustomItems: record.catalogueMode === "quote_first",
    country: String(record.country || "ZW").toUpperCase(),
    currency: String(record.currency || (record.country === "MW" ? "MWK" : "USD")).toUpperCase(),
    city: String(record.city).trim(),
    area: String(record.area || "").trim(),
    address: String(record.address || "").trim(),
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
  const customItems = options.customItems || [];
  if (!Array.isArray(selections) || !Array.isArray(customItems) || !selections.length && !customItems.length || selections.length + customItems.length > 25) {
    throw new Error("Choose between 1 and 25 items.");
  }
  const catalog = new Map(store.items.map((item) => [item.id, item]));
  const seen = new Set();
  const items = selections.map(({ itemId, quantity, choices = [] }) => {
    if (!itemId || seen.has(itemId)) throw new Error("Each selected item may appear only once.");
    seen.add(itemId);
    const item = catalog.get(itemId);
    if (!item || (store.catalogueMode !== "quote_first" && !currentIndependentItem({ ...item, status: "available" }, now))) {
      throw new Error("Some prices need checking again before we can accept a request.");
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      throw new Error("Choose 1 to 10 of each item.");
    }
    if (!Array.isArray(choices) || choices.length > 6 || new Set(choices.map(choice => choice?.group)).size !== choices.length ||
        choices.some(choice => !item.options?.some(option => option.group === choice?.group && option.values.includes(choice?.value)))) {
      throw new Error("Choose the published options for this item.");
    }
    return {
      itemId, name: [item.name, ...choices.map(choice => `${choice.group}: ${choice.value}`)].join(" · "), quantity,
      choices: choices.map(({ group, value }) => ({ group, value })),
      unit: item.unit || "", brand: item.brand || "", packSize: item.packSize || "",
      reference: item.reference || null,
      unitPriceEstimate: item.priceEstimate,
      lineEstimate: item.priceEstimate == null ? null : asMoney(quantity * item.priceEstimate),
      priceCheckedAt: item.priceCheckedAt
    };
  });
  if (customItems.length && !store.allowCustomItems) throw new Error("Custom items are not supported at this location.");
  const names = new Set();
  customItems.forEach((item, index) => {
    const name = typeof item.name === "string" ? item.name.trim() : "";
    if (name.length < 2 || name.length > 160 || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10 || names.has(name.toLowerCase())) throw new Error("Review custom item names and quantities.");
    names.add(name.toLowerCase());
    items.push({ itemId: `custom_${index + 1}`, name, quantity: item.quantity, unitPriceEstimate: null, lineEstimate: null, priceCheckedAt: null, customerRequested: true });
  });
  const requiresQuote = items.some(item => item.lineEstimate == null);
  const merchandiseEstimate = requiresQuote ? null : asMoney(items.reduce((sum, item) => sum + item.lineEstimate, 0));
  const shoppingFeeEstimate = validMoney(options.shoppingFee) ? asMoney(options.shoppingFee) : 0;
  const deliveryFeeEstimate = validMoney(options.deliveryFee) ? asMoney(options.deliveryFee) : 0;
  return {
    items,
    currency: store.currency || "USD",
    merchandiseEstimate,
    shoppingFeeEstimate,
    deliveryFeeEstimate,
    totalEstimate: requiresQuote ? null : asMoney(merchandiseEstimate + shoppingFeeEstimate + deliveryFeeEstimate),
    requiresQuote,
    isFinalPrice: false,
    paymentRequired: false,
    dispatchCreated: false
  };
}

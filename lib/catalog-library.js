export const PUBLISHABLE_IMAGE_RIGHTS = new Set(["merchant_owned", "spotly_photographed", "manufacturer_provided", "licensed"]);

export function normalizeProductText(value = "") {
  return String(value).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
}

export function productSearchTerms(...values) {
  const tokens = new Set();
  values.flat().filter(Boolean).forEach((value) => {
    const normalized = normalizeProductText(value);
    if (!normalized) return;
    tokens.add(normalized);
    normalized.split(/\s+/).filter((token) => token.length >= 2).forEach((token) => tokens.add(token));
  });
  return [...tokens].slice(0, 80);
}

export function productMatchKey(product = {}) {
  const barcode = normalizeProductText(product.gtin || product.barcode || "");
  if (barcode) return `barcode:${barcode}`;
  const sku = normalizeProductText(product.manufacturerSku || product.sku || "");
  if (sku) return `sku:${sku}`;
  const identity = [product.brand, product.canonicalName || product.name, product.variant, product.packSize, product.unit].map(normalizeProductText).filter(Boolean).join("|");
  return identity ? `identity:${identity}` : "";
}

export function compareMasterProduct(candidate = {}, existing = {}) {
  const candidateBarcode = normalizeProductText(candidate.gtin || candidate.barcode || "");
  const existingBarcode = normalizeProductText(existing.gtin || existing.barcode || "");
  if (candidateBarcode && candidateBarcode === existingBarcode) return { strength: "exact", reason: "barcode" };
  if (candidate.masterProductId && candidate.masterProductId === existing.id) return { strength: "exact", reason: "masterProductId" };
  const candidateSku = normalizeProductText(candidate.manufacturerSku || candidate.sku || "");
  const existingSku = normalizeProductText(existing.manufacturerSku || existing.sku || "");
  if (candidateSku && candidateSku === existingSku) return { strength: "strong", reason: "manufacturerSku" };
  const a = productMatchKey({ ...candidate, barcode: "", gtin: "", sku: "", manufacturerSku: "" });
  const b = productMatchKey({ ...existing, barcode: "", gtin: "", sku: "", manufacturerSku: "" });
  if (a && a === b) return { strength: "strong", reason: "identity" };
  const candidateName = normalizeProductText(`${candidate.brand || ""} ${candidate.canonicalName || candidate.name || ""} ${candidate.variant || ""} ${candidate.packSize || ""}`);
  const existingName = normalizeProductText(`${existing.brand || ""} ${existing.canonicalName || existing.name || ""} ${existing.variant || ""} ${existing.packSize || ""}`);
  if (candidateName && existingName && (candidateName.includes(existingName) || existingName.includes(candidateName))) return { strength: "possible", reason: "fuzzy_identity" };
  return { strength: "none", reason: "none" };
}

export function canPublishMasterImage(product = {}) {
  if (!product.primaryImage) return true;
  return PUBLISHABLE_IMAGE_RIGHTS.has(product.imageRightsStatus);
}

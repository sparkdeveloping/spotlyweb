export function branchOfferOverride(product, branchId) {
  if (!product || !branchId) return null;
  return product.branchOverrides?.[branchId] || null;
}

export function resolveProductForBranch(product, branchId) {
  if (!product) return product;
  const override = branchOfferOverride(product, branchId);
  if (!override) return product;
  const currency = override.currency || product.currency || "USD";
  const price = override.price === "" || override.price === null || override.price === undefined ? product.price : Number(override.price);
  return {
    ...product,
    currency,
    price,
    prices: { ...(product.prices || {}), ...(Number.isFinite(Number(price)) ? { [currency]: Number(price) } : {}) },
    stockMode: override.stockMode || product.stockMode,
    stockStatus: override.stockStatus || product.stockStatus,
    stockQuantity: override.stockQuantity === "" || override.stockQuantity === null || override.stockQuantity === undefined ? product.stockQuantity : Number(override.stockQuantity),
    pickupEligible: override.pickupEligible === undefined ? product.pickupEligible : override.pickupEligible,
    sku: override.sku || product.sku,
    branchOverrideApplied: true
  };
}

export function setBranchOfferOverride(overrides = {}, branchId, values = {}) {
  if (!branchId) return overrides || {};
  return { ...(overrides || {}), [branchId]: { ...((overrides || {})[branchId] || {}), ...values, overridden: true } };
}

export function resetBranchOfferOverride(overrides = {}, branchId) {
  if (!branchId) return overrides || {};
  const next = { ...(overrides || {}) };
  delete next[branchId];
  return next;
}

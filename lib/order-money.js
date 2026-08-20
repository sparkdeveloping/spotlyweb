export function money(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : 0;
}

export function clampPercent(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return Math.max(0, Math.min(100, Number(fallback) || 0));
  return Math.max(0, Math.min(100, number));
}

export function shoppingReserveAmount(subtotal, percent) {
  return money(Math.max(0, money(subtotal)) * clampPercent(percent) / 100);
}

/**
 * Builds an immutable commercial snapshot for an order.
 * Customer-facing charges, temporary shopping reserves and merchant proceeds are
 * deliberately separated so business balances cannot accidentally absorb Driver
 * delivery fees or customer service fees.
 */
export function buildOrderTotals({
  subtotal,
  tax = 0,
  serviceFee = 0,
  deliveryFee = 0,
  shoppingReserve = 0,
  commissionPercent = 0
} = {}) {
  const merchandiseSubtotal = money(Math.max(0, money(subtotal)));
  const taxAmount = money(Math.max(0, money(tax)));
  const customerServiceFee = money(Math.max(0, money(serviceFee)));
  const customerDeliveryFee = money(Math.max(0, money(deliveryFee)));
  const reserve = money(Math.max(0, money(shoppingReserve)));
  const commissionRate = clampPercent(commissionPercent);
  const platformCommission = money(merchandiseSubtotal * commissionRate / 100);
  const merchantGross = money(merchandiseSubtotal + taxAmount);
  const merchantNet = money(Math.max(0, merchantGross - platformCommission));
  const total = money(merchandiseSubtotal + taxAmount + customerServiceFee + customerDeliveryFee + reserve);

  return {
    subtotal: merchandiseSubtotal,
    tax: taxAmount,
    serviceFee: customerServiceFee,
    deliveryFee: customerDeliveryFee,
    shoppingReserve: reserve,
    commissionPercent: commissionRate,
    platformCommission,
    merchantGross,
    merchantNet,
    total,
    capturedTotal: total
  };
}

export function capturedCustomerAmount(order = {}) {
  return money(order.totals?.capturedTotal ?? order.totals?.total ?? order.total ?? 0);
}

export function finalCustomerAmount(order = {}) {
  return money(order.totals?.finalTotal ?? order.shopping?.finalTotal ?? order.totals?.total ?? order.total ?? 0);
}

export function merchantSettlementBreakdown(order = {}) {
  const totals = order.totals || {};
  const subtotal = money(order.shopping?.actualSubtotal ?? totals.finalSubtotal ?? totals.subtotal ?? 0);
  const tax = money(order.shopping?.actualTax ?? totals.finalTax ?? totals.tax ?? 0);
  const commissionPercent = clampPercent(totals.commissionPercent ?? order.commerceSnapshot?.commissionPercent ?? 0);
  const explicitGross = Number(totals.merchantGross);
  const explicitCommission = Number(totals.platformCommission);
  const explicitNet = Number(totals.merchantNet);
  const shoppingFinalized = order.shopping?.mode === "driver_shops" && ["checked_out", "reconciled", "delivered"].includes(order.shopping?.state);

  const merchantGross = order.shopping?.mode === "driver_shops" && shoppingFinalized
    ? money(subtotal + tax)
    : Number.isFinite(explicitGross) ? money(explicitGross) : money(subtotal + tax);
  const platformCommission = order.shopping?.mode === "driver_shops" && shoppingFinalized
    ? money(subtotal * commissionPercent / 100)
    : Number.isFinite(explicitCommission) ? money(explicitCommission) : money(subtotal * commissionPercent / 100);
  const merchantNet = order.shopping?.mode === "driver_shops" && shoppingFinalized
    ? money(Math.max(0, merchantGross - platformCommission))
    : Number.isFinite(explicitNet) ? money(explicitNet) : money(Math.max(0, merchantGross - platformCommission));

  return { subtotal, tax, commissionPercent, merchantGross, platformCommission, merchantNet };
}

export function shoppingReconciliation({ order = {}, actualSubtotal = 0, actualTax = 0 } = {}) {
  const totals = order.totals || {};
  const subtotal = money(Math.max(0, actualSubtotal));
  const tax = money(Math.max(0, actualTax));
  const captured = capturedCustomerAmount(order);
  const serviceFee = money(totals.serviceFee);
  const deliveryFee = money(totals.deliveryFee);
  const finalTotal = money(subtotal + tax + serviceFee + deliveryFee);
  const unusedReserve = money(Math.max(0, captured - finalTotal));
  const topUpRequired = money(Math.max(0, finalTotal - captured));
  const commissionPercent = clampPercent(totals.commissionPercent ?? order.commerceSnapshot?.commissionPercent ?? 0);
  const platformCommission = money(subtotal * commissionPercent / 100);
  const merchantGross = money(subtotal + tax);
  const merchantNet = money(Math.max(0, merchantGross - platformCommission));
  return { subtotal, tax, finalTotal, capturedTotal: captured, unusedReserve, topUpRequired, commissionPercent, platformCommission, merchantGross, merchantNet };
}

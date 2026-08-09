export const BALANCE_BUCKETS = ["pending", "available", "reserved", "payoutProcessing", "paidOut"];

export function normalizeMoneyCurrency(value) {
  return value === "ZWG" ? "ZWG" : "USD";
}

export function merchantNetAmount(order = {}) {
  const total = Number(order.totals?.total ?? order.total ?? 0);
  const serviceFee = Number(order.totals?.serviceFee ?? order.platformFee ?? order.fees?.platform ?? 0);
  return Number(Math.max(0, total - Math.max(0, serviceFee)).toFixed(2));
}

export function paymentLedgerPlan(order = {}) {
  const total = Number(Number(order.totals?.total ?? order.total ?? 0).toFixed(2));
  const platformFee = Number(Number(order.totals?.serviceFee ?? order.platformFee ?? order.fees?.platform ?? 0).toFixed(2));
  if (!Number.isFinite(total) || total <= 0) return [];
  const entries = [{ type: "payment_captured", amount: total, direction: "credit", effects: { pending: total } }];
  if (platformFee > 0) entries.push({ type: "platform_fee", amount: platformFee, direction: "debit", effects: { pending: -platformFee } });
  return entries;
}

export function payoutReserveEffects(amount) { return { available: -amount, reserved: amount }; }
export function payoutProcessingEffects(amount) { return { reserved: -amount, payoutProcessing: amount }; }
export function payoutPaidEffects(amount) { return { payoutProcessing: -amount, paidOut: amount }; }
export function payoutRestoreFromReservedEffects(amount) { return { reserved: -amount, available: amount }; }
export function payoutRestoreFromProcessingEffects(amount) { return { payoutProcessing: -amount, available: amount }; }

export function refundLedgerEffects(amount, settlementState) {
  return settlementState === "available" ? { available: -amount } : { pending: -amount };
}

export function sanitizeBalance(data = {}) {
  const result = {};
  for (const bucket of BALANCE_BUCKETS) result[bucket] = Number(Number(data[bucket] || 0).toFixed(2));
  result.liability = Number(Math.max(0, -result.available).toFixed(2));
  result.available = Number(Math.max(0, result.available).toFixed(2));
  result.pending = Number(Math.max(0, result.pending).toFixed(2));
  result.reserved = Number(Math.max(0, result.reserved).toFixed(2));
  result.payoutProcessing = Number(Math.max(0, result.payoutProcessing).toFixed(2));
  result.paidOut = Number(Math.max(0, result.paidOut).toFixed(2));
  return result;
}

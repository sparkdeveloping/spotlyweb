import { capturedCustomerAmount, merchantSettlementBreakdown } from "@/lib/order-money";

export const BALANCE_BUCKETS = ["pending", "available", "reserved", "payoutProcessing", "paidOut"];

export function normalizeMoneyCurrency(value) {
  return value === "ZWG" ? "ZWG" : "USD";
}

export function merchantNetAmount(order = {}) {
  return merchantSettlementBreakdown(order).merchantNet;
}

export function paymentLedgerPlan(order = {}) {
  const capturedTotal = capturedCustomerAmount(order);
  const settlement = merchantSettlementBreakdown(order);
  if (!order.businessId || !settlement.merchantGross) return [];
  const entries = [{ type: "merchant_sale_captured", amount: settlement.merchantGross, direction: "credit", effects: { pending: settlement.merchantGross }, metadata: { capturedCustomerTotal: capturedTotal } }];
  if (settlement.platformCommission > 0) entries.push({ type: "platform_commission", amount: settlement.platformCommission, direction: "debit", effects: { pending: -settlement.platformCommission } });
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

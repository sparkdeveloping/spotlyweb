export const PAYMENT_STATES = Object.freeze({
  UNPAID: "unpaid",
  INITIATED: "initiated",
  PENDING: "pending",
  PAID: "paid",
  FAILED: "failed",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
  REFUND_PENDING: "refund_pending",
  REFUNDED: "refunded",
  REFUND_FAILED: "refund_failed",
  AMOUNT_MISMATCH: "amount_mismatch"
});

const TRANSITIONS = new Map([
  ["unpaid", new Set(["initiated", "pending", "cancelled"])],
  ["initiated", new Set(["pending", "paid", "failed", "expired", "cancelled", "amount_mismatch"])],
  ["pending", new Set(["paid", "failed", "expired", "cancelled", "amount_mismatch"])],
  ["failed", new Set(["initiated", "pending", "paid"])],
  ["expired", new Set(["initiated", "pending", "paid"])],
  ["cancelled", new Set(["paid"])],
  ["amount_mismatch", new Set(["paid", "failed", "expired"])],
  ["paid", new Set(["refund_pending"])],
  ["refund_pending", new Set(["refunded", "refund_failed"])],
  ["refund_failed", new Set(["refund_pending"])],
  ["refunded", new Set()]
]);

export function canTransitionPayment(current = "unpaid", next = "pending") {
  if (current === next) return true;
  return TRANSITIONS.get(current)?.has(next) === true;
}

export function resolvePaymentTransition(current = "unpaid", requested = "pending") {
  if (canTransitionPayment(current, requested)) return requested;
  return current;
}

export function paymentIsTerminal(state) {
  return ["paid", "refunded"].includes(state);
}

export function paymentTransitionMatrix() {
  return Object.fromEntries([...TRANSITIONS.entries()].map(([state, next]) => [state, [...next]]));
}

export function paymentCallbackKey({ reference = "", providerReference = "", providerStatus = "", amount = 0 }) {
  const raw = [reference, providerReference, String(providerStatus).toLowerCase(), Number(amount || 0).toFixed(2)].join("|");
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `paynow_${(hash >>> 0).toString(16)}`;
}

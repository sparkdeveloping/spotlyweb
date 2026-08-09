import "server-only";

import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { BALANCE_BUCKETS, merchantNetAmount, normalizeMoneyCurrency, paymentLedgerPlan, payoutPaidEffects, payoutProcessingEffects, payoutReserveEffects, payoutRestoreFromProcessingEffects, payoutRestoreFromReservedEffects, refundLedgerEffects, sanitizeBalance } from "@/lib/business-money";

export { merchantNetAmount, normalizeMoneyCurrency, paymentLedgerPlan, payoutPaidEffects, payoutProcessingEffects, payoutReserveEffects, payoutRestoreFromProcessingEffects, payoutRestoreFromReservedEffects, refundLedgerEffects, sanitizeBalance };

export function moneyAccountId(businessId, currency) {
  return `${businessId}_${normalizeMoneyCurrency(currency)}`;
}

export function moneyEntryId(type, reference) {
  return createHash("sha256").update(`${type}:${reference}`).digest("hex").slice(0, 40);
}

function safeEffects(effects = {}) {
  const next = {};
  for (const bucket of BALANCE_BUCKETS) {
    const value = Number(effects[bucket] || 0);
    if (Number.isFinite(value) && value !== 0) next[bucket] = Number(value.toFixed(2));
  }
  return next;
}

export function postLedgerEntry(transaction, db, entry) {
  const currency = normalizeMoneyCurrency(entry.currency);
  const effects = safeEffects(entry.effects);
  const ledgerRef = db.collection("businessLedgerEntries").doc(entry.id || moneyEntryId(entry.type, entry.reference || `${entry.businessId}:${entry.orderId || entry.payoutId || Date.now()}`));
  const balanceRef = db.collection("businessBalanceAccounts").doc(moneyAccountId(entry.businessId, currency));
  transaction.create(ledgerRef, {
    businessId: entry.businessId,
    orderId: entry.orderId || null,
    paymentIntentId: entry.paymentIntentId || null,
    payoutId: entry.payoutId || null,
    refundId: entry.refundId || null,
    currency,
    amount: Number(Number(entry.amount || 0).toFixed(2)),
    direction: entry.direction || "credit",
    type: entry.type,
    status: entry.status || "posted",
    effects,
    reference: entry.reference || "",
    source: entry.source || "server",
    createdBy: entry.createdBy || "system",
    availableAt: entry.availableAt || null,
    createdAt: FieldValue.serverTimestamp()
  });
  const patch = { businessId: entry.businessId, currency, updatedAt: FieldValue.serverTimestamp() };
  Object.entries(effects).forEach(([bucket, value]) => { patch[bucket] = FieldValue.increment(value); });
  transaction.set(balanceRef, patch, { merge: true });
  return ledgerRef;
}

export function postPaymentCapturedLedger(transaction, db, order, intentReference, source = "payment_provider") {
  const businessId = order.businessId;
  if (!businessId) return;
  for (const plan of paymentLedgerPlan(order)) {
    postLedgerEntry(transaction, db, {
      id: moneyEntryId(plan.type, order.id || intentReference), businessId, orderId: order.id || null, paymentIntentId: intentReference,
      currency: order.currency || "USD", amount: plan.amount, direction: plan.direction, type: plan.type, effects: plan.effects,
      reference: intentReference, source, createdBy: "paynow"
    });
  }
}

export function postSettlementAvailableLedger(transaction, db, order, actorId = "system") {
  const amount = merchantNetAmount(order);
  if (!amount) return;
  postLedgerEntry(transaction, db, {
    id: moneyEntryId("settlement_available", order.id), businessId: order.businessId, orderId: order.id, paymentIntentId: order.paymentIntentReference || null,
    currency: order.currency || "USD", amount, direction: "transfer", type: "settlement_available", effects: { pending: -amount, available: amount },
    reference: order.paymentIntentReference || order.id, source: "reconciliation", createdBy: actorId, availableAt: FieldValue.serverTimestamp()
  });
}

function financeKey() {
  const secret = process.env.SPOTLY_FINANCE_ENCRYPTION_KEY || "";
  if (secret.length < 32) throw Object.assign(new Error("Secure settlement-account storage is not configured yet."), { status: 503 });
  return createHash("sha256").update(secret).digest();
}

export function encryptFinancialValue(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", financeKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return { algorithm: "aes-256-gcm", iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64") };
}

export function accountLast4(value) {
  const clean = String(value || "").replace(/\s+/g, "");
  return clean.slice(-4);
}

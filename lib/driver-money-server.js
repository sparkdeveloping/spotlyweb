import "server-only";

import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";

export const DRIVER_BALANCE_BUCKETS = ["pending", "available", "reserved", "processing", "paid_out"];

export function driverBalanceAccountId(driverId, currency = "USD") {
  return `${driverId}_${String(currency || "USD").toUpperCase()}`;
}

export function driverLedgerEntryId(type, reference) {
  return createHash("sha256").update(`${type}:${reference}`).digest("hex").slice(0, 40);
}

function cleanEffects(effects = {}) {
  const result = {};
  for (const bucket of DRIVER_BALANCE_BUCKETS) {
    const amount = Number(effects[bucket] || 0);
    if (Number.isFinite(amount) && amount !== 0) result[bucket] = Number(amount.toFixed(2));
  }
  return result;
}

export function postDriverLedgerEntry(transaction, db, entry) {
  const currency = String(entry.currency || "USD").toUpperCase();
  const effects = cleanEffects(entry.effects);
  const ledgerRef = db.collection("driverEarningsLedger").doc(entry.id || driverLedgerEntryId(entry.type, entry.reference || `${entry.driverId}:${Date.now()}`));
  const balanceRef = db.collection("driverBalanceAccounts").doc(driverBalanceAccountId(entry.driverId, currency));
  transaction.create(ledgerRef, {
    driverId: entry.driverId,
    deliveryJobId: entry.deliveryJobId || null,
    orderId: entry.orderId || null,
    payoutId: entry.payoutId || null,
    type: entry.type,
    amount: Number(Number(entry.amount || 0).toFixed(2)),
    currency,
    bucket: entry.bucket || null,
    effects,
    description: entry.description || "Driver earnings",
    reference: entry.reference || "",
    source: entry.source || "server",
    createdBy: entry.createdBy || "system",
    createdAt: FieldValue.serverTimestamp()
  });
  const patch = { driverId: entry.driverId, currency, updatedAt: FieldValue.serverTimestamp() };
  Object.entries(effects).forEach(([bucket, amount]) => { patch[bucket] = FieldValue.increment(amount); });
  transaction.set(balanceRef, patch, { merge: true });
  return ledgerRef;
}

export async function creditDeliveryEarnings(transaction, db, { driverId, deliveryJobId, orderId, amount, currency = "USD" }) {
  const id = driverLedgerEntryId("delivery_earned", deliveryJobId);
  const numeric = Number(Number(amount || 0).toFixed(2));
  if (numeric <= 0) return false;
  postDriverLedgerEntry(transaction, db, {
    id, driverId, deliveryJobId, orderId, amount: numeric, currency, type: "delivery_earned", bucket: "available",
    effects: { available: numeric }, description: "Delivery earnings", reference: deliveryJobId, source: "delivery_completion"
  });
  return true;
}

export function sanitizeDriverBalance(data = {}) {
  const result = { pending: 0, available: 0, reserved: 0, processing: 0, paid_out: 0 };
  for (const key of DRIVER_BALANCE_BUCKETS) result[key] = Number(Math.max(0, Number(data[key] || 0)).toFixed(2));
  return result;
}

import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { docsData, docData } from "@/lib/driver-delivery-server";
import { driverBalanceAccountId, driverLedgerEntryId, postDriverLedgerEntry, sanitizeDriverBalance } from "@/lib/driver-money-server";
import { enforceRateLimit } from "@/lib/rate-limit-server";

export const runtime = "nodejs";
const schema = z.object({ action: z.literal("request"), amount: z.number().positive().max(100000), currency: z.enum(["USD", "ZWG"]).default("USD") });

function derivedBalances(entries = []) {
  const result = { pending: 0, available: 0, reserved: 0, processing: 0, paid_out: 0 };
  for (const entry of entries) {
    if (entry.effects && typeof entry.effects === "object") {
      for (const key of Object.keys(result)) result[key] += Number(entry.effects[key] || 0);
    } else {
      const bucket = entry.bucket || "available";
      if (bucket in result) result[bucket] += Number(entry.amount || 0);
    }
  }
  return Object.fromEntries(Object.entries(result).map(([key, value]) => [key, Number(Math.max(0, value).toFixed(2))]));
}

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    const { db } = getAdminServices();
    const [ledger, payouts, account, usdBalance, zwgBalance, settings] = await Promise.all([
      db.collection("driverEarningsLedger").where("driverId", "==", user.uid).limit(500).get(),
      db.collection("driverPayouts").where("driverId", "==", user.uid).limit(100).get(),
      db.collection("driverPayoutAccounts").doc(user.uid).get(),
      db.collection("driverBalanceAccounts").doc(driverBalanceAccountId(user.uid, "USD")).get(),
      db.collection("driverBalanceAccounts").doc(driverBalanceAccountId(user.uid, "ZWG")).get(),
      db.collection("platformSettings").doc("global").get()
    ]);
    const entries = docsData(ledger);
    const legacy = derivedBalances(entries);
    const balances = {
      USD: usdBalance.exists ? sanitizeDriverBalance(usdBalance.data()) : legacy,
      ZWG: zwgBalance.exists ? sanitizeDriverBalance(zwgBalance.data()) : { pending: 0, available: 0, reserved: 0, processing: 0, paid_out: 0 }
    };
    const payoutAccount = account.exists ? { ...docData(account), identifierEncrypted: undefined } : null;
    return Response.json({ ok: true, balances, ledger: entries, payouts: docsData(payouts), payoutAccount, policy: { minimum: Number(settings.data()?.commerce?.driverPayoutMinimum ?? settings.data()?.commerce?.payoutMinimum ?? 20), cadence: settings.data()?.commerce?.driverPayoutCadence || settings.data()?.commerce?.payoutCadence || "weekly" } });
  } catch (error) { return apiError(error); }
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    await enforceRateLimit(request, { key: "driver-payout", identity: user.uid, limit: 10, windowMs: 60 * 60_000 });
    const body = schema.parse(await request.json());
    const amount = Number(body.amount.toFixed(2));
    const { db } = getAdminServices();
    const [settings, driver] = await Promise.all([db.collection("platformSettings").doc("global").get(), db.collection("drivers").doc(user.uid).get()]);
    const minimum = Number(settings.data()?.commerce?.driverPayoutMinimum ?? settings.data()?.commerce?.payoutMinimum ?? 20);
    if (amount + 0.001 < minimum) throw Object.assign(new Error(`Driver payouts currently require at least ${body.currency} ${minimum.toFixed(2)}.`), { status: 422 });
    if (!driver.exists || !["approved", "ready", "active"].includes(driver.data().status) || driver.data().complianceHold || driver.data().safetyHold) throw Object.assign(new Error("Your Driver account cannot request a payout right now."), { status: 409 });
    const payoutRef = db.collection("driverPayouts").doc();
    await db.runTransaction(async (transaction) => {
      const accountRef = db.collection("driverPayoutAccounts").doc(user.uid);
      const balanceRef = db.collection("driverBalanceAccounts").doc(driverBalanceAccountId(user.uid, body.currency));
      const [account, balance] = await Promise.all([transaction.get(accountRef), transaction.get(balanceRef)]);
      if (!account.exists || account.data().verificationState !== "verified") throw Object.assign(new Error("Spotly must verify your payout account before you can request a payout."), { status: 409 });
      const available = Number(balance.data()?.available || 0);
      if (amount > available + 0.001) throw Object.assign(new Error("That payout is more than your available earnings."), { status: 422 });
      transaction.create(payoutRef, { driverId: user.uid, amount, currency: body.currency, status: "requested", payoutAccountLast4: account.data().maskedIdentifier || "", requestedBy: user.uid, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      postDriverLedgerEntry(transaction, db, { id: driverLedgerEntryId("payout_reserved", payoutRef.id), driverId: user.uid, payoutId: payoutRef.id, type: "payout_reserved", amount, currency: body.currency, effects: { available: -amount, reserved: amount }, description: "Payout requested", reference: payoutRef.id, source: "driver_payout_request", createdBy: user.uid });
      transaction.create(db.collection("auditLogs").doc(), { actorId: user.uid, action: "driver_payout.requested", entityType: "driverPayout", entityId: payoutRef.id, metadata: { amount, currency: body.currency }, source: "driver_money", createdAt: FieldValue.serverTimestamp() });
    });
    return Response.json({ ok: true, payoutId: payoutRef.id, status: "requested" });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the payout amount." }, { status: 400 });
    return apiError(error);
  }
}

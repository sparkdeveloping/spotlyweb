import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requireBusinessPermission } from "@/lib/access-control-server";
import { accountLast4, encryptFinancialValue, moneyAccountId, moneyEntryId, normalizeMoneyCurrency, payoutReserveEffects, postLedgerEntry, sanitizeBalance } from "@/lib/business-money-server";
import { safeText, toPlainTimestamp } from "@/lib/server-helpers";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { notifyRoleAudience, notifyUser } from "@/lib/notification-server";

export const runtime = "nodejs";

const settingsSchema = z.object({ action: z.literal("customer_settings"), businessId: z.string().min(3).max(180), acceptedCurrencies: z.array(z.enum(["USD", "ZWG"])).min(1).max(2), paymentMethods: z.array(z.string().min(2).max(60)).min(1).max(10), legalName: z.string().max(180).optional(), companyRegistrationNumber: z.string().max(100).optional(), taxNumber: z.string().max(100).optional(), responsiblePerson: z.string().max(180).optional(), registeredAddress: z.string().max(300).optional() });
const settlementSchema = z.object({ action: z.literal("submit_settlement"), businessId: z.string().min(3).max(180), bank: z.string().min(2).max(160), branch: z.string().max(160).optional(), accountHolder: z.string().min(2).max(180), accountNumber: z.string().min(5).max(80), currency: z.enum(["USD", "ZWG"]), country: z.string().max(80).default("Zimbabwe"), proofStoragePath: z.string().max(1000).optional() });
const payoutSchema = z.object({ action: z.literal("request_payout"), businessId: z.string().min(3).max(180), currency: z.enum(["USD", "ZWG"]), amount: z.number().positive().max(10000000) });
const proofSchema = z.object({ action: z.literal("upload_settlement_proof"), businessId: z.string().min(3).max(180), fileName: z.string().min(1).max(180), mimeType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]), dataBase64: z.string().min(20).max(10_000_000) });


function timeMillis(value) {
  if (value?.toMillis) return value.toMillis();
  if (value?.toDate) return value.toDate().getTime();
  const parsed = value ? new Date(value).getTime() : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function newestDocs(snapshot, max) {
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => timeMillis(b.createdAt || b.updatedAt) - timeMillis(a.createdAt || a.updatedAt))
    .slice(0, max);
}

function paymentPolicy(settings = {}) {
  const cadence = settings.commerce?.payoutCadence || "manual";
  const labels = { daily: "Daily when eligible", twice_weekly: "Twice weekly when eligible", weekly: "Weekly when eligible", biweekly: "Every two weeks when eligible", monthly: "Monthly when eligible", manual: "Processed manually during the controlled pilot" };
  return { model: "platform_settlement", payoutCadence: cadence, payoutPolicyLabel: labels[cadence] || labels.manual, supportedCurrencies: settings.commerce?.currencies || ["USD"], supportedPaymentMethods: settings.commerce?.paymentMethods || ["cash", "paynow"] };
}

function cleanSettlement(snapshot) {
  if (!snapshot?.exists) return null;
  const data = snapshot.data();
  return { id: snapshot.id, country: data.country || "Zimbabwe", bank: data.bank || "", branch: data.branch || "", accountHolder: data.accountHolder || "", accountNumberLast4: data.accountNumberLast4 || "", currency: data.currency || "USD", proofStoragePath: data.proofStoragePath || "", status: data.status || "details_submitted", rejectionReason: data.rejectionReason || "", submittedAt: toPlainTimestamp(data.submittedAt), verifiedAt: toPlainTimestamp(data.verifiedAt), updatedAt: toPlainTimestamp(data.updatedAt) };
}

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    const url = new URL(request.url);
    const businessId = safeText(url.searchParams.get("businessId"), 180);
    const { db, storage } = getAdminServices();
    await requireBusinessPermission(db, user, businessId, "finance.read", { allowRoles: ["organization_owner", "business_owner", "business_manager", "finance_manager", "finance_viewer"] });
    const [finance, settlement, settings, usdBalance, zwgBalance, payouts, ledger] = await Promise.all([
      db.collection("businessFinance").doc(businessId).get(), db.collection("businessSettlementAccounts").doc(businessId).get(), db.collection("platformSettings").doc("global").get(),
      db.collection("businessBalanceAccounts").doc(moneyAccountId(businessId, "USD")).get(), db.collection("businessBalanceAccounts").doc(moneyAccountId(businessId, "ZWG")).get(),
      db.collection("payouts").where("businessId", "==", businessId).limit(250).get(),
      db.collection("businessLedgerEntries").where("businessId", "==", businessId).limit(500).get()
    ]);
    const payoutRows = newestDocs(payouts, 50).map((item) => ({ ...item, createdAt: toPlainTimestamp(item.createdAt), updatedAt: toPlainTimestamp(item.updatedAt), paidAt: toPlainTimestamp(item.paidAt) }));
    const ledgerRows = newestDocs(ledger, 150).map((item) => ({ ...item, createdAt: toPlainTimestamp(item.createdAt), availableAt: toPlainTimestamp(item.availableAt) }));
    return Response.json({ ok: true, finance: finance.exists ? finance.data() : {}, settlement: cleanSettlement(settlement), balances: { USD: sanitizeBalance(usdBalance.exists ? usdBalance.data() : {}), ZWG: sanitizeBalance(zwgBalance.exists ? zwgBalance.data() : {}) }, policy: paymentPolicy(settings.exists ? settings.data() : {}), payouts: payoutRows, ledger: ledgerRows });
  } catch (error) { return apiError(error); }
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    await enforceRateLimit(request, { key: "business-money", identity: user.uid, limit: 40, windowMs: 60 * 60_000 });
    const raw = await request.json();
    const { db, storage, messaging, auth } = getAdminServices();
    if (raw.action === "customer_settings") {
      const body = settingsSchema.parse(raw);
      await requireBusinessPermission(db, user, body.businessId, "finance.configure", { allowRoles: ["organization_owner", "business_owner", "business_manager", "finance_manager"] });
      const platform = await db.collection("platformSettings").doc("global").get();
      const allowedCurrencies = platform.data()?.commerce?.currencies || ["USD"];
      const allowedMethods = platform.data()?.commerce?.paymentMethods || ["cash", "paynow"];
      if (body.acceptedCurrencies.some((item) => !allowedCurrencies.includes(item)) || body.paymentMethods.some((item) => !allowedMethods.includes(item))) throw Object.assign(new Error("One or more payment options are not enabled by Spotly."), { status: 422 });
      await db.collection("businessFinance").doc(body.businessId).set({ acceptedCurrencies: body.acceptedCurrencies, paymentMethods: body.paymentMethods, paymentRecipient: "platform", legalName: safeText(body.legalName, 180), companyRegistrationNumber: safeText(body.companyRegistrationNumber, 100), taxNumber: safeText(body.taxNumber, 100), responsiblePerson: safeText(body.responsiblePerson, 180), registeredAddress: safeText(body.registeredAddress, 300), settlementModel: "platform", updatedAt: FieldValue.serverTimestamp(), updatedBy: user.uid }, { merge: true });
      await db.collection("businesses").doc(body.businessId).set({ moneySetup: { customerSettingsConfigured: true, paymentMethods: body.paymentMethods, acceptedCurrencies: body.acceptedCurrencies, settlementModel: "platform", updatedAt: FieldValue.serverTimestamp() } }, { merge: true });
      return Response.json({ ok: true });
    }
    if (raw.action === "upload_settlement_proof") {
      const body = proofSchema.parse(raw);
      await requireBusinessPermission(db, user, body.businessId, "finance.configure", { allowRoles: ["organization_owner", "business_owner", "finance_manager"] });
      const bytes = Buffer.from(body.dataBase64, "base64");
      if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw Object.assign(new Error("Settlement proof must be 5 MB or smaller."), { status: 413 });
      const extension = body.mimeType === "application/pdf" ? "pdf" : body.mimeType.split("/")[1].replace("jpeg", "jpg");
      const path = `settlement-proofs/${body.businessId}/${user.uid}/${randomUUID()}.${extension}`;
      await storage.bucket().file(path).save(bytes, { resumable: false, metadata: { contentType: body.mimeType, cacheControl: "private,no-store", metadata: { businessId: body.businessId, uploadedBy: user.uid, originalName: safeText(body.fileName, 180) } } });
      return Response.json({ ok: true, storagePath: path });
    }
    if (raw.action === "submit_settlement") {
      const body = settlementSchema.parse(raw);
      await requireBusinessPermission(db, user, body.businessId, "finance.configure", { allowRoles: ["organization_owner", "business_owner", "finance_manager"] });
      const existing = await db.collection("businessSettlementAccounts").doc(body.businessId).get();
      const last4 = accountLast4(body.accountNumber);
      if (existing.exists && existing.data().status === "verified" && existing.data().accountNumberLast4 !== last4) {
        const age = Math.floor(Date.now() / 1000) - Number(user.auth_time || 0);
        if (!user.auth_time || age > 15 * 60) throw Object.assign(new Error("Sign in again before changing a verified settlement account."), { status: 401 });
      }
      const encrypted = encryptFinancialValue(body.accountNumber);
      await db.collection("businessSettlementAccounts").doc(body.businessId).set({ businessId: body.businessId, country: safeText(body.country, 80), bank: safeText(body.bank, 160), branch: safeText(body.branch, 160), accountHolder: safeText(body.accountHolder, 180), accountNumberEncrypted: encrypted, accountNumberLast4: last4, currency: body.currency, proofStoragePath: safeText(body.proofStoragePath, 1000), status: "details_submitted", rejectionReason: "", submittedAt: FieldValue.serverTimestamp(), submittedBy: user.uid, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      await db.collection("businesses").doc(body.businessId).set({ "moneySetup.settlementStatus": "details_submitted", "moneySetup.updatedAt": FieldValue.serverTimestamp() }, { merge: true });
      await db.collection("auditLogs").add({ action: "settlement_account.submitted", entityType: "businessSettlementAccount", entityId: body.businessId, actorId: user.uid, actorEmail: user.email || "", metadata: { businessId: body.businessId, bank: safeText(body.bank, 160), accountNumberLast4: last4, currency: body.currency }, createdAt: FieldValue.serverTimestamp() });
      await Promise.allSettled([
        notifyUser({ db, messaging, auth, userId: user.uid, title: "Settlement details sent to Spotly", body: "Your Business payout destination is saved and waiting for finance review.", href: `/business/money?business=${encodeURIComponent(body.businessId)}`, category: "business_money_review", workspace: "business", module: "money", eventType: "settlement_account.submitted", importance: "high", businessId: body.businessId, entityType: "businessSettlementAccount", entityId: body.businessId, email: true, forceOperationalEmail: true }),
        notifyRoleAudience({ db, messaging, auth, title: "Business settlement account needs review", body: `${safeText(body.accountHolder, 180)} submitted a Business settlement destination for verification.`, href: "/finance", category: "admin_review", workspace: "admin", module: "money", eventType: "settlement_account.submitted", importance: "high", businessId: body.businessId, entityType: "businessSettlementAccount", entityId: body.businessId, email: true, forceOperationalEmail: true }, ["super_admin", "finance_admin", "operations_manager"])
      ]);
      return Response.json({ ok: true, status: "details_submitted", accountNumberLast4: last4 });
    }
    const body = payoutSchema.parse(raw);
    await requireBusinessPermission(db, user, body.businessId, "finance.configure", { allowRoles: ["organization_owner", "business_owner", "finance_manager"] });
    const payoutRef = db.collection("payouts").doc();
    await db.runTransaction(async (transaction) => {
      const settlementRef = db.collection("businessSettlementAccounts").doc(body.businessId);
      const balanceRef = db.collection("businessBalanceAccounts").doc(moneyAccountId(body.businessId, body.currency));
      const [settlement, balance, business] = await Promise.all([transaction.get(settlementRef), transaction.get(balanceRef), transaction.get(db.collection("businesses").doc(body.businessId))]);
      if (!settlement.exists || settlement.data().status !== "verified") throw Object.assign(new Error("Verify the business settlement account before requesting a payout."), { status: 409 });
      if (!business.exists || ["suspended", "disabled"].includes(business.data().status)) throw Object.assign(new Error("This business cannot request a payout right now."), { status: 409 });
      const available = Number(balance.data()?.available || 0);
      const amount = Number(body.amount.toFixed(2));
      if (amount > available + 0.001) throw Object.assign(new Error("The payout exceeds the settled balance currently available."), { status: 422 });
      transaction.create(payoutRef, { businessId: body.businessId, amount, currency: normalizeMoneyCurrency(body.currency), status: "requested", settlementAccountLast4: settlement.data().accountNumberLast4 || "", requestedBy: user.uid, requestedByEmail: user.email || "", ledgerBacked: true, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      postLedgerEntry(transaction, db, { id: moneyEntryId("payout_requested", payoutRef.id), businessId: body.businessId, payoutId: payoutRef.id, currency: body.currency, amount, direction: "transfer", type: "payout_requested", effects: payoutReserveEffects(amount), reference: payoutRef.id, source: "merchant_payout_request", createdBy: user.uid });
      transaction.create(db.collection("auditLogs").doc(), { action: "payout.requested", entityType: "payout", entityId: payoutRef.id, actorId: user.uid, actorEmail: user.email || "", metadata: { businessId: body.businessId, amount, currency: body.currency }, createdAt: FieldValue.serverTimestamp() });
    });
    return Response.json({ ok: true, payoutId: payoutRef.id, status: "requested" });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the money details and try again.", details: error.flatten() }, { status: 400 });
    return apiError(error);
  }
}

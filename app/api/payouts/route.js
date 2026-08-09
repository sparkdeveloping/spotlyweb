import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requireBusinessPermission, requirePlatformPermission } from "@/lib/access-control-server";
import { safeText } from "@/lib/server-helpers";
import { moneyEntryId, payoutPaidEffects, payoutProcessingEffects, payoutRestoreFromProcessingEffects, payoutRestoreFromReservedEffects, postLedgerEntry } from "@/lib/business-money-server";

export const runtime = "nodejs";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("request"), businessId: z.string().min(3).max(180), amount: z.number().positive().max(10000000), currency: z.enum(["USD", "ZWG"]) }),
  z.object({ action: z.literal("update"), payoutId: z.string().min(3).max(180), status: z.enum(["approved", "processing", "paid", "rejected"]), reference: z.string().max(240).optional() })
]);

function audit(transaction, db, user, action, entityId, metadata) {
  transaction.create(db.collection("auditLogs").doc(), {
    action, entityType: "payout", entityId, actorId: user.uid, actorEmail: user.email || "", metadata, createdAt: FieldValue.serverTimestamp()
  });
}

const transitions = {
  requested: new Set(["approved", "rejected"]),
  approved: new Set(["processing", "paid", "rejected"]),
  processing: new Set(["paid", "rejected"]),
  paid: new Set(),
  rejected: new Set()
};

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const body = schema.parse(await request.json());
    const { db } = getAdminServices();

    if (body.action === "request") throw Object.assign(new Error("Use the ledger-backed Business Money payout flow."), { status: 410 });

    requirePlatformPermission(user, "finance.settlement", { roles: ["finance_admin"] });
    const payoutRef = db.collection("payouts").doc(body.payoutId);
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(payoutRef);
      if (!snapshot.exists) throw Object.assign(new Error("The payout was not found."), { status: 404 });
      const payout = snapshot.data();
      const current = payout.status || "requested";
      if (!transitions[current]?.has(body.status)) throw Object.assign(new Error(`A ${current} payout cannot move to ${body.status}.`), { status: 409 });
      if (body.status === "paid" && !String(body.reference || "").trim()) throw Object.assign(new Error("A settlement reference is required before marking a payout paid."), { status: 422 });
      const amount = Number(payout.amount || 0);
      if (body.status === "processing" && current === "approved") {
        postLedgerEntry(transaction, db, { id: moneyEntryId("payout_processing", body.payoutId), businessId: payout.businessId, payoutId: body.payoutId, currency: payout.currency || "USD", amount, direction: "transfer", type: "payout_processing", effects: payoutProcessingEffects(amount), reference: body.payoutId, source: "admin_payout", createdBy: user.uid });
      } else if (body.status === "paid") {
        const effects = current === "processing" ? payoutPaidEffects(amount) : { reserved: -amount, paidOut: amount };
        postLedgerEntry(transaction, db, { id: moneyEntryId("payout_paid", body.payoutId), businessId: payout.businessId, payoutId: body.payoutId, currency: payout.currency || "USD", amount, direction: "debit", type: "payout_paid", effects, reference: body.reference || payout.reference || body.payoutId, source: "admin_payout", createdBy: user.uid });
      } else if (body.status === "rejected") {
        const effects = current === "processing" ? payoutRestoreFromProcessingEffects(amount) : payoutRestoreFromReservedEffects(amount);
        postLedgerEntry(transaction, db, { id: moneyEntryId("payout_cancelled", body.payoutId), businessId: payout.businessId, payoutId: body.payoutId, currency: payout.currency || "USD", amount, direction: "transfer", type: "payout_cancelled", effects, reference: body.payoutId, source: "admin_payout", createdBy: user.uid });
      }
      const patch = {
        status: body.status,
        reference: safeText(body.reference || payout.reference || "", 240),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: user.uid,
        [`${body.status}At`]: FieldValue.serverTimestamp()
      };
      transaction.set(payoutRef, patch, { merge: true });
      audit(transaction, db, user, `payout.${body.status}`, body.payoutId, { businessId: payout.businessId, amount: payout.amount, currency: payout.currency, reference: patch.reference });
    });
    return Response.json({ ok: true, payoutId: body.payoutId, status: body.status });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the payout details.", details: error.flatten() }, { status: 400 });
    return apiError(error);
  }
}

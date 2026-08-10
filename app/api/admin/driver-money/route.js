import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { driverLedgerEntryId, postDriverLedgerEntry } from "@/lib/driver-money-server";
import { safeText } from "@/lib/server-helpers";

export const runtime = "nodejs";
const ROLES = ["super_admin", "admin", "platform_admin", "operations_manager", "finance_admin"];
const schema = z.object({ payoutId: z.string().min(3).max(180), action: z.enum(["approve", "hold", "release", "processing", "paid", "reject"]), reason: z.string().max(1000).optional(), reference: z.string().max(180).optional() });
const transitions = {
  requested: new Set(["approve", "hold", "reject"]),
  approved: new Set(["processing", "hold", "reject"]),
  held: new Set(["release", "reject"]),
  processing: new Set(["paid", "reject"]),
  paid: new Set(),
  rejected: new Set()
};

export async function POST(request) {
  try {
    const actor = await authenticateRequest(request, { roles: ROLES });
    const body = schema.parse(await request.json());
    const reason = safeText(body.reason || "", 1000); const reference = safeText(body.reference || "", 180);
    if (["hold", "reject"].includes(body.action) && reason.length < 3) throw Object.assign(new Error("Add a clear reason for this payout action."), { status: 400 });
    if (body.action === "paid" && reference.length < 3) throw Object.assign(new Error("Add the bank or mobile-money payout reference before marking this payout paid."), { status: 400 });
    const { db } = getAdminServices(); const payoutRef = db.collection("driverPayouts").doc(body.payoutId);
    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(payoutRef);
      if (!snap.exists) throw Object.assign(new Error("The Driver payout was not found."), { status: 404 });
      const payout = snap.data(); const status = payout.status || "requested";
      if (!transitions[status]?.has(body.action)) throw Object.assign(new Error(`A ${status} payout cannot be moved with that action.`), { status: 409 });
      const amount = Number(payout.amount || 0); const currency = payout.currency || "USD"; let nextStatus = status; let effects = null; let type = null;
      if (body.action === "approve") nextStatus = "approved";
      if (body.action === "hold") nextStatus = "held";
      if (body.action === "release") nextStatus = "approved";
      if (body.action === "processing") { nextStatus = "processing"; type = "payout_processing"; effects = { reserved: -amount, processing: amount }; }
      if (body.action === "paid") { nextStatus = "paid"; type = "payout_paid"; effects = { processing: -amount, paid_out: amount }; }
      if (body.action === "reject") { nextStatus = "rejected"; type = "payout_rejected"; effects = status === "processing" ? { processing: -amount, available: amount } : { reserved: -amount, available: amount }; }
      transaction.set(payoutRef, { status: nextStatus, reason: reason || null, reference: reference || payout.reference || null, reviewedBy: actor.uid, updatedAt: FieldValue.serverTimestamp(), ...(nextStatus === "paid" ? { paidAt: FieldValue.serverTimestamp() } : {}), ...(nextStatus === "rejected" ? { rejectedAt: FieldValue.serverTimestamp() } : {}) }, { merge: true });
      if (effects && type) postDriverLedgerEntry(transaction, db, { id: driverLedgerEntryId(type, body.payoutId), driverId: payout.driverId, payoutId: body.payoutId, type, amount, currency, effects, description: type === "payout_paid" ? "Payout paid" : type === "payout_processing" ? "Payout processing" : "Payout returned to available earnings", reference: reference || body.payoutId, source: "admin_driver_money", createdBy: actor.uid });
      transaction.create(db.collection("auditLogs").doc(), { actorId: actor.uid, action: `driver_payout.${body.action}`, entityType: "driverPayout", entityId: body.payoutId, reason, metadata: { driverId: payout.driverId, amount, currency, reference: reference || null, previousStatus: status, nextStatus }, source: "driver_money", createdAt: FieldValue.serverTimestamp() });
    });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the Driver payout action." }, { status: 400 });
    return apiError(error);
  }
}

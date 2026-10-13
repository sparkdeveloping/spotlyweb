import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requirePlatformPermission } from "@/lib/access-control-server";
import { postSettlementAvailableLedger } from "@/lib/business-money-server";
import { safeText, toPlainTimestamp } from "@/lib/server-helpers";
import { notifyUsers } from "@/lib/notification-server";

export const runtime = "nodejs";
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("settlement_decision"), businessId: z.string().min(3).max(180), decision: z.enum(["verify", "reject"]), reason: z.string().max(500).optional() }),
  z.object({ action: z.literal("settle_order"), orderId: z.string().min(3).max(180), reference: z.string().min(2).max(240) })
]);

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    requirePlatformPermission(user, "finance.settlement", { roles: ["finance_admin"] });
    const { db } = getAdminServices();
    const [settlements, orders] = await Promise.all([
      db.collection("businessSettlementAccounts").where("status", "in", ["details_submitted", "action_required"]).limit(100).get(),
      db.collection("orders").where("merchantSettlementStatus", "==", "pending").limit(100).get()
    ]);
    const businessIds = [...new Set([...settlements.docs.map((doc) => doc.id), ...orders.docs.map((doc) => doc.data().businessId).filter(Boolean)])];
    const businesses = businessIds.length ? await db.getAll(...businessIds.map((id) => db.collection("businesses").doc(id))) : [];
    const names = new Map(businesses.filter((doc) => doc.exists).map((doc) => [doc.id, doc.data().name || doc.data().brandName || doc.id]));
    return Response.json({ ok: true, settlements: settlements.docs.map((doc) => { const data = doc.data(); return { businessId: doc.id, businessName: names.get(doc.id) || doc.id, bank: data.bank || "", branch: data.branch || "", accountHolder: data.accountHolder || "", accountNumberLast4: data.accountNumberLast4 || "", currency: data.currency || "USD", status: data.status || "details_submitted", rejectionReason: data.rejectionReason || "", submittedAt: toPlainTimestamp(data.submittedAt), proofStoragePath: data.proofStoragePath || "" }; }), orders: orders.docs.map((doc) => { const data = doc.data(); return { id: doc.id, businessId: data.businessId, businessName: names.get(data.businessId) || data.businessId, orderNumber: data.orderNumber || doc.id, currency: data.currency || "USD", total: data.totals?.total || data.total || 0, merchantNet: Math.max(0, Number(data.totals?.total || data.total || 0) - Number(data.totals?.serviceFee || 0)), paidAt: toPlainTimestamp(data.paidAt), paymentIntentReference: data.paymentIntentReference || "" }; }) });
  } catch (error) { return apiError(error); }
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    requirePlatformPermission(user, "finance.settlement", { roles: ["finance_admin"] });
    const body = schema.parse(await request.json());
    const { db, messaging, auth } = getAdminServices();
    if (body.action === "settlement_decision") {
      const ref = db.collection("businessSettlementAccounts").doc(body.businessId);
      const snapshot = await ref.get();
      if (!snapshot.exists) throw Object.assign(new Error("The settlement account was not found."), { status: 404 });
      const settlementStatus = body.decision === "verify" ? "verified" : "action_required";
      await ref.set(body.decision === "verify" ? { status: settlementStatus, verifiedAt: FieldValue.serverTimestamp(), verifiedBy: user.uid, rejectionReason: "", updatedAt: FieldValue.serverTimestamp() } : { status: settlementStatus, rejectionReason: safeText(body.reason || "Settlement details require correction.", 500), reviewedBy: user.uid, reviewedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      await db.collection("businesses").doc(body.businessId).set({ "moneySetup.settlementStatus": settlementStatus, "moneySetup.updatedAt": FieldValue.serverTimestamp() }, { merge: true });
      await db.collection("auditLogs").add({ action: `settlement_account.${body.decision === "verify" ? "verified" : "rejected"}`, entityType: "businessSettlementAccount", entityId: body.businessId, actorId: user.uid, actorEmail: user.email || "", metadata: { businessId: body.businessId, reason: safeText(body.reason, 500) }, createdAt: FieldValue.serverTimestamp() });
      const businessSnapshot = await db.collection("businesses").doc(body.businessId).get();
      const ownerIds = [...new Set([...(businessSnapshot.data()?.ownerIds || []), snapshot.data()?.submittedBy].filter(Boolean))];
      if (ownerIds.length) {
        await notifyUsers({
          db, messaging, auth,
          title: body.decision === "verify" ? "Settlement account verified" : "Settlement account needs attention",
          body: body.decision === "verify" ? "Spotly verified your Business payout destination." : safeText(body.reason || "Review and correct the settlement details in Business Money.", 500),
          href: `/business/money?business=${encodeURIComponent(body.businessId)}`, category: "business_money_review", workspace: "business", module: "money",
          eventType: `settlement_account.${body.decision === "verify" ? "verified" : "changes_requested"}`, importance: "high", businessId: body.businessId, entityType: "businessSettlementAccount", entityId: body.businessId, email: true, forceOperationalEmail: true
        }, ownerIds).catch(() => {});
      }
      return Response.json({ ok: true });
    }
    const orderRef = db.collection("orders").doc(body.orderId);
    await db.runTransaction(async (transaction) => {
      const orderSnapshot = await transaction.get(orderRef);
      if (!orderSnapshot.exists) throw Object.assign(new Error("The order was not found."), { status: 404 });
      const order = { id: orderSnapshot.id, ...orderSnapshot.data() };
      if (order.paymentStatus !== "paid") throw Object.assign(new Error("Only paid orders can become available for merchant payout."), { status: 409 });
      if (order.merchantSettlementStatus === "available") throw Object.assign(new Error("This order is already available in the merchant ledger."), { status: 409 });
      if (["refunded", "refund_pending"].includes(order.paymentStatus) || order.merchantSettlementStatus === "refunded") throw Object.assign(new Error("A refunded order cannot be made available for payout."), { status: 409 });
      postSettlementAvailableLedger(transaction, db, order, user.uid);
      transaction.set(orderRef, { merchantSettlementStatus: "available", merchantSettlementReference: safeText(body.reference, 240), merchantSettlementUpdatedAt: FieldValue.serverTimestamp() }, { merge: true });
      transaction.create(db.collection("auditLogs").doc(), { action: "merchant_settlement.available", entityType: "order", entityId: body.orderId, actorId: user.uid, actorEmail: user.email || "", metadata: { businessId: order.businessId, reference: safeText(body.reference, 240) }, createdAt: FieldValue.serverTimestamp() });
    });
    return Response.json({ ok: true });
  } catch (error) { if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the finance action." }, { status: 400 }); return apiError(error); }
}

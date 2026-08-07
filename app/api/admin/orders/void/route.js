import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requirePlatformPermission } from "@/lib/access-control-server";
import { releaseReservationInTransaction } from "@/lib/order-reservations-server";
import { safeText } from "@/lib/server-helpers";

export const runtime = "nodejs";
const schema = z.object({ orderId: z.string().min(3).max(180), reason: z.string().min(5).max(500) });

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    requirePlatformPermission(user, "orders.manage", { roles: ["operations_manager", "finance_admin"] });
    const body = schema.parse(await request.json());
    const { db } = getAdminServices();
    const orderRef = db.collection("orders").doc(body.orderId);
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(orderRef);
      if (!snapshot.exists) throw Object.assign(new Error("The order was not found."), { status: 404 });
      const order = snapshot.data();
      if (["paid", "refund_pending", "refunded"].includes(order.paymentStatus)) throw Object.assign(new Error("Paid orders must use the refund workflow."), { status: 409 });
      await releaseReservationInTransaction(transaction, db, orderRef, order, {
        reason: "admin_void",
        actorId: user.uid,
        nextStatus: "void",
        source: "admin_void",
        orderPatch: { voidReason: safeText(body.reason, 500), voidedBy: user.uid, voidedAt: FieldValue.serverTimestamp() }
      });
      transaction.create(db.collection("auditLogs").doc(), {
        action: "order.admin_voided", entityType: "order", entityId: body.orderId, actorId: user.uid, actorEmail: user.email || "",
        metadata: { reason: safeText(body.reason, 500) }, createdAt: FieldValue.serverTimestamp()
      });
    });
    return Response.json({ ok: true, orderId: body.orderId, status: "void" });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "A void reason is required." }, { status: 400 });
    return apiError(error);
  }
}

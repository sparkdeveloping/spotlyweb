import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { releaseOrderReservation } from "@/lib/order-reservations-server";

export const runtime = "nodejs";

const schema = z.object({
  orderId: z.string().min(3).max(180),
  reason: z.enum(["customer_cancelled", "merchant_rejected", "payment_failed", "payment_expired", "order_expired", "admin_void", "refund_before_fulfilment"]),
  status: z.enum(["cancelled", "rejected", "payment_failed", "expired", "void", "refunded"]).optional()
});

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const body = schema.parse(await request.json());
    const { db } = getAdminServices();
    const orderSnapshot = await db.collection("orders").doc(body.orderId).get();
    if (!orderSnapshot.exists) throw Object.assign(new Error("The order was not found."), { status: 404 });
    const order = orderSnapshot.data();
    const roles = new Set(user.profile?.roles || []);
    let allowed = order.customerId === user.uid;
    if (!allowed && order.organizationId) {
      const membership = await db.collection("memberships").doc(`${order.organizationId}_${user.uid}`).get();
      allowed = membership.exists && membership.data().status === "active";
    }
    if (!allowed && order.businessId) {
      const membershipSnapshot = await db.collection("memberships").where("userId", "==", user.uid).where("businessIds", "array-contains", order.businessId).limit(1).get();
      allowed = !membershipSnapshot.empty;
    }
    if (!allowed) allowed = [...roles].some((role) => ["super_admin", "platform_admin", "operations_manager", "finance_admin", "support_manager"].includes(role));
    if (!allowed) throw Object.assign(new Error("You cannot release this order reservation."), { status: 403 });
    const result = await releaseOrderReservation(body.orderId, { reason: body.reason, status: body.status, actorId: user.uid });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the reservation release details." }, { status: 400 });
    return apiError(error);
  }
}

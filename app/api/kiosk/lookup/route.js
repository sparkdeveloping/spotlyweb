import { z } from "zod";
import { apiError, getAdminServices } from "@/lib/firebase-admin";
import { authenticateKiosk } from "@/lib/kiosk-server";
import { docData } from "@/lib/driver-delivery-server";
export const runtime = "nodejs";
const schema = z.object({ code: z.string().min(3).max(80) });
export async function POST(request) {
  try {
    const device = await authenticateKiosk(request);
    if (device.mode !== "pickup_checkin") throw Object.assign(new Error("This kiosk device is not enrolled for that action."), { status: 403 });
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) throw Object.assign(new Error("Enter at least 3 characters from the order or pickup code."), { status: 400 });
    const { db } = getAdminServices(); const code = parsed.data.code.trim().toUpperCase();
    let orderQuery = await db.collection("orders").where("number", "==", code).where("branchId", "==", device.branchId).limit(1).get();
    if (orderQuery.empty) orderQuery = await db.collection("orders").where("pickupCode", "==", code).where("branchId", "==", device.branchId).limit(1).get();
    if (orderQuery.empty) throw Object.assign(new Error("We could not find an order for this code at this location."), { status: 404 });
    const order = { id: orderQuery.docs[0].id, ...orderQuery.docs[0].data() };
    if ((order.fulfilment || "pickup") !== "pickup") throw Object.assign(new Error("This kiosk checks in pickup orders only."), { status: 409 });
    const deliveryQuery = await db.collection("deliveryJobs").where("orderId", "==", order.id).limit(1).get();
    return Response.json({ ok: true, order: { id: order.id, number: order.number, status: order.status, contactName: order.pickup?.contactName || order.contactName || "Customer", itemCount: (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0), fulfilment: order.fulfilment || "pickup" }, delivery: deliveryQuery.empty ? null : (() => { const value = docData(deliveryQuery.docs[0]); return { id: value.id, number: value.number, state: value.state, bagCount: value.bagCount || 1, chilledBagCount: value.chilledBagCount || 0, assignedDriverId: value.assignedDriverId || null }; })() });
  } catch (error) { return apiError(error); }
}

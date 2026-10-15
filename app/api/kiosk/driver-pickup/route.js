import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, getAdminServices } from "@/lib/firebase-admin";
import { authenticateKiosk } from "@/lib/kiosk-server";
import { docData } from "@/lib/driver-delivery-server";
export const runtime = "nodejs";
const schema = z.object({ code: z.string().min(3).max(80) });
export async function POST(request) {
  try {
    const device = await authenticateKiosk(request);
    if (device.mode !== "driver_pickup") throw Object.assign(new Error("This kiosk device is not enrolled for that action."), { status: 403 }); const body = schema.parse(await request.json()); const { db } = getAdminServices(); const code = body.code.trim().toUpperCase();
    let query = await db.collection("deliveryJobs").where("pickupCode", "==", code).where("branchId", "==", device.branchId).limit(1).get();
    if (query.empty) query = await db.collection("deliveryJobs").where("number", "==", code).where("branchId", "==", device.branchId).limit(1).get();
    if (query.empty) throw Object.assign(new Error("We could not find a Driver pickup for this code."), { status: 404 });
    const job = query.docs[0];
    if (!job.data().assignedDriverId) throw Object.assign(new Error("No Driver is assigned to this delivery yet."), { status: 409 });
    const value = docData(job);
    if (value.fulfilmentMode === "driver_shops" && value.state === "shopping_review") {
      const maxAuthorized = Number(value.shopping?.maxAuthorizedMerchandise || 0);
      await job.ref.set({ "shopping.checkoutAuthorizedAt": FieldValue.serverTimestamp(), "shopping.checkoutAuthorizedByKioskId": device.id || null, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return Response.json({ ok: true, checkoutAuthorization: { deliveryJobId: value.id, number: value.number, currency: value.currency || "USD", maxAuthorizedMerchandise: maxAuthorized, projectedSubtotal: Number(value.shopping?.projectedSubtotal || 0), state: "authorized" }, delivery: { id: value.id, number: value.number, state: value.state, assignedDriverId: value.assignedDriverId } });
    }
    if (!["driver_assigned", "driver_to_pickup", "driver_arrived_pickup", "pickup_verification"].includes(value.state)) throw Object.assign(new Error("This delivery is not at the business pickup or shopping checkout stage."), { status: 409 });
    await job.ref.set({ kioskDriverArrivedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return Response.json({ ok: true, delivery: { id: value.id, number: value.number, state: value.state, bagCount: value.bagCount || 1, chilledBagCount: value.chilledBagCount || 0, assignedDriverId: value.assignedDriverId } });
  } catch (error) { return apiError(error); }
}

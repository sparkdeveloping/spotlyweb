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
    if (!["driver_assigned", "driver_to_pickup", "driver_arrived_pickup", "pickup_verification"].includes(job.data().state)) throw Object.assign(new Error("This delivery is not at the business pickup stage."), { status: 409 });
    await job.ref.set({ kioskDriverArrivedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    const value = docData(job); return Response.json({ ok: true, delivery: { id: value.id, number: value.number, state: value.state, bagCount: value.bagCount || 1, chilledBagCount: value.chilledBagCount || 0, assignedDriverId: value.assignedDriverId } });
  } catch (error) { return apiError(error); }
}

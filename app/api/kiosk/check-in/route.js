import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, getAdminServices } from "@/lib/firebase-admin";
import { authenticateKiosk } from "@/lib/kiosk-server";
export const runtime = "nodejs";
const schema = z.object({ orderId: z.string().min(1) });
export async function POST(request) {
  try {
    const device = await authenticateKiosk(request);
    if (device.mode !== "pickup_checkin") throw Object.assign(new Error("This kiosk device is not enrolled for that action."), { status: 403 }); const body = schema.parse(await request.json()); const { db } = getAdminServices(); const ref = db.collection("orders").doc(body.orderId); const snap = await ref.get();
    if (!snap.exists || snap.data().branchId !== device.branchId || (snap.data().fulfilment || "pickup") !== "pickup") throw Object.assign(new Error("The pickup order is not available at this kiosk."), { status: 404 });
    await ref.set({ checkedInAt: FieldValue.serverTimestamp(), kioskDeviceId: device.id, status: snap.data().status === "ready_for_pickup" ? "arrived" : snap.data().status, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await db.collection("kioskDevices").doc(device.id).set({ lastSeenAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}

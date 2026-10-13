import { FieldValue } from "firebase-admin/firestore";
import { apiError, getAdminServices } from "@/lib/firebase-admin";
import { authenticateKiosk } from "@/lib/kiosk-server";
export const runtime = "nodejs";
export async function POST(request) { try { const device = await authenticateKiosk(request); const { db } = getAdminServices(); await db.collection("kioskDevices").doc(device.id).set({ lastSeenAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true }); return Response.json({ ok: true, status: device.status, mode: device.mode }); } catch (error) { return apiError(error); } }

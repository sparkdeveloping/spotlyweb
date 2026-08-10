import "server-only";
import crypto from "node:crypto";
import { getAdminServices } from "@/lib/firebase-admin";
function hash(value) { return crypto.createHash("sha256").update(String(value)).digest("hex"); }
export async function authenticateKiosk(request) {
  const deviceId = request.headers.get("x-spotly-kiosk-device") || "";
  const credential = request.headers.get("x-spotly-kiosk-credential") || "";
  if (!deviceId || !credential) throw Object.assign(new Error("This kiosk is not enrolled."), { status: 401 });
  const { db } = getAdminServices(); const snap = await db.collection("kioskDevices").doc(deviceId).get();
  if (!snap.exists || snap.data().status !== "active" || snap.data().credentialHash !== hash(credential)) throw Object.assign(new Error("This kiosk device is not authorized."), { status: 401 });
  return { id: snap.id, ...snap.data() };
}

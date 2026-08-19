import crypto from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requireBusinessPermission } from "@/lib/access-control-server";
import { safeText } from "@/lib/server-helpers";

export const runtime = "nodejs";
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), businessId: z.string().min(1), branchId: z.string().min(1), name: z.string().min(2).max(120), mode: z.enum(["pickup_checkin", "driver_pickup"]), requireExitPin: z.boolean().default(true), exitPin: z.string().regex(/^\d{4,8}$/).optional() }),
  z.object({ action: z.literal("activate"), enrollmentCode: z.string().min(8).max(80) }),
  z.object({ action: z.literal("revoke"), deviceId: z.string().min(1), businessId: z.string().min(1) })
]);
function token() { return crypto.randomBytes(32).toString("base64url"); }
function hash(value) { return crypto.createHash("sha256").update(String(value)).digest("hex"); }

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    const { db } = getAdminServices();
    const businessId = new URL(request.url).searchParams.get("businessId") || "";
    if (!businessId) throw Object.assign(new Error("Business is required."), { status: 400 });
    await requireBusinessPermission(db, user, businessId, "branches.read", { allowRoles: ["organization_owner", "business_owner", "business_manager", "branch_manager", "operations"] });
    const snap = await db.collection("kioskDevices").where("businessId", "==", businessId).limit(100).get();
    const devices = snap.docs.map((doc) => { const data = doc.data(); return { id: doc.id, businessId: data.businessId, branchId: data.branchId, name: data.name, mode: data.mode, status: data.status, requireExitPin: Boolean(data.requireExitPin), lastSeenAt: data.lastSeenAt?.toDate?.()?.toISOString?.() || data.lastSeenAt || null, createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || null }; });
    return Response.json({ ok: true, devices });
  } catch (error) { return apiError(error); }
}

export async function POST(request) {
  try {
    const body = schema.parse(await request.json()); const { db } = getAdminServices();
    if (body.action === "activate") {
      const codeHash = hash(body.enrollmentCode.trim().toUpperCase());
      const query = await db.collection("kioskDevices").where("enrollmentCodeHash", "==", codeHash).where("status", "==", "pending").limit(1).get();
      if (query.empty) throw Object.assign(new Error("That kiosk enrollment code is invalid or expired."), { status: 404 });
      const device = query.docs[0]; const data = device.data();
      if (data.enrollmentExpiresAt?.toMillis?.() < Date.now()) throw Object.assign(new Error("That kiosk enrollment code expired."), { status: 409 });
      const credential = token();
      await device.ref.set({ status: "active", credentialHash: hash(credential), activatedAt: FieldValue.serverTimestamp(), lastSeenAt: FieldValue.serverTimestamp(), enrollmentCodeHash: null, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return Response.json({ ok: true, deviceId: device.id, credential, businessId: data.businessId, branchId: data.branchId, mode: data.mode, requireExitPin: data.requireExitPin });
    }
    const user = await authenticateRequest(request);
    if (body.action === "create") {
      await requireBusinessPermission(db, user, body.businessId, "branches.update", { branchId: body.branchId, allowRoles: ["organization_owner", "business_owner", "business_manager", "branch_manager"] });
      if (body.requireExitPin && !body.exitPin) throw Object.assign(new Error("Add a staff exit PIN for this kiosk."), { status: 422 });
      const code = crypto.randomBytes(6).toString("hex").toUpperCase(); const ref = db.collection("kioskDevices").doc();
      await ref.set({ businessId: body.businessId, branchId: body.branchId, name: safeText(body.name, 120), mode: body.mode, status: "pending", requireExitPin: body.requireExitPin, exitPinHash: body.exitPin ? hash(body.exitPin) : null, enrollmentCodeHash: hash(code), enrollmentExpiresAt: new Date(Date.now() + 15 * 60000), createdBy: user.uid, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      return Response.json({ ok: true, deviceId: ref.id, enrollmentCode: code, expiresInMinutes: 15 });
    }
    const deviceRef = db.collection("kioskDevices").doc(body.deviceId); const snap = await deviceRef.get();
    if (!snap.exists || snap.data().businessId !== body.businessId) throw Object.assign(new Error("The kiosk device was not found."), { status: 404 });
    await requireBusinessPermission(db, user, body.businessId, "branches.update", { branchId: snap.data().branchId, allowRoles: ["organization_owner", "business_owner", "business_manager", "branch_manager"] });
    await deviceRef.set({ status: "revoked", credentialHash: null, revokedAt: FieldValue.serverTimestamp(), revokedBy: user.uid, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issue = error.issues?.[0];
      const field = issue?.path?.at(-1);
      const message = field === "exitPin"
        ? "Use a 4–8 digit staff exit PIN."
        : field === "name"
          ? "Give the tablet a short name your staff will recognize."
          : field === "enrollmentCode"
            ? "Enter the full kiosk setup code."
            : "Review the kiosk setup details and try again.";
      return Response.json({ ok: false, error: message, details: error.flatten() }, { status: 400 });
    }
    return apiError(error);
  }
}

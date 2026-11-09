import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requirePlatformPermission } from "@/lib/access-control-server";

export const runtime = "nodejs";
const schema = z.object({ entryId: z.string().regex(/^[a-f0-9]{40}$/), enabled: z.boolean() }).strict();
export async function PATCH(request) {
  try {
    const actor = await authenticateRequest(request);
    requirePlatformPermission(actor, "launch.beta");
    const { entryId, enabled } = schema.parse(await request.json());
    const { db } = getAdminServices();
    const ref = db.collection("waitlistEntries").doc(entryId);
    await db.runTransaction(async (tx) => {
      const entry = await tx.get(ref);
      if (!entry.exists || !entry.data()?.accountUid) throw Object.assign(new Error("A registered Spotly account is required before enabling preview access."), { status: 409 });
      const userId = entry.data().accountUid;
      const userRef = db.collection("users").doc(userId);
      const user = await tx.get(userRef);
      if (!user.exists || user.data()?.email?.toLowerCase() !== entry.data().email?.toLowerCase()) throw Object.assign(new Error("Account identity could not be confirmed."), { status: 409 });
      const existing = await tx.get(db.collection("operationGrants").where("userId", "==", userId));
      const previewGrants = existing.docs.filter((doc) => doc.data()?.type === "service_preview" && doc.data()?.status === "active");
      if (enabled) {
        if (!previewGrants.length) {
          const grantRef = db.collection("operationGrants").doc();
          tx.create(grantRef, { userId, type: "service_preview", status: "active", services: [], countries: [], cities: [], reason: "First Access preview invitation", createdBy: actor.uid, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), expiresAt: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60_000)) });
        }
      } else {
        for (const grant of previewGrants) tx.update(grant.ref, { status: "revoked", revokedAt: FieldValue.serverTimestamp(), revokedBy: actor.uid, revokeReason: "First Access preview revoked", updatedAt: FieldValue.serverTimestamp() });
      }
      tx.update(ref, { previewGranted: enabled, ...(enabled ? { status: "invited" } : {}), updatedAt: FieldValue.serverTimestamp() });
      tx.create(db.collection("auditLogs").doc(), { action: enabled ? "operations_grant.first_access_preview_issued" : "operations_grant.first_access_preview_revoked", entityType: "user", entityId: userId, actorId: actor.uid, actorEmail: actor.email || "", metadata: { entryId, grantType: "service_preview" }, createdAt: FieldValue.serverTimestamp() });
    });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Invalid preview-access change." }, { status: 400 });
    return apiError(error);
  }
}

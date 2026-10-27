import { FieldValue } from "firebase-admin/firestore";
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
      if (!entry.exists || !entry.data()?.accountUid) throw Object.assign(new Error("A registered Spotly account is required before enabling beta."), { status: 409 });
      const userRef = db.collection("users").doc(entry.data().accountUid);
      const user = await tx.get(userRef);
      if (!user.exists || user.data()?.email?.toLowerCase() !== entry.data().email?.toLowerCase()) {
        throw Object.assign(new Error("Account identity could not be confirmed."), { status: 409 });
      }
      tx.update(userRef, { privateBeta: enabled, updatedAt: FieldValue.serverTimestamp(), updatedBy: actor.uid });
      tx.update(ref, { betaEnabled: enabled, ...(enabled ? { status: "invited" } : {}), updatedAt: FieldValue.serverTimestamp() });
      tx.create(db.collection("auditLogs").doc(), { action: enabled ? "first_access.beta_granted" : "first_access.beta_revoked", entityType: "user", entityId: entry.data().accountUid,
        actorId: actor.uid, actorEmail: actor.email || "", metadata: { entryId }, createdAt: FieldValue.serverTimestamp() });
    });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Invalid beta change." }, { status: 400 });
    return apiError(error);
  }
}

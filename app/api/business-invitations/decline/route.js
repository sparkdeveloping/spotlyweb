import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";

export const runtime = "nodejs";
const schema = z.object({ invitationId: z.string().min(3).max(180) });

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const body = schema.parse(await request.json());
    const { db } = getAdminServices();
    const ref = db.collection("businessInvitations").doc(body.invitationId);
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw Object.assign(new Error("The invitation was not found."), { status: 404 });
      const invitation = snapshot.data();
      if (String(invitation.email || "").toLowerCase() !== String(user.email || "").toLowerCase()) throw Object.assign(new Error("This invitation belongs to another account."), { status: 403 });
      if (invitation.status !== "pending") throw Object.assign(new Error("This invitation is no longer pending."), { status: 409 });
      transaction.set(ref, { status: "declined", declinedBy: user.uid, declinedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      transaction.create(db.collection("auditLogs").doc(), { action: "business_invitation.declined", entityType: "businessInvitation", entityId: body.invitationId, actorId: user.uid, actorEmail: user.email || "", metadata: { businessId: invitation.businessId || null }, createdAt: FieldValue.serverTimestamp() });
    });
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

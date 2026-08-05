import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";

export const runtime = "nodejs";
const schema = z.object({ invitationId: z.string().min(8).max(160) });

const ROLE_LEVEL = {
  organization_owner: 100,
  business_owner: 95,
  business_manager: 80,
  branch_manager: 65,
  finance_manager: 60,
  order_manager: 55,
  catalog_manager: 50,
  order_staff: 35,
  picker: 30,
  finance_viewer: 20
};

function strongestRole(currentRole, invitedRole) {
  if (!currentRole) return invitedRole || "order_staff";
  if (!invitedRole) return currentRole;
  return (ROLE_LEVEL[invitedRole] || 0) > (ROLE_LEVEL[currentRole] || 0) ? invitedRole : currentRole;
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const { invitationId } = schema.parse(await request.json());
    const { db } = getAdminServices();
    const invitationRef = db.collection("businessInvitations").doc(invitationId);

    const result = await db.runTransaction(async (transaction) => {
      const invitationSnapshot = await transaction.get(invitationRef);
      if (!invitationSnapshot.exists) throw Object.assign(new Error("This invitation no longer exists."), { status: 404 });

      const invitation = invitationSnapshot.data();
      if (invitation.status !== "pending") throw Object.assign(new Error(`This invitation is ${invitation.status || "not available"}.`), { status: 409 });
      if (invitation.expiresAt && new Date(invitation.expiresAt).getTime() < Date.now()) {
        transaction.set(invitationRef, { status: "expired", expiredAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        throw Object.assign(new Error("This invitation has expired. Ask the business owner to resend it."), { status: 410 });
      }
      if (!user.email || user.email.toLowerCase() !== String(invitation.email || "").toLowerCase()) {
        throw Object.assign(new Error(`Sign in with ${invitation.email} to accept this invitation.`), { status: 403 });
      }

      const membershipId = `${invitation.organizationId || invitation.businessId}_${user.uid}`;
      const membershipRef = db.collection("memberships").doc(membershipId);
      const membershipSnapshot = await transaction.get(membershipRef);
      const existing = membershipSnapshot.exists ? membershipSnapshot.data() : {};
      const businessIds = [...new Set([...(existing.businessIds || []), invitation.businessId].filter(Boolean))];
      const branchIds = [...new Set([...(existing.branchIds || []), ...(invitation.branchIds || [])].filter(Boolean))];
      const permissions = [...new Set([...(existing.permissions || []), ...(invitation.permissions || [])])];

      transaction.set(membershipRef, {
        organizationId: invitation.organizationId || existing.organizationId || null,
        businessId: existing.businessId || invitation.businessId,
        businessIds,
        branchIds,
        userId: user.uid,
        email: user.email,
        displayName: user.name || invitation.name || existing.displayName || "",
        role: strongestRole(existing.role, invitation.role),
        permissions,
        status: "active",
        invitationIds: [...new Set([...(existing.invitationIds || []), invitationId])],
        ...(membershipSnapshot.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      transaction.update(invitationRef, {
        status: "accepted",
        acceptedBy: user.uid,
        acceptedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
      transaction.set(db.collection("users").doc(user.uid), {
        roles: FieldValue.arrayUnion("business"),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      transaction.set(db.collection("auditLogs").doc(), {
        action: "business_invitation.accepted",
        entityType: "businessInvitation",
        entityId: invitationId,
        actorId: user.uid,
        actorEmail: user.email,
        metadata: { businessId: invitation.businessId, organizationId: invitation.organizationId || null, membershipId },
        createdAt: FieldValue.serverTimestamp()
      });

      return { businessId: invitation.businessId, membershipId };
    });

    return Response.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "The invitation link is incomplete." }, { status: 400 });
    return apiError(error);
  }
}

import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { assertGrantSubset, canGrantRole, getBusinessContext, requireBusinessPermission } from "@/lib/access-control-server";
import { businessRoleTemplates } from "@/data/business-config";

export const runtime = "nodejs";
const schema = z.object({ invitationId: z.string().min(8).max(160) });
const roleIds = new Set(businessRoleTemplates.map((item) => item.id));

function expectedPermissions(role, submitted = []) {
  if (role === "custom") return [...new Set(submitted)];
  return [...(businessRoleTemplates.find((item) => item.id === role)?.permissions || [])];
}

function sameSet(a = [], b = []) {
  const left = [...new Set(a)].sort();
  const right = [...new Set(b)].sort();
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const { invitationId } = schema.parse(await request.json());
    const { db } = getAdminServices();
    const invitationRef = db.collection("businessInvitations").doc(invitationId);

    const invitationSnapshot = await invitationRef.get();
    if (!invitationSnapshot.exists) throw Object.assign(new Error("This invitation no longer exists."), { status: 404 });
    const invitation = invitationSnapshot.data();
    if (invitation.status !== "pending") throw Object.assign(new Error(`This invitation is ${invitation.status || "not available"}.`), { status: 409 });
    if (invitation.serverIssued !== true || invitation.grantVersion !== 1) {
      throw Object.assign(new Error("This invitation was created before Spotly's current access controls. Ask the business owner to resend it."), { status: 409 });
    }
    if (invitation.expiresAt && new Date(invitation.expiresAt).getTime() < Date.now()) {
      await invitationRef.set({ status: "expired", expiredAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      throw Object.assign(new Error("This invitation has expired. Ask the business owner to resend it."), { status: 410 });
    }
    if (!user.email || user.email.toLowerCase() !== String(invitation.email || "").toLowerCase()) {
      throw Object.assign(new Error(`Sign in with ${invitation.email} to accept this invitation.`), { status: 403 });
    }
    if (!invitation.businessId || !invitation.organizationId || !invitation.issuedBy) {
      throw Object.assign(new Error("This invitation is missing verified grant information. Ask the business owner to resend it."), { status: 409 });
    }
    if (!roleIds.has(invitation.role)) throw Object.assign(new Error("This invitation contains an unsupported role."), { status: 409 });

    const [businessSnapshot, issuerSnapshot, branchSnapshots] = await Promise.all([
      db.collection("businesses").doc(invitation.businessId).get(),
      db.collection("users").doc(invitation.issuedBy).get(),
      Promise.all((invitation.branchIds || []).map((id) => db.collection("branches").doc(id).get()))
    ]);
    if (!businessSnapshot.exists || businessSnapshot.data().organizationId !== invitation.organizationId) {
      throw Object.assign(new Error("The invitation no longer matches the business organization."), { status: 409 });
    }
    if (branchSnapshots.some((snapshot) => !snapshot.exists || snapshot.data().businessId !== invitation.businessId)) {
      throw Object.assign(new Error("The invitation contains a location that no longer belongs to this business."), { status: 409 });
    }
    if (!issuerSnapshot.exists) throw Object.assign(new Error("The invitation issuer is no longer available. Ask another owner to resend it."), { status: 409 });

    const issuer = { uid: invitation.issuedBy, profile: issuerSnapshot.data() };
    const issuerContext = await requireBusinessPermission(db, issuer, invitation.businessId, "staff.manage", { allowRoles: ["organization_owner", "business_owner", "business_manager"] });
    if (!canGrantRole(issuerContext, invitation.role)) throw Object.assign(new Error("The invitation issuer no longer has authority to grant this role."), { status: 409 });
    const canonicalPermissions = expectedPermissions(invitation.role, invitation.permissions || []);
    if (!sameSet(canonicalPermissions, invitation.permissions || [])) throw Object.assign(new Error("The invitation permission grant is not valid."), { status: 409 });
    if (invitation.role === "custom") assertGrantSubset(issuerContext, { branchIds: invitation.branchIds || [], permissions: canonicalPermissions });

    const membershipId = `${invitation.organizationId}_${user.uid}`;
    const membershipRef = db.collection("memberships").doc(membershipId);
    const result = await db.runTransaction(async (transaction) => {
      const freshInvitationSnapshot = await transaction.get(invitationRef);
      if (!freshInvitationSnapshot.exists || freshInvitationSnapshot.data().status !== "pending") {
        throw Object.assign(new Error("This invitation has already been used or is no longer available."), { status: 409 });
      }
      const membershipSnapshot = await transaction.get(membershipRef);
      const existing = membershipSnapshot.exists ? membershipSnapshot.data() : {};
      const businessIds = [...new Set([...(existing.businessIds || []), invitation.businessId])];
      const branchIds = [...new Set([...(existing.branchIds || []), ...(invitation.branchIds || [])])];
      const permissions = [...new Set([...(existing.permissions || []), ...canonicalPermissions])];

      transaction.set(membershipRef, {
        organizationId: invitation.organizationId,
        businessId: existing.businessId || invitation.businessId,
        businessIds,
        branchIds,
        userId: user.uid,
        email: user.email,
        displayName: user.name || invitation.name || existing.displayName || "",
        role: existing.role || invitation.role,
        permissions,
        status: "active",
        invitationIds: [...new Set([...(existing.invitationIds || []), invitationId])],
        ...(membershipSnapshot.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      transaction.update(invitationRef, { status: "accepted", acceptedBy: user.uid, acceptedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      transaction.set(db.collection("users").doc(user.uid), { roles: FieldValue.arrayUnion("business"), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      transaction.create(db.collection("auditLogs").doc(), {
        action: "business_invitation.accepted",
        entityType: "businessInvitation",
        entityId: invitationId,
        actorId: user.uid,
        actorEmail: user.email,
        metadata: { businessId: invitation.businessId, organizationId: invitation.organizationId, membershipId },
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

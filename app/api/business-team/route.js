import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { assertGrantSubset, canGrantRole, getBusinessContext, isPlatformAdmin, requireBusinessPermission, roleLevel } from "@/lib/access-control-server";
import { businessRoleTemplates } from "@/data/business-config";
import { safeText } from "@/lib/server-helpers";

export const runtime = "nodejs";

const roleIds = businessRoleTemplates.map((item) => item.id);
const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("invite"),
    businessId: z.string().min(3).max(180),
    name: z.string().max(160).optional(),
    email: z.string().email().max(254),
    role: z.enum(roleIds),
    branchIds: z.array(z.string().min(1).max(180)).max(100).default([]),
    permissions: z.array(z.string().min(1).max(120)).max(100).default([])
  }),
  z.object({
    action: z.literal("update_member"),
    businessId: z.string().min(3).max(180),
    membershipId: z.string().min(3).max(220),
    role: z.enum(roleIds),
    branchIds: z.array(z.string().min(1).max(180)).max(100).default([]),
    permissions: z.array(z.string().min(1).max(120)).max(100).default([]),
    status: z.enum(["active", "suspended"])
  }),
  z.object({ action: z.literal("resend"), businessId: z.string().min(3).max(180), invitationId: z.string().min(3).max(180) }),
  z.object({ action: z.literal("revoke"), businessId: z.string().min(3).max(180), invitationId: z.string().min(3).max(180) })
]);

const grantableByRole = {
  organization_owner: new Set(roleIds),
  business_owner: new Set(roleIds),
  business_manager: new Set(["branch_manager", "catalog_manager", "order_staff", "picker", "custom"]),
  branch_manager: new Set(["order_staff", "picker", "custom"])
};

function templatePermissions(role, submitted) {
  if (role === "custom") return [...new Set(submitted)];
  return [...(businessRoleTemplates.find((item) => item.id === role)?.permissions || [])];
}

function assertRoleGrant(context, role) {
  if (context.platformAdmin) return;
  const actorRole = context.membership?.role || "";
  if (!grantableByRole[actorRole]?.has(role) || !canGrantRole(context, role)) {
    throw Object.assign(new Error("Your role cannot grant that level of business access."), { status: 403 });
  }
}

async function validateBranches(db, businessId, branchIds) {
  if (!branchIds.length) return;
  const snapshots = await Promise.all(branchIds.map((id) => db.collection("branches").doc(id).get()));
  if (snapshots.some((snapshot) => !snapshot.exists || snapshot.data().businessId !== businessId)) {
    throw Object.assign(new Error("One or more selected locations do not belong to this business."), { status: 422 });
  }
}

function audit(transaction, db, user, action, entityType, entityId, metadata = {}) {
  transaction.create(db.collection("auditLogs").doc(), {
    action,
    entityType,
    entityId,
    actorId: user.uid,
    actorEmail: user.email || "",
    metadata,
    createdAt: FieldValue.serverTimestamp()
  });
}

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    const url = new URL(request.url);
    const businessId = String(url.searchParams.get("businessId") || "").trim();
    if (!businessId) throw Object.assign(new Error("A business is required."), { status: 400 });
    const { db } = getAdminServices();
    const context = await requireBusinessPermission(db, user, businessId, "staff.read", { allowRoles: ["organization_owner", "business_owner", "business_manager", "branch_manager"] });

    const [membersSnapshot, invitationsSnapshot] = await Promise.all([
      db.collection("memberships").where("businessIds", "array-contains", businessId).limit(250).get(),
      db.collection("businessInvitations").where("businessId", "==", businessId).orderBy("createdAt", "desc").limit(100).get()
    ]);
    const actorBranches = context.membership?.branchIds || [];
    const memberRecords = membersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const members = context.businessWide ? memberRecords : memberRecords.filter((member) => (member.branchIds || []).some((id) => actorBranches.includes(id)));
    const userIds = [...new Set(members.map((member) => member.userId).filter(Boolean))];
    const userSnapshots = userIds.length ? await db.getAll(...userIds.map((id) => db.collection("users").doc(id))) : [];
    const profiles = new Map(userSnapshots.filter((snapshot) => snapshot.exists).map((snapshot) => [snapshot.id, snapshot.data()]));
    const enrichedMembers = members.map((member) => {
      const profile = profiles.get(member.userId) || {};
      return {
        ...member,
        displayName: member.displayName || profile.displayName || profile.email || "Team member",
        email: member.email || profile.email || ""
      };
    });
    const invitationRecords = invitationsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const invitations = context.businessWide ? invitationRecords : invitationRecords.filter((invite) => (invite.branchIds || []).some((id) => actorBranches.includes(id)));
    return Response.json({ ok: true, members: enrichedMembers, invitations });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const body = actionSchema.parse(await request.json());
    const { db } = getAdminServices();
    const context = await requireBusinessPermission(db, user, body.businessId, "staff.manage", { allowRoles: ["organization_owner", "business_owner", "business_manager"] });

    if (body.action === "invite") {
      assertRoleGrant(context, body.role);
      await validateBranches(db, body.businessId, body.branchIds);
      const permissions = templatePermissions(body.role, body.permissions);
      if (body.role === "custom") assertGrantSubset(context, { branchIds: body.branchIds, permissions });
      else if (!context.businessWide) assertGrantSubset(context, { branchIds: body.branchIds, permissions: [] });

      const invitationRef = db.collection("businessInvitations").doc();
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      await db.runTransaction(async (transaction) => {
        transaction.create(invitationRef, {
          businessId: body.businessId,
          organizationId: context.business.organizationId || null,
          email: body.email.trim().toLowerCase(),
          name: safeText(body.name || "", 160),
          role: body.role,
          branchIds: body.branchIds,
          permissions,
          status: "pending",
          invitedBy: user.uid,
          issuedBy: user.uid,
          serverIssued: true,
          grantVersion: 1,
          expiresAt,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
        audit(transaction, db, user, "business_staff.invited", "businessInvitation", invitationRef.id, { businessId: body.businessId, email: body.email.toLowerCase(), role: body.role, branchIds: body.branchIds });
      });
      return Response.json({ ok: true, invitationId: invitationRef.id });
    }

    if (body.action === "update_member") {
      const memberRef = db.collection("memberships").doc(body.membershipId);
      const memberSnapshot = await memberRef.get();
      if (!memberSnapshot.exists) throw Object.assign(new Error("The team membership was not found."), { status: 404 });
      const member = memberSnapshot.data();
      const belongs = member.businessId === body.businessId || (member.businessIds || []).includes(body.businessId);
      if (!belongs) throw Object.assign(new Error("That membership does not belong to this business."), { status: 403 });
      if (member.userId === user.uid && !isPlatformAdmin(user)) throw Object.assign(new Error("You cannot change your own access. Ask another owner or Spotly administrator."), { status: 409 });
      if (!context.platformAdmin && roleLevel(member.role) >= roleLevel(context.membership?.role)) throw Object.assign(new Error("You cannot manage a teammate at or above your own access level."), { status: 403 });
      assertRoleGrant(context, body.role);
      await validateBranches(db, body.businessId, body.branchIds);
      const permissions = templatePermissions(body.role, body.permissions);
      if (body.role === "custom") assertGrantSubset(context, { branchIds: body.branchIds, permissions });
      else if (!context.businessWide) assertGrantSubset(context, { branchIds: body.branchIds, permissions: [] });

      await db.runTransaction(async (transaction) => {
        transaction.update(memberRef, { businessId: body.businessId, businessIds: Array.from(new Set([...(member.businessIds || []), body.businessId])), role: body.role, branchIds: body.branchIds, permissions, status: body.status, updatedAt: FieldValue.serverTimestamp(), updatedBy: user.uid });
        audit(transaction, db, user, "business_membership.updated", "membership", body.membershipId, { businessId: body.businessId, role: body.role, branchIds: body.branchIds, status: body.status });
      });
      return Response.json({ ok: true, membershipId: body.membershipId });
    }

    const invitationRef = db.collection("businessInvitations").doc(body.invitationId);
    const invitationSnapshot = await invitationRef.get();
    if (!invitationSnapshot.exists) throw Object.assign(new Error("The invitation was not found."), { status: 404 });
    const invitation = invitationSnapshot.data();
    if (invitation.businessId !== body.businessId) throw Object.assign(new Error("That invitation belongs to another business."), { status: 403 });

    if (body.action === "resend") {
      assertRoleGrant(context, invitation.role || "order_staff");
      const permissions = templatePermissions(invitation.role || "order_staff", invitation.permissions || []);
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      await db.runTransaction(async (transaction) => {
        transaction.set(invitationRef, {
          permissions,
          serverIssued: true,
          grantVersion: 1,
          issuedBy: user.uid,
          status: "pending",
          resendCount: FieldValue.increment(1),
          lastSentAt: FieldValue.serverTimestamp(),
          expiresAt,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: user.uid
        }, { merge: true });
        audit(transaction, db, user, "business_invitation.resent", "businessInvitation", body.invitationId, { businessId: body.businessId });
      });
      return Response.json({ ok: true, invitationId: body.invitationId });
    }

    await db.runTransaction(async (transaction) => {
      transaction.set(invitationRef, { status: "revoked", revokedAt: FieldValue.serverTimestamp(), revokedBy: user.uid, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      audit(transaction, db, user, "business_invitation.revoked", "businessInvitation", body.invitationId, { businessId: body.businessId });
    });
    return Response.json({ ok: true, invitationId: body.invitationId });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the team access details.", details: error.flatten() }, { status: 400 });
    return apiError(error);
  }
}

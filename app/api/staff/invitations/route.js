import crypto from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requireSpotlyStaffPermission } from "@/lib/access-control-server";
import { STAFF_DEPARTMENTS, STAFF_EMPLOYMENT_TYPES, STAFF_ROLE_PACKS } from "@/data/staff";
import { safeText } from "@/lib/server-helpers";

export const runtime = "nodejs";

const roleIds = Object.keys(STAFF_ROLE_PACKS);
const createSchema = z.object({
  action: z.literal("create"),
  email: z.string().email().max(254),
  fullName: z.string().min(2).max(160),
  rolePackId: z.enum(roleIds),
  department: z.enum(STAFF_DEPARTMENTS).optional(),
  employmentType: z.enum(STAFF_EMPLOYMENT_TYPES).default("Permanent"),
  managerId: z.string().max(180).optional(),
  startDate: z.string().max(40).optional()
});
const decisionSchema = z.object({
  action: z.enum(["approve", "request_changes", "revoke"]),
  invitationId: z.string().min(3).max(180),
  note: z.string().max(800).optional()
});
const acceptSchema = z.object({
  action: z.literal("submit_onboarding"),
  token: z.string().min(24).max(300),
  fullName: z.string().min(2).max(160),
  phone: z.string().min(5).max(40),
  emergencyContactName: z.string().min(2).max(160),
  emergencyContactPhone: z.string().min(5).max(40),
  workArrangement: z.enum(["office", "hybrid", "remote", "field"]).default("office"),
  acknowledgement: z.literal(true)
});

function tokenHash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function expiryDate(days = 7) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

async function peoplePermission(db, user, permission = "people.approve") {
  return requireSpotlyStaffPermission(db, user, permission, { roles: ["people_operations_admin", "operations_manager", "platform_admin"] });
}

function inviteView(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    email: data.email,
    fullName: data.fullName,
    rolePackId: data.rolePackId,
    roleTitle: data.roleTitle,
    department: data.department,
    employmentType: data.employmentType,
    managerId: data.managerId || "",
    managerName: data.managerName || "",
    startDate: data.startDate || "",
    status: data.status,
    expiresAt: data.expiresAt,
    submittedAt: data.submittedAt || null,
    submittedBy: data.submittedBy || "",
    onboarding: data.onboarding || null,
    reviewNote: data.reviewNote || "",
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null
  };
}

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    const { db } = getAdminServices();
    await peoplePermission(db, user, "people.read");
    const snapshot = await db.collection("staffInvitations").orderBy("createdAt", "desc").limit(150).get();
    return Response.json({ ok: true, invitations: snapshot.docs.map(inviteView) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const raw = await request.json();
    const { db } = getAdminServices();

    if (raw.action === "submit_onboarding") {
      const body = acceptSchema.parse(raw);
      const hash = tokenHash(body.token);
      const snapshot = await db.collection("staffInvitations").where("tokenHash", "==", hash).limit(1).get();
      if (snapshot.empty) throw Object.assign(new Error("This onboarding link is invalid or no longer available."), { status: 404 });
      const invitationDoc = snapshot.docs[0];
      const invitation = invitationDoc.data();
      if (!["pending", "changes_requested"].includes(invitation.status)) throw Object.assign(new Error("This onboarding link has already been used or closed."), { status: 409 });
      if (Date.parse(invitation.expiresAt || 0) < Date.now()) throw Object.assign(new Error("This onboarding link has expired. Ask People Operations for a new link."), { status: 410 });
      const signedInEmail = String(user.email || user.profile?.email || "").trim().toLowerCase();
      if (!signedInEmail || signedInEmail !== String(invitation.email || "").toLowerCase()) {
        throw Object.assign(new Error(`Sign in with ${invitation.email} to complete this onboarding.`), { status: 403 });
      }
      await invitationDoc.ref.set({
        status: "awaiting_approval",
        submittedBy: user.uid,
        submittedAt: FieldValue.serverTimestamp(),
        onboarding: {
          fullName: safeText(body.fullName, 160),
          phone: safeText(body.phone, 40),
          emergencyContactName: safeText(body.emergencyContactName, 160),
          emergencyContactPhone: safeText(body.emergencyContactPhone, 40),
          workArrangement: body.workArrangement,
          acknowledgement: true
        },
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      await db.collection("auditLogs").add({ action: "staff_onboarding.submitted", entityType: "staffInvitation", entityId: invitationDoc.id, actorId: user.uid, actorEmail: signedInEmail, metadata: { rolePackId: invitation.rolePackId }, createdAt: FieldValue.serverTimestamp() });
      return Response.json({ ok: true, status: "awaiting_approval" });
    }

    if (raw.action === "create") {
      const body = createSchema.parse(raw);
      await peoplePermission(db, user, "people.write");
      const email = body.email.trim().toLowerCase();
      const existing = await db.collection("staffInvitations").where("email", "==", email).where("status", "in", ["pending", "changes_requested", "awaiting_approval"]).limit(1).get();
      if (!existing.empty) throw Object.assign(new Error("An open onboarding invitation already exists for this email."), { status: 409 });
      const pack = STAFF_ROLE_PACKS[body.rolePackId];
      const managerSnapshot = body.managerId ? await db.collection("staffProfiles").doc(body.managerId).get() : null;
      const managerName = managerSnapshot?.exists ? safeText(managerSnapshot.data().displayName || managerSnapshot.data().fullName || managerSnapshot.data().email || "", 160) : "";
      const token = crypto.randomBytes(32).toString("base64url");
      const ref = db.collection("staffInvitations").doc();
      await ref.set({
        email,
        fullName: safeText(body.fullName, 160),
        rolePackId: body.rolePackId,
        roleTitle: pack.name,
        department: body.department || pack.department,
        employmentType: body.employmentType,
        managerId: body.managerId || "",
        managerName,
        startDate: body.startDate || "",
        tokenHash: tokenHash(token),
        status: "pending",
        expiresAt: expiryDate(7),
        invitedBy: user.uid,
        invitedByEmail: user.email || "",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
      await db.collection("auditLogs").add({ action: "staff_onboarding.invited", entityType: "staffInvitation", entityId: ref.id, actorId: user.uid, actorEmail: user.email || "", metadata: { email, rolePackId: body.rolePackId }, createdAt: FieldValue.serverTimestamp() });
      return Response.json({ ok: true, invitationId: ref.id, onboardingUrl: `https://staff.spotlyafrica.com/onboard?token=${encodeURIComponent(token)}`, expiresAt: expiryDate(7) });
    }

    const body = decisionSchema.parse(raw);
    await peoplePermission(db, user, "people.approve");
    const ref = db.collection("staffInvitations").doc(body.invitationId);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw Object.assign(new Error("The staff invitation was not found."), { status: 404 });
    const invitation = snapshot.data();

    if (body.action === "revoke") {
      await ref.set({ status: "revoked", reviewNote: safeText(body.note, 800), reviewedBy: user.uid, reviewedAt: FieldValue.serverTimestamp(), tokenHash: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return Response.json({ ok: true, status: "revoked" });
    }
    if (invitation.status !== "awaiting_approval") throw Object.assign(new Error("This onboarding submission is not waiting for approval."), { status: 409 });
    if (body.action === "request_changes") {
      if (!safeText(body.note, 800)) throw Object.assign(new Error("Explain what the new staff member needs to correct."), { status: 422 });
      await ref.set({ status: "changes_requested", reviewNote: safeText(body.note, 800), reviewedBy: user.uid, reviewedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return Response.json({ ok: true, status: "changes_requested" });
    }

    const pack = STAFF_ROLE_PACKS[invitation.rolePackId];
    if (!pack) throw Object.assign(new Error("The invitation role is no longer valid."), { status: 409 });
    const onboarding = invitation.onboarding || {};
    const staffUserId = invitation.submittedBy;
    if (!staffUserId) throw Object.assign(new Error("The invitee account could not be resolved."), { status: 409 });
    const profileRef = db.collection("staffProfiles").doc(staffUserId);
    await db.runTransaction(async (transaction) => {
      transaction.set(profileRef, {
        userId: staffUserId,
        displayName: safeText(onboarding.fullName || invitation.fullName, 160),
        email: invitation.email,
        phone: safeText(onboarding.phone, 40),
        emergencyContactName: safeText(onboarding.emergencyContactName, 160),
        emergencyContactPhone: safeText(onboarding.emergencyContactPhone, 40),
        workArrangement: onboarding.workArrangement || "office",
        rolePackId: invitation.rolePackId,
        roleTitle: pack.name,
        department: invitation.department || pack.department,
        employmentType: invitation.employmentType || "Permanent",
        managerId: invitation.managerId || "",
        managerName: invitation.managerName || "",
        startDate: invitation.startDate || "",
        permissions: pack.permissions,
        status: "probation",
        onboardingStatus: "approved",
        onboardingInvitationId: ref.id,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: user.uid,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: user.uid
      }, { merge: true });
      transaction.set(ref, { status: "approved", approvedBy: user.uid, approvedAt: FieldValue.serverTimestamp(), reviewNote: safeText(body.note, 800), tokenHash: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      transaction.create(db.collection("auditLogs").doc(), { action: "staff_onboarding.approved", entityType: "staffProfile", entityId: staffUserId, actorId: user.uid, actorEmail: user.email || "", metadata: { invitationId: ref.id, rolePackId: invitation.rolePackId }, createdAt: FieldValue.serverTimestamp() });
    });
    return Response.json({ ok: true, status: "approved", userId: staffUserId });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the onboarding information.", details: error.flatten() }, { status: 400 });
    return apiError(error);
  }
}

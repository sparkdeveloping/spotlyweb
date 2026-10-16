import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { STAFF_DEPARTMENTS, STAFF_EMPLOYMENT_TYPES, STAFF_ROLE_PACKS } from "@/data/staff";
import { requireSpotlyStaffPermission } from "@/lib/access-control-server";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const rolePackIds = Object.keys(STAFF_ROLE_PACKS);
const lifecycleStates = ["preboarding", "probation", "active", "leave", "suspended", "offboarding", "former"];
const text = (max) => z.string().trim().max(max).optional().default("");

const profileSchema = z.object({
  action: z.literal("save_profile"),
  userId: z.string().min(3).max(180),
  displayName: z.string().trim().min(2).max(160),
  email: z.union([z.string().email().max(254), z.literal("")]).optional().default(""),
  rolePackId: z.enum(rolePackIds),
  department: z.enum(STAFF_DEPARTMENTS),
  employmentType: z.enum(STAFF_EMPLOYMENT_TYPES),
  status: z.enum(lifecycleStates),
  startDate: text(40),
  probationEndDate: text(40),
  employeeNumber: text(80),
  managerId: text(180),
  managerName: text(160),
  endDate: text(40),
  offboardingReason: text(1000),
  accessEndDate: text(40),
  equipmentReturnDue: text(40),
  handoverOwnerId: text(180),
  handoverOwnerName: text(160)
});

function compactText(value, max) {
  return String(value || "").trim().slice(0, max);
}

export async function POST(request) {
  try {
    const actor = await authenticateRequest(request);
    const { db } = getAdminServices();
    await requireSpotlyStaffPermission(db, actor, "people.write", { roles: ["people_operations_admin", "people_admin", "platform_admin"] });
    const body = profileSchema.parse(await request.json());
    const pack = STAFF_ROLE_PACKS[body.rolePackId];
    const ref = db.collection("staffProfiles").doc(body.userId);
    const current = await ref.get();
    const before = current.exists ? current.data() : {};
    const offboarding = body.status === "offboarding" || body.status === "former" ? {
      reason: compactText(body.offboardingReason, 1000),
      endDate: body.endDate || "",
      accessEndDate: body.accessEndDate || "",
      equipmentReturnDue: body.equipmentReturnDue || "",
      handoverOwnerId: body.handoverOwnerId || "",
      handoverOwnerName: compactText(body.handoverOwnerName, 160),
      startedAt: before?.offboarding?.startedAt || FieldValue.serverTimestamp(),
      startedBy: before?.offboarding?.startedBy || actor.uid,
      completedAt: body.status === "former" ? FieldValue.serverTimestamp() : null
    } : null;
    const profile = {
      userId: body.userId,
      displayName: compactText(body.displayName, 160),
      email: String(body.email || "").toLowerCase(),
      rolePackId: pack.id,
      roleTitle: pack.name,
      department: body.department || pack.department,
      employmentType: body.employmentType,
      status: body.status,
      startDate: body.startDate || "",
      probationEndDate: body.probationEndDate || "",
      employeeNumber: compactText(body.employeeNumber, 80),
      managerId: body.managerId || "",
      managerName: compactText(body.managerName, 160),
      permissions: pack.permissions,
      offboarding,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actor.uid
    };
    const batch = db.batch();
    batch.set(ref, profile, { merge: true });
    batch.set(db.collection("auditLogs").doc(), {
      action: "staff_profile.authority_updated",
      entityType: "staffProfile",
      entityId: body.userId,
      actorId: actor.uid,
      actorEmail: actor.email || "",
      metadata: {
        previousRolePackId: before?.rolePackId || null,
        rolePackId: pack.id,
        previousStatus: before?.status || null,
        status: body.status,
        managerId: body.managerId || null,
        department: profile.department
      },
      createdAt: FieldValue.serverTimestamp()
    });
    await batch.commit();
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { isPlatformAdmin, requirePlatformPermission } from "@/lib/access-control-server";

export const runtime = "nodejs";

const schema = z.object({
  userId: z.string().min(3).max(180),
  roles: z.array(z.string().min(1).max(100)).max(30),
  customPermissions: z.array(z.string().min(1).max(140)).max(100),
  status: z.enum(["active", "restricted", "suspended", "disabled"]),
  privateBeta: z.boolean()
});

export async function POST(request) {
  try {
    const actor = await authenticateRequest(request);
    requirePlatformPermission(actor, "admin.access");
    const body = schema.parse(await request.json());
    const { db } = getAdminServices();
    const targetRef = db.collection("users").doc(body.userId);

    await db.runTransaction(async (transaction) => {
      const targetSnapshot = await transaction.get(targetRef);
      if (!targetSnapshot.exists) throw Object.assign(new Error("The user account was not found."), { status: 404 });
      const target = targetSnapshot.data();
      const actorSuper = (actor.profile?.roles || []).includes("super_admin") || (actor.profile?.customPermissions || []).includes("*");
      const targetSuper = (target.roles || []).includes("super_admin") || (target.customPermissions || []).includes("*");
      const grantsSuper = body.roles.includes("super_admin") || body.customPermissions.includes("*");
      if ((targetSuper || grantsSuper) && !actorSuper) throw Object.assign(new Error("Only a super administrator can grant or modify super-admin access."), { status: 403 });
      if (body.userId === actor.uid && !actorSuper && (body.status !== "active" || !body.roles.some((role) => ["admin", "platform_admin"].includes(role)))) {
        throw Object.assign(new Error("Use another administrator to remove or restrict your own administrator access."), { status: 409 });
      }
      transaction.set(targetRef, {
        roles: body.roles,
        customPermissions: body.customPermissions,
        status: body.status,
        privateBeta: body.privateBeta,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actor.uid
      }, { merge: true });
      transaction.create(db.collection("auditLogs").doc(), {
        action: "user_access.updated",
        entityType: "user",
        entityId: body.userId,
        actorId: actor.uid,
        actorEmail: actor.email || "",
        metadata: { roles: body.roles, customPermissions: body.customPermissions, status: body.status, privateBeta: body.privateBeta },
        createdAt: FieldValue.serverTimestamp()
      });
    });
    return Response.json({ ok: true, userId: body.userId });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the account access settings.", details: error.flatten() }, { status: 400 });
    return apiError(error);
  }
}

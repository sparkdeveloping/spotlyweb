import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requirePlatformPermission } from "@/lib/access-control-server";
import { businessHref } from "@/lib/business-routing";
import { safeText } from "@/lib/server-helpers";

export const runtime = "nodejs";

const schema = z.object({
  businessId: z.string().min(3).max(200),
  action: z.enum(["suspend", "resume"]),
  reason: z.string().max(1200).optional().default("")
});

function previousLifecycleState(business = {}) {
  if (business.suspension?.previousStatus) {
    return {
      status: business.suspension.previousStatus,
      public: business.suspension.previousPublic === true,
      lifecycleStatus: business.suspension.previousLifecycleStatus || (business.suspension.previousStatus === "active" && business.suspension.previousPublic === true ? "live" : "preparing")
    };
  }
  return { status: "draft", public: false, lifecycleStatus: "preparing" };
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    requirePlatformPermission(user, "businesses.update", { roles: ["operations_manager", "regional_operations_manager", "business_success_manager"] });
    const body = schema.parse(await request.json());
    if (body.action === "suspend" && !body.reason.trim()) {
      throw Object.assign(new Error("Record why this business is being suspended."), { status: 422 });
    }

    const { db } = getAdminServices();
    const businessRef = db.collection("businesses").doc(body.businessId);
    let notificationTargets = [];
    let businessName = "Business";

    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(businessRef);
      if (!snapshot.exists) throw Object.assign(new Error("The business was not found."), { status: 404 });
      const business = { id: snapshot.id, ...snapshot.data() };
      businessName = business.brandName || business.name || "Business";
      notificationTargets = [...new Set([...(business.ownerIds || [])].filter(Boolean))];
      const nowIso = new Date().toISOString();

      if (body.action === "suspend") {
        if (String(business.status || "").toLowerCase() === "suspended" || String(business.lifecycleStatus || "").toLowerCase() === "suspended") {
          throw Object.assign(new Error("This business is already suspended."), { status: 409 });
        }
        transaction.set(businessRef, {
          status: "suspended",
          public: false,
          lifecycleStatus: "suspended",
          suspension: {
            status: "active",
            reason: safeText(body.reason, 1200),
            previousStatus: business.status || "draft",
            previousPublic: business.public === true,
            previousLifecycleStatus: business.lifecycleStatus || "preparing",
            suspendedBy: user.uid,
            suspendedAt: nowIso
          },
          lifecycleSummary: {
            ...(business.lifecycleSummary || {}),
            stage: business.lifecycleSummary?.stage || "live",
            suspended: true,
            updatedAt: nowIso
          },
          lifecycleHistory: FieldValue.arrayUnion({ type: "business_suspended", at: nowIso, reason: safeText(body.reason, 500) }),
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: user.uid
        }, { merge: true });
      } else {
        if (String(business.status || "").toLowerCase() !== "suspended" && String(business.lifecycleStatus || "").toLowerCase() !== "suspended") {
          throw Object.assign(new Error("This business is not suspended."), { status: 409 });
        }
        const restored = previousLifecycleState(business);
        transaction.set(businessRef, {
          ...restored,
          suspension: {
            ...(business.suspension || {}),
            status: "resolved",
            resolvedBy: user.uid,
            resolvedAt: nowIso
          },
          lifecycleSummary: {
            ...(business.lifecycleSummary || {}),
            stage: restored.lifecycleStatus === "live" || restored.lifecycleStatus === "paused" ? "live" : business.lifecycleSummary?.stage || "prepare",
            suspended: false,
            updatedAt: nowIso
          },
          lifecycleHistory: FieldValue.arrayUnion({ type: "business_suspension_cleared", at: nowIso }),
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: user.uid
        }, { merge: true });
      }

      transaction.create(db.collection("auditLogs").doc(), {
        action: body.action === "suspend" ? "business_suspended" : "business_suspension_cleared",
        entityType: "business",
        entityId: body.businessId,
        actorId: user.uid,
        actorEmail: user.email || "",
        metadata: { reason: safeText(body.reason, 1200) },
        createdAt: FieldValue.serverTimestamp()
      });
    });

    const notificationBody = body.action === "suspend"
      ? `${businessName} has been suspended by Spotly. ${safeText(body.reason, 300)}`.trim()
      : `${businessName} is no longer suspended.`;
    if (notificationTargets.length) {
      const batch = db.batch();
      notificationTargets.forEach((userId) => {
        batch.set(db.collection("notifications").doc(), {
          userId,
          title: body.action === "suspend" ? `${businessName} is suspended` : `${businessName} suspension cleared`,
          body: notificationBody,
          href: businessHref("/business/launch", { businessId: body.businessId }),
          category: "business_lifecycle",
          read: false,
          createdAt: FieldValue.serverTimestamp()
        });
      });
      await batch.commit();
    }

    return Response.json({ ok: true, businessId: body.businessId, action: body.action });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the business lifecycle action.", details: error.flatten() }, { status: 400 });
    return apiError(error);
  }
}

import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requirePlatformPermission } from "@/lib/access-control-server";
import { businessRoleTemplates } from "@/data/business-config";
import { safeText } from "@/lib/server-helpers";

export const runtime = "nodejs";

const schema = z.object({
  claimId: z.string().min(3).max(180),
  decision: z.enum(["approve", "request", "reject"]),
  reason: z.string().max(1000).optional().default("")
});

const template = (id) => businessRoleTemplates.find((item) => item.id === id);
const OWNER_PERMISSIONS = ["businesses.*", "branches.*", "catalog.*", "orders.*", "staff.*", "finance.*"];

function approvedGrant(claim) {
  if (claim.roleAtBusiness === "owner") {
    return claim.organizationId
      ? { role: "organization_owner", permissions: template("organization_owner")?.permissions || OWNER_PERMISSIONS }
      : { role: "business_owner", permissions: OWNER_PERMISSIONS };
  }
  if (claim.roleAtBusiness === "branch_manager") return { role: "branch_manager", permissions: template("branch_manager")?.permissions || [] };
  return { role: "business_manager", permissions: template("business_manager")?.permissions || [] };
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    requirePlatformPermission(user, "claims.review", { roles: ["verification_officer"] });
    const body = schema.parse(await request.json());
    const { db } = getAdminServices();
    const claimRef = db.collection("businessClaims").doc(body.claimId);

    await db.runTransaction(async (transaction) => {
      const claimSnapshot = await transaction.get(claimRef);
      if (!claimSnapshot.exists) throw Object.assign(new Error("The business claim was not found."), { status: 404 });
      const claim = claimSnapshot.data();
      if (!["submitted", "needs_information", "under_review"].includes(claim.status)) {
        throw Object.assign(new Error("This claim has already reached a terminal decision."), { status: 409 });
      }
      const businessRef = db.collection("businesses").doc(claim.businessId);
      const businessSnapshot = await transaction.get(businessRef);
      if (!businessSnapshot.exists) throw Object.assign(new Error("The linked business was not found."), { status: 404 });
      const business = businessSnapshot.data();
      const status = body.decision === "approve" ? "approved" : body.decision === "request" ? "needs_information" : "rejected";

      transaction.set(claimRef, {
        status,
        decisionReason: safeText(body.reason, 1000),
        reviewedBy: user.uid,
        reviewedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      if (body.decision === "approve") {
        const organizationId = claim.organizationId || business.organizationId;
        if (!organizationId) throw Object.assign(new Error("The approved claim must be linked to an organization."), { status: 409 });
        const memberRef = db.collection("memberships").doc(`${organizationId}_${claim.applicantId}`);
        const memberSnapshot = await transaction.get(memberRef);
        const existing = memberSnapshot.exists ? memberSnapshot.data() : {};
        const grant = approvedGrant(claim);
        const branchIds = [...new Set([...(existing.branchIds || []), ...(claim.branchIds || []), ...(claim.branchId ? [claim.branchId] : [])])];
        const businessIds = [...new Set([...(existing.businessIds || []), claim.businessId])];
        transaction.set(memberRef, {
          organizationId,
          businessId: existing.businessId || claim.businessId,
          businessIds,
          branchIds,
          userId: claim.applicantId,
          email: claim.applicantEmail || existing.email || "",
          displayName: claim.applicantName || existing.displayName || "",
          role: grant.role,
          permissions: grant.permissions,
          status: "active",
          grantedBy: user.uid,
          grantedFromClaimId: body.claimId,
          ...(memberSnapshot.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
        transaction.set(businessRef, {
          claimStatus: "claimed",
          verificationStatus: "approved",
          ownerIds: grant.role.includes("owner") ? FieldValue.arrayUnion(claim.applicantId) : business.ownerIds || [],
          status: claim.claimType === "new_business" ? "draft" : (business.status || "active"),
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
      } else {
        transaction.set(businessRef, {
          claimStatus: body.decision === "request" ? "claim_needs_information" : "unclaimed",
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
      }

      transaction.create(db.collection("auditLogs").doc(), {
        action: `business_claim.${status}`,
        entityType: "businessClaim",
        entityId: body.claimId,
        actorId: user.uid,
        actorEmail: user.email || "",
        metadata: { businessId: claim.businessId, reason: safeText(body.reason, 1000) },
        createdAt: FieldValue.serverTimestamp()
      });
    });

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the claim decision.", details: error.flatten() }, { status: 400 });
    return apiError(error);
  }
}

import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { safeText } from "@/lib/server-helpers";
import { notifyRoleAudience, notifyUser } from "@/lib/notification-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const evidenceSchema = z.object({
  name: z.string().min(1).max(180),
  type: z.string().max(120).default(""),
  url: z.string().url(),
  size: z.number().int().min(0).max(20 * 1024 * 1024)
});

const provisionalSchema = z.object({
  id: z.string().min(1).max(180),
  name: z.string().min(2).max(180),
  brandName: z.string().max(180).optional(),
  category: z.string().max(100).optional(),
  businessType: z.enum([
    "grocery_retail",
    "restaurant_food",
    "ticketing_events",
    "appointments_services",
    "accommodation_activities",
    "directory_profile"
  ]).optional(),
  capabilities: z.array(z.string().max(80)).max(30).optional(),
  operatingModel: z.string().max(80).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(8).optional(),
  website: z.string().max(500).optional(),
  description: z.string().max(1000).optional(),
  organizationName: z.string().max(180).optional(),
  legalName: z.string().max(180).optional(),
  branchName: z.string().max(180).optional(),
  address: z.string().max(500).optional(),
  phone: z.string().max(40).optional(),
  email: z.string().email().or(z.literal("")).optional(),
  instagram: z.string().max(180).optional(),
  source: z.record(z.string(), z.any()).optional()
});

const schema = z.object({
  businessId: z.string().min(1).max(180),
  organizationId: z.string().max(180).nullable().optional(),
  branchIds: z.array(z.string().min(1).max(180)).max(100).default([]),
  applicantName: z.string().min(2).max(160),
  phone: z.string().max(40).optional(),
  email: z.string().email().optional(),
  roleAtBusiness: z.enum([
    "owner",
    "authorized_manager",
    "branch_manager",
    "authorized_staff",
    "marketing",
    "franchisee",
    "other"
  ]),
  notes: z.string().max(2000).optional(),
  evidence: z.array(evidenceSchema).max(20).default([]),
  provisionalBusiness: provisionalSchema.nullable().optional()
});

function searchTerms(...values) {
  const words = values
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const result = new Set();
  words.forEach((word) => {
    result.add(word);
    for (let index = 2; index <= Math.min(word.length, 18); index += 1) result.add(word.slice(0, index));
  });
  return [...result].slice(0, 120);
}

function roleForClaim(role, organizationId) {
  if (role === "owner") return organizationId ? "organization_owner" : "business_owner";
  if (role === "franchisee" || role === "authorized_manager") return "business_manager";
  if (role === "branch_manager") return "branch_manager";
  if (role === "marketing") return "marketing_manager";
  return "business_staff";
}

function permissionsForClaim(role) {
  if (role === "owner") {
    return ["organization.*", "businesses.*", "branches.*", "catalog.*", "orders.*", "staff.*", "finance.read", "finance.configure", "support.*", "settings.*"];
  }
  if (role === "franchisee" || role === "authorized_manager") {
    return ["businesses.read", "businesses.update", "branches.read", "branches.update", "catalog.*", "orders.*", "staff.read", "finance.read", "support.*"];
  }
  if (role === "branch_manager") {
    return ["businesses.read", "branches.read", "branches.update", "catalog.read", "catalog.update", "orders.*", "staff.read", "support.*"];
  }
  if (role === "marketing") return ["businesses.read", "businesses.update", "catalog.read", "promotions.*", "insights.read", "support.*"];
  return ["businesses.read", "branches.read", "catalog.read", "orders.read", "support.*"];
}

function defaultFulfilment(capabilities = []) {
  if (capabilities.includes("pickup_orders")) return ["pickup"];
  if (capabilities.includes("appointments")) return ["appointment"];
  if (capabilities.includes("tickets")) return ["ticketing"];
  if (capabilities.includes("reservations")) return ["reservation"];
  return ["profile"];
}

export async function POST(request) {
  try {
    const actor = await authenticateRequest(request);
    if (!actor.email) throw Object.assign(new Error("A primary email-and-password account is required."), { status: 409 });

    const input = schema.parse(await request.json());
    const { auth, db, messaging } = getAdminServices();
    const authUser = await auth.getUser(actor.uid);
    if (!authUser.providerData.some((provider) => provider.providerId === "password")) {
      throw Object.assign(new Error("Create or link an email-and-password credential before claiming a business."), { status: 409 });
    }

    const settingsSnapshot = await db.collection("platformSettings").doc("global").get();
    const platformSettings = settingsSnapshot.exists ? settingsSnapshot.data() : {};
    if (platformSettings.launch?.businessClaimsEnabled === false) {
      throw Object.assign(new Error("Business claiming is temporarily unavailable."), { status: 503 });
    }

    const selectedBranchIds = [...new Set(input.branchIds)];
    const selectedBranchSnapshots = selectedBranchIds.length
      ? await Promise.all(selectedBranchIds.map((branchId) => db.collection("branches").doc(branchId).get()))
      : [];
    if (selectedBranchSnapshots.some((snapshot) => !snapshot.exists || snapshot.data()?.businessId !== input.businessId)) {
      throw Object.assign(new Error("One or more selected locations no longer belong to this business. Search and choose the locations again."), { status: 409 });
    }

    const verificationPolicy = platformSettings.verification || {};
    const riskScore = input.provisionalBusiness?.source?.type === "owner_created" ? 20 : 10;
    const autoApprovalEnabled = Boolean(verificationPolicy.lowRiskAutoApproval) && verificationPolicy.manualReviewRequired === false;
    const autoApprovalThreshold = Number(verificationPolicy.autoApprovalThreshold || 15);
    const claimId = `${input.businessId}_${actor.uid}`;
    const claimRef = db.collection("businessClaims").doc(claimId);
    const businessRef = db.collection("businesses").doc(input.businessId);

    let resolvedOrganizationId = input.organizationId || null;
    let resolvedBranchIds = selectedBranchIds;
    let autoApproved = false;

    await db.runTransaction(async (transaction) => {
      const [businessSnapshot, existingClaim] = await Promise.all([
        transaction.get(businessRef),
        transaction.get(claimRef)
      ]);

      if (existingClaim.exists && ["submitted", "needs_information", "approved"].includes(existingClaim.data().status)) {
        throw Object.assign(new Error("You already have an active claim for this business."), { status: 409 });
      }

      const existingBusiness = businessSnapshot.exists ? businessSnapshot.data() : {};
      const existingOwners = existingBusiness.ownerIds || [];
      if (businessSnapshot.exists && (existingBusiness.claimStatus === "claimed" || existingOwners.length > 0) && !existingOwners.includes(actor.uid)) {
        throw Object.assign(new Error("This business already has an owner. Open a support conversation if the ownership is incorrect."), { status: 409 });
      }

      if (!businessSnapshot.exists) {
        const provisional = input.provisionalBusiness;
        if (!provisional || provisional.id !== input.businessId) {
          throw Object.assign(new Error("The selected business is not available. Search again or add it as a new business."), { status: 404 });
        }

        const ownerCreated = provisional.source?.type === "owner_created";
        if (!ownerCreated) {
          throw Object.assign(new Error("This provisional listing has not been added to the Spotly directory yet."), { status: 409 });
        }

        resolvedOrganizationId = input.organizationId || `org_${input.businessId}`;
        const resolvedBranchId = `branch_${input.businessId}_main`;
        resolvedBranchIds = [resolvedBranchId];
        const organizationRef = db.collection("organizations").doc(resolvedOrganizationId);
        const branchRef = db.collection("branches").doc(resolvedBranchId);
        const membershipRef = db.collection("memberships").doc(`${resolvedOrganizationId}_${actor.uid}`);
        const businessType = provisional.businessType || "directory_profile";
        const capabilities = provisional.capabilities || [];
        const branchName = safeText(provisional.branchName || "Main location", 180);

        transaction.create(organizationRef, {
          name: safeText(provisional.organizationName || provisional.brandName || provisional.name, 180),
          legalName: safeText(provisional.legalName || "", 180),
          ownerIds: [actor.uid],
          businessIds: [input.businessId],
          branchIds: [resolvedBranchId],
          status: "pending_verification",
          country: provisional.country || "ZW",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
        transaction.create(branchRef, {
          organizationId: resolvedOrganizationId,
          businessId: input.businessId,
          name: branchName,
          branchName,
          displayName: `${safeText(provisional.brandName || provisional.name, 180)} — ${branchName}`,
          city: safeText(provisional.city || "Harare", 100),
          address: safeText(provisional.address || "", 500),
          phone: safeText(provisional.phone || "", 40),
          email: safeText(provisional.email || "", 254),
          status: "draft",
          public: false,
          requestedPublic: true,
          reviewStatus: "pending_launch_review",
          fulfilment: defaultFulfilment(capabilities),
          paymentMethods: ["cash", "paynow", "ecocash", "onemoney", "card", "bank_transfer"],
          acceptedCurrencies: ["USD", "ZWG"],
          searchTerms: searchTerms(provisional.name, branchName, provisional.city, provisional.address),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
        transaction.create(membershipRef, {
          organizationId: resolvedOrganizationId,
          businessId: input.businessId,
          businessIds: [input.businessId],
          branchIds: [resolvedBranchId],
          userId: actor.uid,
          email: actor.email,
          displayName: safeText(input.applicantName || actor.name || actor.email, 160),
          role: "organization_owner",
          permissions: permissionsForClaim("owner"),
          status: "active",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });

        transaction.create(businessRef, {
          organizationId: resolvedOrganizationId,
          name: safeText(provisional.brandName || provisional.name, 180),
          brandName: safeText(provisional.brandName || provisional.name, 180),
          legalName: safeText(provisional.legalName || "", 180),
          category: safeText(provisional.category || "Other", 100),
          categories: [safeText(provisional.category || "Other", 100)],
          businessType,
          capabilities,
          operatingModel: provisional.operatingModel || "single_location",
          city: safeText(provisional.city || "Zimbabwe", 100),
          country: provisional.country || "ZW",
          phone: safeText(provisional.phone || "", 40),
          email: safeText(provisional.email || "", 254),
          website: safeText(provisional.website || "", 500),
          instagram: safeText(provisional.instagram || "", 180),
          description: safeText(provisional.description || "", 1000),
          public: false,
          status: "draft",
          claimStatus: "claimed_pending_verification",
          verificationStatus: "pending",
          onboardingStatus: "not_started",
          ownerIds: [actor.uid],
          branchIds: [resolvedBranchId],
          branchCount: 1,
          searchTerms: searchTerms(provisional.name, provisional.brandName, provisional.category, provisional.city),
          source: provisional.source || { type: "owner_created", imported: false },
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
      } else {
        resolvedOrganizationId = input.organizationId || existingBusiness.organizationId || null;
        const availableBranchIds = existingBusiness.branchIds || [];
        resolvedBranchIds = selectedBranchIds.length ? selectedBranchIds : availableBranchIds.slice(0, 1);
        if (!resolvedBranchIds.length) {
          throw Object.assign(new Error("This business has no selectable location yet. Ask Spotly Support to repair the listing."), { status: 409 });
        }

        autoApproved = autoApprovalEnabled
          && riskScore <= autoApprovalThreshold
          && input.evidence.length > 0
          && ["owner", "franchisee"].includes(input.roleAtBusiness)
          && existingOwners.length === 0
          && existingBusiness.claimStatus !== "claimed";

        if (autoApproved) {
          transaction.set(businessRef, {
            claimStatus: "claimed",
            verificationStatus: "approved",
            ownerIds: input.roleAtBusiness === "owner" ? [...new Set([...existingOwners, actor.uid])] : existingOwners,
            status: existingBusiness.status === "provisional" ? "active" : existingBusiness.status || "active",
            public: true,
            verifiedAt: FieldValue.serverTimestamp(),
            verifiedBy: "low_risk_policy",
            updatedAt: FieldValue.serverTimestamp()
          }, { merge: true });

          const membershipId = `${resolvedOrganizationId || input.businessId}_${actor.uid}`;
          transaction.set(db.collection("memberships").doc(membershipId), {
            organizationId: resolvedOrganizationId,
            businessId: input.businessId,
            businessIds: FieldValue.arrayUnion(input.businessId),
            branchIds: FieldValue.arrayUnion(...resolvedBranchIds),
            userId: actor.uid,
            email: actor.email,
            displayName: safeText(input.applicantName || actor.name || actor.email, 160),
            role: roleForClaim(input.roleAtBusiness, resolvedOrganizationId),
            permissions: FieldValue.arrayUnion(...permissionsForClaim(input.roleAtBusiness)),
            status: "active",
            updatedAt: FieldValue.serverTimestamp()
          }, { merge: true });
        } else {
          transaction.set(businessRef, { claimStatus: "claim_pending", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        }
      }

      transaction.set(claimRef, {
        businessId: input.businessId,
        organizationId: resolvedOrganizationId,
        branchId: resolvedBranchIds[0] || null,
        branchIds: resolvedBranchIds,
        applicantId: actor.uid,
        applicantEmail: actor.email,
        applicantName: safeText(input.applicantName || actor.name || "", 160),
        phone: safeText(input.phone || actor.phone_number || "", 40),
        roleAtBusiness: input.roleAtBusiness,
        evidence: input.evidence,
        notes: safeText(input.notes || "", 2000),
        claimType: input.provisionalBusiness?.source?.type === "owner_created" ? "new_business" : "existing_listing",
        riskScore,
        status: autoApproved ? "approved" : "submitted",
        autoApproved,
        reviewedBy: autoApproved ? "low_risk_policy" : null,
        reviewedAt: autoApproved ? FieldValue.serverTimestamp() : null,
        verificationChecklist: autoApproved ? { ownershipEvidence: true, accountCredential: true, duplicateCheck: true, locationScope: true } : {},
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      transaction.create(db.collection("auditLogs").doc(), {
        action: autoApproved ? "business_claim.auto_approved" : "business_claim.submitted",
        entityType: "businessClaim",
        entityId: claimId,
        actorId: actor.uid,
        actorEmail: actor.email,
        metadata: {
          businessId: input.businessId,
          organizationId: resolvedOrganizationId,
          branchIds: resolvedBranchIds,
          evidenceCount: input.evidence.length,
          riskScore,
          autoApproved
        },
        createdAt: FieldValue.serverTimestamp()
      });
    });

    await Promise.allSettled([
      notifyUser({
        db, messaging, auth, userId: actor.uid,
        title: autoApproved ? "Business access approved" : "Business claim sent to Spotly",
        body: autoApproved
          ? "Your business access was approved. Open Spotly Business to continue setup and operations."
          : "Your claim is saved and waiting for Spotly review. We will notify you here and by email when the review changes.",
        href: "/", category: "business_claim_review", workspace: "business", module: "reviews",
        eventType: autoApproved ? "business_claim.approved" : "business_claim.submitted", importance: "high",
        businessId: input.businessId, entityType: "businessClaim", entityId: claimId, email: true, forceOperationalEmail: true
      }),
      ...(!autoApproved ? [notifyRoleAudience({
        db, messaging, auth, title: `Business claim ready · ${input.provisionalBusiness?.name || input.businessId}`,
        body: `${safeText(input.applicantName || actor.name || actor.email, 160)} submitted a business claim that needs review.`,
        href: "/queues/business-claims?status=open", category: "admin_review", workspace: "admin", module: "reviews",
        eventType: "business_claim.submitted", importance: "high", businessId: input.businessId, entityType: "businessClaim", entityId: claimId, email: true, forceOperationalEmail: true
      }, ["super_admin", "verification_officer", "operations_manager"])] : [])
    ]);

    return Response.json({
      ok: true,
      claimId,
      businessId: input.businessId,
      organizationId: resolvedOrganizationId,
      branchId: resolvedBranchIds[0] || null,
      branchIds: resolvedBranchIds,
      autoApproved
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ ok: false, error: "Review the claim details and evidence.", details: error.flatten() }, { status: 400 });
    }
    return apiError(error);
  }
}

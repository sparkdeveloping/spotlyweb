import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { safeText } from "@/lib/server-helpers";

export const runtime = "nodejs";

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
  applicantName: z.string().min(2).max(160),
  phone: z.string().max(40).optional(),
  email: z.string().email().optional(),
  roleAtBusiness: z.enum(["owner", "authorized_manager", "marketing", "franchisee", "other"]),
  notes: z.string().max(2000).optional(),
  evidence: z.array(evidenceSchema).max(20).default([]),
  provisionalBusiness: provisionalSchema.nullable().optional()
});

function searchTerms(...values) {
  const words = values.filter(Boolean).join(" ").toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter(Boolean);
  const result = new Set();
  words.forEach((word) => {
    result.add(word);
    for (let index = 2; index <= Math.min(word.length, 18); index += 1) result.add(word.slice(0, index));
  });
  return [...result].slice(0, 120);
}

export async function POST(request) {
  try {
    const actor = await authenticateRequest(request);
    if (!actor.email) throw Object.assign(new Error("A primary email-and-password account is required."), { status: 409 });
    const input = schema.parse(await request.json());
    const { auth, db } = getAdminServices();
    const authUser = await auth.getUser(actor.uid);
    if (!authUser.providerData.some((provider) => provider.providerId === "password")) {
      throw Object.assign(new Error("Create or link an email-and-password credential before claiming a business."), { status: 409 });
    }
    const settingsSnapshot = await db.collection("platformSettings").doc("global").get();
    if (settingsSnapshot.exists && settingsSnapshot.data().launch?.businessClaimsEnabled === false) {
      throw Object.assign(new Error("Business claiming is temporarily unavailable."), { status: 503 });
    }
    const claimId = `${input.businessId}_${actor.uid}`;
    const claimRef = db.collection("businessClaims").doc(claimId);
    const businessRef = db.collection("businesses").doc(input.businessId);

    let resolvedOrganizationId = input.organizationId || null;
    let resolvedBranchId = null;

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
        if (ownerCreated) {
          resolvedOrganizationId = input.organizationId || `org_${input.businessId}`;
          resolvedBranchId = `branch_${input.businessId}_main`;
          const organizationRef = db.collection("organizations").doc(resolvedOrganizationId);
          const branchRef = db.collection("branches").doc(resolvedBranchId);
          const membershipRef = db.collection("memberships").doc(`${resolvedOrganizationId}_${actor.uid}`);

          transaction.create(organizationRef, {
            name: safeText(provisional.organizationName || provisional.brandName || provisional.name, 180),
            legalName: safeText(provisional.legalName || "", 180),
            ownerIds: [actor.uid],
            businessIds: [input.businessId],
            status: "pending_verification",
            country: provisional.country || "ZW",
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          });
          transaction.create(branchRef, {
            organizationId: resolvedOrganizationId,
            businessId: input.businessId,
            name: safeText(provisional.branchName || `${provisional.name} — ${provisional.city || "Main branch"}`, 180),
            city: safeText(provisional.city || "Harare", 100),
            address: safeText(provisional.address || "", 500),
            phone: safeText(provisional.phone || "", 40),
            email: safeText(provisional.email || "", 254),
            status: "draft",
            public: false,
            fulfilment: ["pickup"],
            paymentMethods: ["cash", "paynow", "ecocash", "onemoney", "card", "bank_transfer"],
            acceptedCurrencies: ["USD", "ZWG"],
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          });
          transaction.create(membershipRef, {
            organizationId: resolvedOrganizationId,
            businessId: input.businessId,
            businessIds: [input.businessId],
            branchIds: [resolvedBranchId],
            userId: actor.uid,
            role: "organization_owner",
            permissions: ["organization.*", "businesses.*", "branches.*", "catalog.*", "orders.*", "staff.*", "finance.read", "finance.configure"],
            status: "active",
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          });
        }

        transaction.create(businessRef, {
          organizationId: ownerCreated ? resolvedOrganizationId : null,
          name: safeText(provisional.name, 180),
          brandName: safeText(provisional.brandName || provisional.name, 180),
          legalName: safeText(provisional.legalName || "", 180),
          category: safeText(provisional.category || "Other", 100),
          categories: [safeText(provisional.category || "Other", 100)],
          city: safeText(provisional.city || "Zimbabwe", 100),
          country: provisional.country || "ZW",
          phone: safeText(provisional.phone || "", 40),
          email: safeText(provisional.email || "", 254),
          website: safeText(provisional.website || "", 500),
          instagram: safeText(provisional.instagram || "", 180),
          description: safeText(provisional.description || "", 1000),
          public: !ownerCreated,
          status: ownerCreated ? "draft" : "provisional",
          claimStatus: "claim_pending",
          verificationStatus: ownerCreated ? "pending" : "unverified",
          ownerIds: ownerCreated ? [actor.uid] : [],
          branchIds: resolvedBranchId ? [resolvedBranchId] : [],
          searchTerms: searchTerms(provisional.name, provisional.brandName, provisional.category, provisional.city),
          source: provisional.source || { type: "provisional_import", imported: true, rightsReviewRequired: true },
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
      } else {
        resolvedOrganizationId = input.organizationId || existingBusiness.organizationId || null;
        transaction.set(businessRef, { claimStatus: "claim_pending", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      }

      transaction.set(claimRef, {
        businessId: input.businessId,
        organizationId: resolvedOrganizationId,
        branchId: resolvedBranchId,
        applicantId: actor.uid,
        applicantEmail: actor.email,
        applicantName: safeText(input.applicantName || actor.name || "", 160),
        phone: safeText(input.phone || actor.phone_number || "", 40),
        roleAtBusiness: input.roleAtBusiness,
        evidence: input.evidence,
        notes: safeText(input.notes || "", 2000),
        claimType: input.provisionalBusiness?.source?.type === "owner_created" ? "new_business" : "existing_listing",
        riskScore: input.provisionalBusiness?.source?.type === "owner_created" ? 20 : 10,
        status: "submitted",
        verificationChecklist: {},
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      transaction.create(db.collection("auditLogs").doc(), {
        action: "business_claim.submitted",
        entityType: "businessClaim",
        entityId: claimId,
        actorId: actor.uid,
        actorEmail: actor.email,
        metadata: { businessId: input.businessId, organizationId: resolvedOrganizationId, branchId: resolvedBranchId, evidenceCount: input.evidence.length },
        createdAt: FieldValue.serverTimestamp()
      });
    });

    return Response.json({ ok: true, claimId, businessId: input.businessId, organizationId: resolvedOrganizationId, branchId: resolvedBranchId });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the claim details and evidence.", details: error.flatten() }, { status: 400 });
    return apiError(error);
  }
}

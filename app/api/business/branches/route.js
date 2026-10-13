import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requireBusinessPermission } from "@/lib/access-control-server";
import { defaultBranch } from "@/data/business-config";
import { loadCanonicalBusinessBranches } from "@/lib/business-branches-server";
import { notifyRoleAudience, notifyUser } from "@/lib/notification-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const hoursSchema = z.record(z.string(), z.object({
  open: z.string().max(10).optional().default(""),
  close: z.string().max(10).optional().default(""),
  closed: z.boolean().optional().default(false)
}).passthrough()).optional();

const branchSchema = z.object({
  id: z.string().min(1).max(220).optional(),
  branchName: z.string().max(180).optional(),
  name: z.string().max(180).optional(),
  city: z.string().max(120).optional(),
  address: z.string().max(500).optional(),
  phone: z.string().max(80).optional(),
  email: z.union([z.string().email().max(254), z.literal("")]).optional(),
  location: z.object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    accuracy: z.coerce.number().min(0).max(100000).optional()
  }).nullable().optional(),
  public: z.boolean().optional(),
  status: z.enum(["draft", "provisional", "active", "paused", "closed"]).optional(),
  fulfilment: z.array(z.string().max(80)).max(20).optional(),
  openingHours: hoursSchema,
  pickup: z.object({
    enabled: z.boolean().optional(),
    slotMinutes: z.coerce.number().int().min(5).max(240).optional(),
    slotCapacity: z.coerce.number().int().min(1).max(10000).optional(),
    preparationMinutes: z.coerce.number().int().min(0).max(1440).optional()
  }).passthrough().optional(),
  paymentMethods: z.array(z.string().max(80)).max(30).optional(),
  acceptedCurrencies: z.array(z.string().max(12)).max(20).optional(),
  instructions: z.string().max(2000).optional()
});

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("upsert"), businessId: z.string().min(3).max(200), branch: branchSchema, makePrimary: z.boolean().optional().default(false) }),
  z.object({ action: z.literal("delete"), businessId: z.string().min(3).max(200), branchId: z.string().min(1).max(220) })
]);


function branchLabel(branch = {}) {
  return String(branch.branchName || branch.name || branch.displayName || "").trim();
}

function sortBranches(records = []) {
  return [...records].sort((a, b) => branchLabel(a).localeCompare(branchLabel(b), "en", { sensitivity: "base" }));
}

function plain(value) {
  if (value == null) return value;
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plain(item)]));
  return value;
}

function normalizeSearchTerms(...values) {
  const combined = values.filter(Boolean).join(" ").toLowerCase().replace(/[^a-z0-9\s-]/g, " ");
  const words = combined.split(/\s+/).filter(Boolean);
  const prefixes = new Set();
  words.forEach((word) => {
    for (let index = 2; index <= Math.min(word.length, 18); index += 1) prefixes.add(word.slice(0, index));
    prefixes.add(word);
  });
  return [...prefixes].slice(0, 120);
}

function writeAudit(transaction, db, user, action, branchId, businessId) {
  transaction.create(db.collection("auditLogs").doc(), {
    action,
    entityType: "branch",
    entityId: branchId,
    actorId: user.uid,
    actorEmail: user.email || "",
    metadata: { businessId },
    createdAt: FieldValue.serverTimestamp()
  });
}

function requireBusinessWide(context) {
  if (!context.platformAdmin && !context.businessWide) {
    throw Object.assign(new Error("Only a business-wide owner or manager can add or remove locations."), { status: 403 });
  }
}


export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    const { searchParams } = new URL(request.url);
    const businessId = String(searchParams.get("businessId") || "").trim();
    if (!businessId) return Response.json({ ok: false, error: "A business is required." }, { status: 400 });

    const { db } = getAdminServices();
    const context = await requireBusinessPermission(db, user, businessId, "branches.read", {
      allowRoles: ["organization_owner", "business_owner", "business_manager", "branch_manager", "catalog_manager", "order_staff", "picker", "finance_manager", "finance_viewer"]
    });

    // Resolve both sides of the Business ↔ location relationship. This repairs historical
    // one-sided links that otherwise let Admin see a submitted location while Business sees
    // an empty Locations screen. No composite index is required.
    const resolved = await loadCanonicalBusinessBranches(db, businessId, { repair: context.businessWide || context.platformAdmin });
    let branches = resolved.branches.map((branch) => plain(branch));
    if (!context.businessWide && !context.platformAdmin) {
      const allowed = new Set(context.membership?.branchIds || []);
      branches = branches.filter((branch) => allowed.has(branch.id));
    }
    branches = sortBranches(branches);
    return Response.json({ ok: true, branches, integrity: resolved.diagnostics }, { headers: { "Cache-Control": "private, no-store, max-age=0, must-revalidate" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const body = schema.parse(await request.json());
    const { db, messaging, auth } = getAdminServices();

    if (body.action === "upsert") {
      const existingId = body.branch.id || null;
      const context = await requireBusinessPermission(db, user, body.businessId, existingId ? "branches.update" : "branches.manage", {
        branchId: existingId,
        allowRoles: existingId ? ["organization_owner", "business_owner", "business_manager", "branch_manager"] : ["organization_owner", "business_owner", "business_manager"]
      });
      if (!existingId) requireBusinessWide(context);

      const businessRef = db.collection("businesses").doc(body.businessId);
      const branchRef = existingId ? db.collection("branches").doc(existingId) : db.collection("branches").doc();
      const business = context.business;
      let existingBranch = null;
      if (existingId) {
        const snapshot = await branchRef.get();
        if (!snapshot.exists || snapshot.data().businessId !== body.businessId) {
          throw Object.assign(new Error("The location was not found for this business."), { status: 404 });
        }
        existingBranch = snapshot.data();
      }

      const submitted = body.branch;
      const branchName = String(submitted.branchName || submitted.name || existingBranch?.branchName || existingBranch?.name || "Main location").trim();
      if (!branchName) throw Object.assign(new Error("Enter a location name."), { status: 422 });
      const businessName = business.brandName || business.name || "Business";
      const fulfilment = submitted.fulfilment?.length ? submitted.fulfilment : (existingBranch?.fulfilment?.length ? existingBranch.fulfilment : ["profile"]);
      const city = submitted.city ?? existingBranch?.city ?? "Harare";
      const address = submitted.address ?? existingBranch?.address ?? "";
      const businessIsLive = ["live", "paused"].includes(String(business.lifecycleStatus || "")) || (business.status === "active" && business.public !== false);
      const requestedPublic = submitted.public ?? existingBranch?.requestedPublic ?? existingBranch?.public ?? true;
      const requiresIndependentReview = !existingId && businessIsLive;
      const prelaunchLocation = !existingId && !businessIsLive;
      const locationReviewRef = requiresIndependentReview ? db.collection("businessLocationReviews").doc() : null;
      const payload = {
        businessId: body.businessId,
        organizationId: business.organizationId || null,
        name: branchName,
        branchName,
        displayName: `${businessName} — ${branchName}`,
        city,
        address,
        phone: submitted.phone ?? existingBranch?.phone ?? "",
        email: submitted.email ?? existingBranch?.email ?? "",
        location: submitted.location === null ? null : (submitted.location || existingBranch?.location || null),
        requestedPublic: requestedPublic !== false,
        public: requiresIndependentReview || prelaunchLocation ? false : (submitted.public ?? existingBranch?.public ?? true),
        status: requiresIndependentReview || prelaunchLocation ? "draft" : (submitted.status === "provisional" ? "draft" : (submitted.status || existingBranch?.status || "active")),
        reviewStatus: requiresIndependentReview ? "pending" : prelaunchLocation ? "pending_launch_review" : (existingBranch?.reviewStatus || "approved"),
        ...(locationReviewRef ? { reviewId: locationReviewRef.id, reviewRequestedAt: FieldValue.serverTimestamp(), reviewRequestedBy: user.uid } : {}),
        fulfilment,
        openingHours: submitted.openingHours || existingBranch?.openingHours || defaultBranch.openingHours,
        pickup: submitted.pickup || existingBranch?.pickup || { ...defaultBranch.pickup, enabled: fulfilment.includes("pickup") },
        paymentMethods: submitted.paymentMethods || existingBranch?.paymentMethods || defaultBranch.paymentMethods,
        acceptedCurrencies: submitted.acceptedCurrencies || existingBranch?.acceptedCurrencies || defaultBranch.acceptedCurrencies,
        instructions: submitted.instructions ?? existingBranch?.instructions ?? "",
        searchTerms: normalizeSearchTerms(businessName, branchName, city, address),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: user.uid
      };
      if (!existingId) payload.createdAt = FieldValue.serverTimestamp();

      await db.runTransaction(async (transaction) => {
        // Every transaction read happens before its first write.
        const [currentBusiness, currentBranch] = await Promise.all([
          transaction.get(businessRef),
          existingId ? transaction.get(branchRef) : Promise.resolve(null)
        ]);
        if (!currentBusiness.exists) throw Object.assign(new Error("The business was not found."), { status: 404 });
        if (existingId && (!currentBranch?.exists || currentBranch.data().businessId !== body.businessId)) {
          throw Object.assign(new Error("The location was not found for this business."), { status: 404 });
        }

        transaction.set(branchRef, payload, { merge: true });
        const currentBusinessData = currentBusiness.data();
        const linkedBranchIds = Array.isArray(currentBusinessData.branchIds) ? currentBusinessData.branchIds : [];
        const wasLinked = linkedBranchIds.includes(branchRef.id);
        const currentPrimary = currentBusinessData.primaryBranchId || currentBusinessData.primaryLocationId || currentBusinessData.defaultBranchId || "";
        transaction.set(businessRef, {
          ...(!wasLinked ? { branchIds: FieldValue.arrayUnion(branchRef.id), branchCount: FieldValue.increment(1) } : {}),
          ...((body.makePrimary || !currentPrimary) ? { primaryBranchId: branchRef.id, primaryLocationId: branchRef.id } : {}),
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: user.uid
        }, { merge: true });
        if (locationReviewRef) {
          transaction.create(locationReviewRef, {
            businessId: body.businessId, organizationId: business.organizationId || null, branchId: branchRef.id, branchName, businessName,
            status: "submitted", requestedBy: user.uid, requestedByEmail: user.email || "", requestedPublic: requestedPublic !== false,
            createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
          });
          transaction.create(db.collection("adminTasks").doc(locationReviewRef.id), {
            type: "business_location_review", reviewId: locationReviewRef.id, businessId: body.businessId, branchId: branchRef.id, businessName,
            title: `Location review · ${businessName} · ${branchName}`, description: "A live business added a new location. Review its customer-facing location details before publication.",
            status: "open", priority: "normal", requestedBy: user.uid, requestedByEmail: user.email || "",
            createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
          });
        }
        writeAudit(transaction, db, user, existingId ? "branch.updated" : "branch.created", branchRef.id, body.businessId);
      });

      if (locationReviewRef) {
        await Promise.allSettled([
          notifyUser({ db, messaging, auth, userId: user.uid, title: "Location sent to Spotly", body: `${branchName} is saved and visible in Business while Spotly reviews it for customer publication.`, href: `/business/branches?business=${encodeURIComponent(body.businessId)}`, category: "business_location_review", workspace: "business", module: "locations", eventType: "location_review.submitted", importance: "high", businessId: body.businessId, entityType: "branch", entityId: branchRef.id, email: true, forceOperationalEmail: true }),
          notifyRoleAudience({ db, messaging, auth, title: `Location review ready · ${businessName}`, body: `${branchName} was added to a live business and needs publication review.`, href: "/queues/publication-review?status=open", category: "admin_review", workspace: "admin", module: "reviews", eventType: "location_review.submitted", importance: "high", businessId: body.businessId, entityType: "businessLocationReview", entityId: locationReviewRef.id, email: true, forceOperationalEmail: true }, ["super_admin", "business_success_manager", "operations_manager", "regional_operations_manager"])
        ]);
      }
      return Response.json({ ok: true, branchId: branchRef.id, reviewId: locationReviewRef?.id || null, reviewStatus: payload.reviewStatus });
    }

    const context = await requireBusinessPermission(db, user, body.businessId, "branches.manage", {
      branchId: body.branchId,
      allowRoles: ["organization_owner", "business_owner", "business_manager"]
    });
    requireBusinessWide(context);
    const businessRef = db.collection("businesses").doc(body.businessId);
    const branchRef = db.collection("branches").doc(body.branchId);
    // Keep this query single-field so no composite Firestore index is required.
    const branchList = await db.collection("branches").where("businessId", "==", body.businessId).limit(100).get();
    if (branchList.size <= 1) throw Object.assign(new Error("A business must keep at least one location. Edit this location instead."), { status: 409 });
    const replacementPrimaryId = branchList.docs.find((doc) => doc.id !== body.branchId)?.id || "";

    await db.runTransaction(async (transaction) => {
      const [businessSnapshot, branchSnapshot] = await Promise.all([
        transaction.get(businessRef),
        transaction.get(branchRef)
      ]);
      if (!businessSnapshot.exists) throw Object.assign(new Error("The business was not found."), { status: 404 });
      if (!branchSnapshot.exists || branchSnapshot.data().businessId !== body.businessId) {
        throw Object.assign(new Error("The location was not found for this business."), { status: 404 });
      }

      transaction.delete(branchRef);
      const currentBusinessData = businessSnapshot.data();
      const deletingPrimary = [currentBusinessData.primaryBranchId, currentBusinessData.primaryLocationId, currentBusinessData.defaultBranchId].filter(Boolean).includes(body.branchId);
      transaction.set(businessRef, {
        branchIds: FieldValue.arrayRemove(body.branchId),
        branchCount: FieldValue.increment(-1),
        ...(deletingPrimary && replacementPrimaryId ? { primaryBranchId: replacementPrimaryId, primaryLocationId: replacementPrimaryId } : {}),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: user.uid
      }, { merge: true });
      writeAudit(transaction, db, user, "branch.deleted", body.branchId, body.businessId);
    });

    return Response.json({ ok: true, branchId: body.branchId });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the location details and try again.", details: error.flatten() }, { status: 400 });
    return apiError(error);
  }
}

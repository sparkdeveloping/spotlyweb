import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requirePlatformPermission } from "@/lib/access-control-server";
import { notifyUser } from "@/lib/notification-server";
import { safeText } from "@/lib/server-helpers";
import { loadCanonicalBusinessBranches } from "@/lib/business-branches-server";

export const runtime = "nodejs";

const schema = z.object({
  reviewId: z.string().min(3).max(220),
  decision: z.enum(["approve", "request_changes", "reject"]),
  reason: z.string().max(1200).optional().default("")
});

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    requirePlatformPermission(user, "businesses.update", { roles: ["business_success_manager", "operations_manager", "regional_operations_manager"] });
    const body = schema.parse(await request.json());
    if (["request_changes", "reject"].includes(body.decision) && !body.reason.trim()) {
      throw Object.assign(new Error("Record what needs to change before saving this decision."), { status: 422 });
    }
    const { db, messaging, auth } = getAdminServices();
    const reviewRef = db.collection("businessLocationReviews").doc(body.reviewId);
    const initial = await reviewRef.get();
    if (!initial.exists) throw Object.assign(new Error("The location review was not found."), { status: 404 });
    const initialReview = { id: initial.id, ...initial.data() };
    // Repair historical one-sided Business ↔ location linkage before the decision transaction.
    // A submitted location review is trusted server-side evidence of the exact Business/branch
    // relationship; this lets an older reviewed branch reappear in Business instead of failing
    // the approval because branch.businessId drifted or was missing.
    await loadCanonicalBusinessBranches(db, initialReview.businessId, { repair: true });
    const branchRef = db.collection("branches").doc(initialReview.branchId);
    const taskRef = db.collection("adminTasks").doc(body.reviewId);
    const status = body.decision === "approve" ? "approved" : body.decision === "request_changes" ? "changes_requested" : "rejected";

    await db.runTransaction(async (transaction) => {
      const [reviewSnapshot, branchSnapshot] = await Promise.all([transaction.get(reviewRef), transaction.get(branchRef)]);
      if (!reviewSnapshot.exists) throw Object.assign(new Error("The location review was not found."), { status: 404 });
      if (!branchSnapshot.exists) throw Object.assign(new Error("The linked location was not found."), { status: 409 });
      const review = reviewSnapshot.data();
      const branch = branchSnapshot.data();
      if (!["submitted", "assigned", "in_review", "changes_requested"].includes(String(review.status || "submitted"))) {
        throw Object.assign(new Error("This location review already has a final decision."), { status: 409 });
      }
      if (branch.businessId !== review.businessId) throw Object.assign(new Error("The location is no longer linked to this business."), { status: 409 });

      transaction.set(reviewRef, {
        status,
        decisionReason: safeText(body.reason, 1200),
        reviewedBy: user.uid,
        reviewedByEmail: user.email || "",
        reviewedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      transaction.set(taskRef, {
        status: "completed",
        decision: body.decision,
        decisionReason: safeText(body.reason, 1200),
        reviewedBy: user.uid,
        reviewedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      transaction.set(branchRef, {
        reviewStatus: status,
        public: body.decision === "approve" ? review.requestedPublic !== false : false,
        status: body.decision === "approve" ? (branch.status === "paused" ? "paused" : "active") : "draft",
        reviewedBy: user.uid,
        reviewedAt: FieldValue.serverTimestamp(),
        reviewReason: safeText(body.reason, 800),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      transaction.create(db.collection("auditLogs").doc(), {
        action: `business_location_review.${status}`,
        entityType: "businessLocationReview",
        entityId: body.reviewId,
        actorId: user.uid,
        actorEmail: user.email || "",
        metadata: { businessId: review.businessId, branchId: review.branchId, reason: safeText(body.reason, 1200) },
        createdAt: FieldValue.serverTimestamp()
      });
    });

    // Reconcile both sides of the Business ↔ location relationship after every decision.
    // This makes the reviewed branch immediately discoverable in Business even when older
    // records lost branchIds/businessId metadata before this workflow was introduced.
    await loadCanonicalBusinessBranches(db, initialReview.businessId, { repair: true }).catch(() => {});

    if (initialReview.requestedBy) {
      await notifyUser({
        db, messaging, auth, userId: initialReview.requestedBy,
        title: body.decision === "approve" ? `${initialReview.branchName || "Location"} approved` : body.decision === "request_changes" ? `Spotly needs changes to ${initialReview.branchName || "your location"}` : `${initialReview.branchName || "Location"} was not approved`,
        body: body.decision === "approve" ? "The location review is complete and the approved location can now be customer-visible." : safeText(body.reason, 600),
        href: `/business/branches?business=${encodeURIComponent(initialReview.businessId)}`,
        category: "business_location_review", workspace: "business", module: "locations", eventType: `location_review.${status}`, importance: "high", businessId: initialReview.businessId, entityType: "branch", entityId: initialReview.branchId, email: true, forceOperationalEmail: true
      }).catch(() => {});
    }

    return Response.json({ ok: true, reviewId: body.reviewId, status, branchId: initialReview.branchId });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the location decision fields.", details: error.flatten() }, { status: 400 });
    return apiError(error);
  }
}

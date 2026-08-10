import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requirePlatformPermission } from "@/lib/access-control-server";
import { loadBusinessLifecycleData } from "@/lib/business-lifecycle-server";
import { businessHref } from "@/lib/business-routing";
import { safeText } from "@/lib/server-helpers";

export const runtime = "nodejs";

const changeSchema = z.object({
  id: z.string().max(120).optional(),
  label: z.string().min(2).max(240),
  description: z.string().max(600).optional().default(""),
  href: z.string().max(500).optional().default("")
});
const schema = z.object({
  reviewId: z.string().min(3).max(200),
  decision: z.enum(["approve", "request_changes", "reject"]),
  reason: z.string().max(1200).optional().default(""),
  requestedChanges: z.array(changeSchema).max(20).optional().default([])
});

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    requirePlatformPermission(user, "businesses.update", { roles: ["business_success_manager", "operations_manager", "regional_operations_manager"] });
    const body = schema.parse(await request.json());
    if (["request_changes", "reject"].includes(body.decision) && !body.reason.trim() && !body.requestedChanges.length) {
      throw Object.assign(new Error("Record what the business needs to change."), { status: 422 });
    }

    const { db } = getAdminServices();
    const reviewRef = db.collection("businessLaunchReviews").doc(body.reviewId);
    const initialReviewSnapshot = await reviewRef.get();
    if (!initialReviewSnapshot.exists) throw Object.assign(new Error("The launch review was not found."), { status: 404 });
    const initialReview = { id: initialReviewSnapshot.id, ...initialReviewSnapshot.data() };

    // Final approval is always re-evaluated from current server-side business data before
    // the transaction. The transaction below then re-reads the review/business documents
    // and atomically protects the decision against a second reviewer racing this request.
    if (body.decision === "approve") {
      const { lifecycle } = await loadBusinessLifecycleData(db, initialReview.businessId, { userId: initialReview.submittedBy || "" });
      if (lifecycle.launchBlockers.length) {
        throw Object.assign(new Error(`This business is no longer launch-ready. Resolve ${lifecycle.launchBlockers.map((item) => item.label).join(", ")} before approval.`), { status: 409 });
      }
    }

    const normalizedChanges = body.requestedChanges.map((item) => ({
      id: item.id || "",
      label: safeText(item.label, 240),
      description: safeText(item.description, 600),
      href: safeText(item.href, 500)
    }));
    const decisionStatus = body.decision === "approve" ? "approved" : body.decision === "request_changes" ? "changes_requested" : "rejected";
    const nowIso = new Date().toISOString();

    let decidedBusinessId = initialReview.businessId;
    await db.runTransaction(async (transaction) => {
      // Firestore requires all transaction reads before the first write.
      const currentReviewSnapshot = await transaction.get(reviewRef);
      if (!currentReviewSnapshot.exists) throw Object.assign(new Error("The launch review was not found."), { status: 404 });
      const currentReview = { id: currentReviewSnapshot.id, ...currentReviewSnapshot.data() };
      const businessRef = db.collection("businesses").doc(currentReview.businessId);
      const businessSnapshot = await transaction.get(businessRef);
      if (!businessSnapshot.exists) throw Object.assign(new Error("The linked business was not found."), { status: 404 });
      const business = { id: businessSnapshot.id, ...businessSnapshot.data() };
      const reviewType = currentReview.reviewType === "re_review" ? "re_review" : "initial_launch";

      if (["approved", "rejected", "superseded"].includes(String(currentReview.status || "").toLowerCase())) {
        throw Object.assign(new Error("This launch review already has a final decision."), { status: 409 });
      }
      if (body.decision === "approve" && currentReview.businessId !== initialReview.businessId) {
        throw Object.assign(new Error("The linked business changed while the review was being processed. Reload and review it again."), { status: 409 });
      }
      decidedBusinessId = currentReview.businessId;

      transaction.set(reviewRef, {
        status: decisionStatus,
        reviewType,
        decisionReason: safeText(body.reason, 1200),
        requestedChanges: normalizedChanges,
        reviewedBy: user.uid,
        reviewedByEmail: user.email || "",
        reviewedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      transaction.set(db.collection("adminTasks").doc(body.reviewId), {
        status: "completed",
        decision: body.decision,
        decisionReason: safeText(body.reason, 1200),
        reviewedBy: user.uid,
        reviewedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      if (body.decision === "approve") {
        const approvedStatus = reviewType === "re_review" && business.status === "paused" ? "paused" : "active";
        const approvedLifecycleStatus = reviewType === "re_review" && business.lifecycleStatus === "paused" ? "paused" : "live";
        transaction.set(businessRef, {
          status: approvedStatus,
          public: reviewType === "re_review" ? business.public !== false : true,
          lifecycleStatus: approvedLifecycleStatus,
          launchReview: {
            ...(business.launchReview || {}),
            id: body.reviewId,
            status: "approved",
            reviewType,
            requestedChanges: [],
            approvedBy: user.uid,
            approvedAt: nowIso,
            lastApprovedAt: nowIso
          },
          lifecycleSummary: { stage: "live", merchantProgress: 100, externalReviewCount: 0, updatedAt: nowIso },
          lifecycleHistory: FieldValue.arrayUnion({ type: reviewType === "re_review" ? "launch_re_review_approved" : "business_went_live", at: nowIso, reviewId: body.reviewId }),
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: user.uid
        }, { merge: true });
      } else if (reviewType === "re_review") {
        // A re-review is about a launch-critical edit to a business that is already live.
        // Requesting further changes must not throw that business back into onboarding.
        transaction.set(businessRef, {
          status: business.status === "paused" ? "paused" : "active",
          public: business.public !== false,
          lifecycleStatus: business.lifecycleStatus === "paused" ? "paused" : "live",
          launchReview: {
            ...(business.launchReview || {}),
            id: body.reviewId,
            status: "re_review_required",
            reviewType: "re_review",
            requestedChanges: normalizedChanges,
            decisionReason: safeText(body.reason, 1200),
            reviewedBy: user.uid,
            reviewedAt: nowIso
          },
          lifecycleSummary: {
            ...(business.lifecycleSummary || {}),
            stage: "live",
            externalReviewCount: 0,
            updatedAt: nowIso
          },
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: user.uid
        }, { merge: true });
      } else {
        transaction.set(businessRef, {
          status: "draft",
          public: false,
          lifecycleStatus: "preparing",
          launchReview: {
            ...(business.launchReview || {}),
            id: body.reviewId,
            status: decisionStatus,
            reviewType: "initial_launch",
            requestedChanges: normalizedChanges,
            decisionReason: safeText(body.reason, 1200),
            reviewedBy: user.uid,
            reviewedAt: nowIso
          },
          lifecycleSummary: {
            stage: "prepare",
            merchantProgress: Number(currentReview.merchantProgress || business.lifecycleSummary?.merchantProgress || 100),
            externalReviewCount: 0,
            updatedAt: nowIso
          },
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: user.uid
        }, { merge: true });
      }

      if (currentReview.submittedBy) {
        const approved = body.decision === "approve";
        transaction.create(db.collection("notifications").doc(), {
          userId: currentReview.submittedBy,
          title: approved ? (reviewType === "re_review" ? "Spotly approved your business changes" : `${business.brandName || business.name || "Your business"} is live`) : body.decision === "request_changes" ? (reviewType === "re_review" ? "Spotly requested changes to your business update" : "Spotly requested launch changes") : "Launch review needs attention",
          body: approved ? (reviewType === "re_review" ? "Spotly approved the launch-critical changes. Your business remains live." : "Spotly approved the final launch review. Your business is now live.") : safeText(body.reason, 500) || "Open the Launch Checklist to review the requested changes.",
          href: approved ? businessHref("/business/today", { businessId: currentReview.businessId }) : businessHref("/business/launch", { businessId: currentReview.businessId }),
          category: "business_launch_review",
          read: false,
          createdAt: FieldValue.serverTimestamp()
        });
      }
      transaction.create(db.collection("auditLogs").doc(), {
        action: reviewType === "re_review"
          ? (body.decision === "approve" ? "launch_re_review_approved" : body.decision === "request_changes" ? "launch_re_review_changes_requested" : "launch_re_review_rejected")
          : (body.decision === "approve" ? "launch_review_approved" : body.decision === "request_changes" ? "launch_review_changes_requested" : "launch_review_rejected"),
        entityType: "businessLaunchReview",
        entityId: body.reviewId,
        actorId: user.uid,
        actorEmail: user.email || "",
        metadata: { businessId: currentReview.businessId, reviewType, reason: safeText(body.reason, 1200), requestedChanges: normalizedChanges },
        createdAt: FieldValue.serverTimestamp()
      });
    });

    return Response.json({ ok: true, reviewId: body.reviewId, status: decisionStatus, businessId: decidedBusinessId });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the launch decision fields.", details: error.flatten() }, { status: 400 });
    return apiError(error);
  }
}

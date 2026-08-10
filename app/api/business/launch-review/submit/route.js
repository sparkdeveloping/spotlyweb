import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requireBusinessPermission } from "@/lib/access-control-server";
import { loadBusinessLifecycleData, publicLifecycleSnapshot } from "@/lib/business-lifecycle-server";

export const runtime = "nodejs";

const schema = z.object({ businessId: z.string().min(3).max(200) });

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const body = schema.parse(await request.json());
    const { db } = getAdminServices();
    const context = await requireBusinessPermission(db, user, body.businessId, "business.update", { allowRoles: ["organization_owner", "business_owner", "business_manager"] });
    const { input, lifecycle } = await loadBusinessLifecycleData(db, body.businessId, { membership: context.membership, userId: user.uid });
    const isLiveReReview = ["live", "paused"].includes(lifecycle.businessState) && lifecycle.launchReview.status === "re_review_required";

    if (lifecycle.launchReview.state === "in_review") throw Object.assign(new Error(isLiveReReview ? "A review of your launch-critical changes is already active." : "A final launch review is already active for this business."), { status: 409 });
    if (!lifecycle.canSubmitLaunchReview) {
      const blockers = lifecycle.launchBlockers.map((item) => ({ id: item.id, label: item.label, description: item.description, owner: item.owner, state: item.state, href: item.href }));
      const error = Object.assign(new Error("Complete the required launch items before submitting for final review."), { status: 422, blockers });
      throw error;
    }

    const reviewRef = db.collection("businessLaunchReviews").doc();
    const taskRef = db.collection("adminTasks").doc(reviewRef.id);
    const businessRef = db.collection("businesses").doc(body.businessId);
    const business = input.business;
    const safeChecks = lifecycle.launchChecks.map((item) => ({ id: item.id, label: item.label, state: item.state, owner: item.owner, required: item.required, description: item.description }));
    const submittedAt = new Date().toISOString();

    // Protect against two browser tabs submitting the same business at the same time.
    // Lifecycle readiness is evaluated immediately before this transaction; the transaction
    // then re-reads the authoritative business document before creating the active review.
    await db.runTransaction(async (transaction) => {
      const currentBusinessSnapshot = await transaction.get(businessRef);
      if (!currentBusinessSnapshot.exists) throw Object.assign(new Error("The business was not found."), { status: 404 });
      const currentBusiness = { id: currentBusinessSnapshot.id, ...currentBusinessSnapshot.data() };
      const currentReviewStatus = String(currentBusiness.launchReview?.status || "").toLowerCase();
      if (["submitted", "in_review", "assigned", "re_review_submitted", "re_review_in_review"].includes(currentReviewStatus)) {
        throw Object.assign(new Error(["re_review_submitted", "re_review_in_review"].includes(currentReviewStatus) ? "A review of your launch-critical changes is already active." : "A final launch review is already active for this business."), { status: 409 });
      }

      transaction.create(reviewRef, {
        businessId: body.businessId,
        businessName: currentBusiness.brandName || currentBusiness.name || body.businessId,
        organizationId: currentBusiness.organizationId || null,
        status: isLiveReReview ? "re_review_submitted" : "submitted",
        reviewType: isLiveReReview ? "re_review" : "initial_launch",
        submittedBy: user.uid,
        submittedByEmail: user.email || "",
        submittedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        merchantProgress: lifecycle.merchantProgress,
        checklistSnapshot: safeChecks,
        attempt: Number(currentBusiness.launchReview?.attempt || 0) + 1
      });
      transaction.create(taskRef, {
        type: "business_launch_review",
        reviewId: reviewRef.id,
        businessId: body.businessId,
        businessName: currentBusiness.brandName || currentBusiness.name || body.businessId,
        title: `Final launch review · ${currentBusiness.brandName || currentBusiness.name || body.businessId}`,
        description: isLiveReReview ? "A live business changed launch-critical information and submitted those changes for Spotly review." : "Merchant launch setup is complete and waiting for Spotly's final customer-readiness review.",
        status: "open",
        priority: "normal",
        requestedBy: user.uid,
        requestedByEmail: user.email || "",
        merchantProgress: lifecycle.merchantProgress,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
      if (isLiveReReview) {
        transaction.set(businessRef, {
          launchReview: {
            ...(currentBusiness.launchReview || {}),
            id: reviewRef.id,
            status: "re_review_submitted",
            reviewType: "re_review",
            submittedBy: user.uid,
            submittedAt,
            requestedChanges: [],
            attempt: Number(currentBusiness.launchReview?.attempt || 0) + 1
          },
          lifecycleSummary: {
            ...(currentBusiness.lifecycleSummary || {}),
            stage: "live",
            merchantProgress: lifecycle.merchantProgress,
            externalReviewCount: lifecycle.externalReviewCount + 1,
            updatedAt: submittedAt
          },
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: user.uid
        }, { merge: true });
      } else {
        transaction.set(businessRef, {
          status: "pending_publication_review",
          lifecycleStatus: "launch_review",
          launchReview: {
            id: reviewRef.id,
            status: "submitted",
            reviewType: "initial_launch",
            submittedBy: user.uid,
            submittedAt,
            requestedChanges: [],
            attempt: Number(currentBusiness.launchReview?.attempt || 0) + 1
          },
          lifecycleSummary: {
            stage: "review",
            merchantProgress: lifecycle.merchantProgress,
            externalReviewCount: lifecycle.externalReviewCount + 1,
            updatedAt: submittedAt
          },
          publicationReviewRequestedAt: FieldValue.serverTimestamp(),
          publicationReviewRequestedBy: user.uid,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: user.uid
        }, { merge: true });
      }
      transaction.create(db.collection("auditLogs").doc(), {
        action: isLiveReReview ? "launch_re_review_submitted" : "launch_review_submitted",
        entityType: "businessLaunchReview",
        entityId: reviewRef.id,
        actorId: user.uid,
        actorEmail: user.email || "",
        metadata: { businessId: body.businessId, merchantProgress: lifecycle.merchantProgress, reviewType: isLiveReReview ? "re_review" : "initial_launch" },
        createdAt: FieldValue.serverTimestamp()
      });
    });

    return Response.json({ ok: true, reviewId: reviewRef.id, reviewType: isLiveReReview ? "re_review" : "initial_launch", lifecycle: publicLifecycleSnapshot({ ...lifecycle, stage: isLiveReReview ? "live" : "review" }) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Choose a valid business before submitting launch review.", details: error.flatten() }, { status: 400 });
    if (error?.status === 422) return Response.json({ ok: false, error: error.message, blockers: error.blockers || [] }, { status: 422 });
    return apiError(error);
  }
}

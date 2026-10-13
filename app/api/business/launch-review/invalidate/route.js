import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requireBusinessPermission } from "@/lib/access-control-server";
import { safeText } from "@/lib/server-helpers";

export const runtime = "nodejs";

const schema = z.object({
  businessId: z.string().min(3).max(200),
  changeId: z.string().min(2).max(120),
  label: z.string().min(2).max(240),
  description: z.string().max(600).optional().default(""),
  href: z.string().max(500).optional().default("")
});

function uniqueChanges(existing = [], next) {
  const rows = Array.isArray(existing) ? existing.filter(Boolean) : [];
  const normalized = rows.map((item) => typeof item === "string" ? { id: "", label: item, description: "", href: "" } : item);
  return [...new Map([...normalized, next].map((item) => [item.id || item.label, item])).values()].slice(-20);
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const body = schema.parse(await request.json());
    const { db } = getAdminServices();
    await requireBusinessPermission(db, user, body.businessId, "business.update", { allowRoles: ["organization_owner", "business_owner", "business_manager"] });

    const businessRef = db.collection("businesses").doc(body.businessId);
    const initialBusinessSnapshot = await businessRef.get();
    if (!initialBusinessSnapshot.exists) throw Object.assign(new Error("The business was not found."), { status: 404 });
    const initialBusiness = { id: initialBusinessSnapshot.id, ...initialBusinessSnapshot.data() };
    const initialStatus = String(initialBusiness.launchReview?.status || "").toLowerCase();
    const reviewId = initialBusiness.launchReview?.id || "";
    const relevant = reviewId || ["approved", "submitted", "in_review", "assigned", "re_review_required", "re_review_submitted", "re_review_in_review", "resubmission_required"].includes(initialStatus);
    if (!relevant) return Response.json({ ok: true, changed: false, reason: "no_launch_review_to_invalidate" });

    const change = {
      id: safeText(body.changeId, 120),
      label: safeText(body.label, 240),
      description: safeText(body.description, 600),
      href: safeText(body.href, 500),
      source: "merchant_edit"
    };
    const nowIso = new Date().toISOString();
    let result = { changed: false, mode: "none" };

    await db.runTransaction(async (transaction) => {
      // Firestore requires every transaction read before its first write.
      const businessSnapshot = await transaction.get(businessRef);
      if (!businessSnapshot.exists) throw Object.assign(new Error("The business was not found."), { status: 404 });
      const business = { id: businessSnapshot.id, ...businessSnapshot.data() };
      const currentReviewId = business.launchReview?.id || reviewId;
      const reviewRef = currentReviewId ? db.collection("businessLaunchReviews").doc(currentReviewId) : null;
      const taskRef = currentReviewId ? db.collection("adminTasks").doc(currentReviewId) : null;
      const reviewSnapshot = reviewRef ? await transaction.get(reviewRef) : null;

      const reviewStatus = String(business.launchReview?.status || "").toLowerCase();
      const businessState = String(business.lifecycleStatus || "").toLowerCase();
      const legacyStatus = String(business.status || "").toLowerCase();
      const isLive = ["live", "paused"].includes(businessState) || (legacyStatus === "active" && business.public === true) || legacyStatus === "paused";
      const activeReview = ["submitted", "in_review", "assigned", "re_review_submitted", "re_review_in_review"].includes(reviewStatus)
        || ["submitted", "in_review", "assigned", "re_review_submitted", "re_review_in_review"].includes(String(reviewSnapshot?.data()?.status || "").toLowerCase());
      const alreadyRequired = ["re_review_required", "resubmission_required"].includes(reviewStatus);
      if (!activeReview && reviewStatus !== "approved" && !alreadyRequired && !isLive) {
        result = { changed: false, mode: "none" };
        return;
      }

      const requestedChanges = uniqueChanges(business.launchReview?.requestedChanges, change);
      if (reviewRef && reviewSnapshot?.exists && activeReview) {
        transaction.set(reviewRef, {
          status: "superseded",
          supersededReason: "merchant_launch_critical_edit",
          supersededByChange: change,
          supersededAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
        transaction.set(taskRef, {
          status: "completed",
          decision: "superseded_by_merchant_edit",
          decisionReason: `${change.label} changed after review submission.`,
          reviewedBy: user.uid,
          reviewedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
      }

      if (isLive) {
        transaction.set(businessRef, {
          launchReview: {
            ...(business.launchReview || {}),
            status: "re_review_required",
            reviewType: "re_review",
            requestedChanges,
            invalidatedBy: user.uid,
            invalidatedAt: nowIso,
            lastApprovedAt: business.launchReview?.approvedAt || business.launchReview?.lastApprovedAt || null
          },
          lifecycleSummary: {
            ...(business.lifecycleSummary || {}),
            stage: "live",
            externalReviewCount: 0,
            updatedAt: nowIso
          },
          lifecycleHistory: FieldValue.arrayUnion({ type: "launch_re_review_required", at: nowIso, changeId: change.id }),
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: user.uid
        }, { merge: true });
        result = { changed: true, mode: "live_re_review" };
      } else {
        transaction.set(businessRef, {
          status: "draft",
          public: false,
          lifecycleStatus: "preparing",
          launchReview: {
            ...(business.launchReview || {}),
            status: "resubmission_required",
            reviewType: "initial_launch",
            requestedChanges,
            invalidatedBy: user.uid,
            invalidatedAt: nowIso
          },
          lifecycleSummary: {
            ...(business.lifecycleSummary || {}),
            stage: "prepare",
            externalReviewCount: 0,
            updatedAt: nowIso
          },
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: user.uid
        }, { merge: true });
        result = { changed: true, mode: "prelaunch_resubmission" };
      }

      transaction.create(db.collection("auditLogs").doc(), {
        action: isLive ? "launch_re_review_required" : "launch_review_invalidated",
        entityType: "business",
        entityId: body.businessId,
        actorId: user.uid,
        actorEmail: user.email || "",
        metadata: { businessId: body.businessId, change },
        createdAt: FieldValue.serverTimestamp()
      });
    });

    return Response.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the launch-critical change details.", details: error.flatten() }, { status: 400 });
    return apiError(error);
  }
}

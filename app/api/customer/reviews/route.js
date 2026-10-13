import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { safeText } from "@/lib/server-helpers";

export const runtime = "nodejs";

const schema = z.object({ orderId: z.string().min(3).max(180), rating: z.number().int().min(1).max(5), comment: z.string().max(1000).optional().default("") });

function eligible(order = {}) {
  return ["completed", "delivered", "checked_out"].includes(String(order.status || "").toLowerCase()) || String(order.deliveryStatus || "").toLowerCase() === "delivered";
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    await enforceRateLimit(request, { key: "customer-review-write", limit: 12, windowMs: 60 * 60_000, identity: user.uid });
    const body = schema.parse(await request.json());
    const { db } = getAdminServices();
    const orderRef = db.collection("orders").doc(body.orderId);
    const reviewRef = db.collection("businessReviews").doc(body.orderId);

    const result = await db.runTransaction(async (transaction) => {
      const orderSnapshot = await transaction.get(orderRef);
      if (!orderSnapshot.exists) throw Object.assign(new Error("The activity was not found."), { status: 404 });
      const order = orderSnapshot.data() || {};
      if (order.customerId !== user.uid) throw Object.assign(new Error("You can only review your own Spotly activity."), { status: 403 });
      if (!eligible(order)) throw Object.assign(new Error("You can review this business after the activity is completed."), { status: 409 });
      const businessRef = db.collection("businesses").doc(String(order.businessId || ""));
      const [businessSnapshot, existingSnapshot] = await Promise.all([transaction.get(businessRef), transaction.get(reviewRef)]);
      if (!businessSnapshot.exists) throw Object.assign(new Error("This business is no longer available."), { status: 404 });
      const business = businessSnapshot.data() || {};
      const oldRating = existingSnapshot.exists ? Number(existingSnapshot.data()?.rating || 0) : 0;
      const currentCount = Math.max(0, Number(business.reviewCount || 0));
      const currentTotal = Number.isFinite(Number(business.ratingTotal)) ? Number(business.ratingTotal) : Number(business.rating || 0) * currentCount;
      const nextCount = existingSnapshot.exists ? currentCount : currentCount + 1;
      const nextTotal = Math.max(0, currentTotal - oldRating + body.rating);
      const nextRating = nextCount ? Number((nextTotal / nextCount).toFixed(2)) : null;
      const now = FieldValue.serverTimestamp();
      const review = {
        orderId: body.orderId,
        businessId: order.businessId,
        branchId: order.branchId || null,
        customerId: user.uid,
        rating: body.rating,
        comment: safeText(body.comment || "", 1000),
        verifiedPurchase: true,
        status: "published",
        transactionType: order.transactionType || order.fulfilment || "order",
        updatedAt: now,
        ...(existingSnapshot.exists ? {} : { createdAt: now })
      };
      transaction.set(reviewRef, review, { merge: true });
      transaction.set(businessRef, { rating: nextRating, ratingTotal: nextTotal, reviewCount: nextCount, updatedAt: now }, { merge: true });
      transaction.set(orderRef, { customerReviewId: reviewRef.id, customerRating: body.rating, customerReviewComment: review.comment, updatedAt: now }, { merge: true });
      return { id: reviewRef.id, rating: body.rating, comment: review.comment, businessRating: nextRating, reviewCount: nextCount };
    });
    return Response.json({ ok: true, review: result }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Choose a rating from 1 to 5." }, { status: 400 });
    return apiError(error);
  }
}

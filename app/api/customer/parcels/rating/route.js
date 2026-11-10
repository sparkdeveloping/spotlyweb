import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { safeText } from "@/lib/server-helpers";

export const runtime = "nodejs";
const schema = z.object({ parcelJobId: z.string().min(3).max(180), rating: z.number().int().min(1).max(5), comment: z.string().max(1000).optional().default("") });

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    await enforceRateLimit(request, { key: "send-rating", limit: 20, windowMs: 60 * 60_000, identity: user.uid });
    const body = schema.parse(await request.json());
    const { db } = getAdminServices();
    const parcelRef = db.collection("parcelJobs").doc(body.parcelJobId);
    await db.runTransaction(async (transaction) => {
      const parcelSnapshot = await transaction.get(parcelRef);
      if (!parcelSnapshot.exists) throw Object.assign(new Error("The Send request was not found."), { status: 404 });
      const parcel = parcelSnapshot.data() || {};
      if (parcel.customerId !== user.uid) throw Object.assign(new Error("You cannot rate this Send request."), { status: 403 });
      if (!["delivered", "returned"].includes(String(parcel.state || "").toLowerCase()) || !parcel.assignedDriverId) throw Object.assign(new Error("Complete the Send request before rating your courier."), { status: 409 });
      const driverRef = db.collection("drivers").doc(parcel.assignedDriverId);
      const driverSnapshot = await transaction.get(driverRef);
      const driver = driverSnapshot.exists ? driverSnapshot.data() || {} : {};
      const previous = Number(parcel.customerRating || 0);
      const count = Math.max(0, Number(driver.ratingCount || 0));
      const total = Math.max(0, Number(driver.ratingTotal || 0));
      const nextCount = previous ? Math.max(1, count) : count + 1;
      const nextTotal = Math.max(0, total - (previous || 0) + body.rating);
      const nextRating = Number((nextTotal / nextCount).toFixed(2));
      const now = FieldValue.serverTimestamp();
      const comment = safeText(body.comment || "", 1000);
      transaction.set(parcelRef, { customerRating: body.rating, customerReviewComment: comment, customerRatedAt: now, updatedAt: now }, { merge: true });
      transaction.set(driverRef, { rating: nextRating, ratingCount: nextCount, ratingTotal: nextTotal, updatedAt: now }, { merge: true });
      if (parcel.orderId) transaction.set(db.collection("orders").doc(parcel.orderId), { customerRating: body.rating, customerReviewComment: comment, customerReviewedAt: now, updatedAt: now }, { merge: true });
      transaction.create(db.collection("parcelEvents").doc(), { parcelJobId: body.parcelJobId, type: "parcel.driver_rated", actorType: "customer", actorId: user.uid, state: parcel.state, metadata: { rating: body.rating }, createdAt: now });
    });
    return Response.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Choose a rating from 1 to 5." }, { status: 400 });
    return apiError(error);
  }
}

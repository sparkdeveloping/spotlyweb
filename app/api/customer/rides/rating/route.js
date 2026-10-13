import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { safeText } from "@/lib/server-helpers";

export const runtime = "nodejs";
const schema = z.object({ rideId: z.string().min(3).max(180), rating: z.number().int().min(1).max(5), comment: z.string().max(1000).optional() });

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    await enforceRateLimit(request, { key: "ride_rating", limit: 20, windowMs: 60 * 60_000, identity: user.uid });
    const body = schema.parse(await request.json()); const { db } = getAdminServices();
    const rideRef = db.collection("rideTrips").doc(body.rideId);
    await db.runTransaction(async (transaction) => {
      const rideSnap = await transaction.get(rideRef);
      if (!rideSnap.exists) throw Object.assign(new Error("The ride was not found."), { status: 404 });
      const ride = rideSnap.data();
      if (ride.customerId !== user.uid) throw Object.assign(new Error("You cannot rate this ride."), { status: 403 });
      if (ride.state !== "completed" || !ride.assignedDriverId) throw Object.assign(new Error("Complete the ride before rating your Driver."), { status: 409 });
      const driverRef = db.collection("drivers").doc(ride.assignedDriverId); const driverSnap = await transaction.get(driverRef);
      const driver = driverSnap.exists ? driverSnap.data() : {};
      const previous = Number(ride.riderRating || 0); const count = Math.max(0, Number(driver.ratingCount || 0)); const total = Math.max(0, Number(driver.ratingTotal || 0));
      const nextCount = previous ? Math.max(1, count) : count + 1; const nextTotal = Math.max(0, total - (previous || 0) + body.rating); const nextRating = Number((nextTotal / nextCount).toFixed(2));
      const now = FieldValue.serverTimestamp();
      transaction.set(rideRef, { riderRating: body.rating, riderReviewComment: safeText(body.comment || "", 1000), riderRatedAt: now, updatedAt: now }, { merge: true });
      transaction.set(driverRef, { rating: nextRating, ratingCount: nextCount, ratingTotal: nextTotal, updatedAt: now }, { merge: true });
      if (ride.orderId) transaction.set(db.collection("orders").doc(ride.orderId), { customerRating: body.rating, customerReviewComment: safeText(body.comment || "", 1000), customerReviewedAt: now, updatedAt: now }, { merge: true });
      transaction.create(db.collection("rideEvents").doc(), { rideId: body.rideId, type: "ride.driver_rated", actorType: "customer", actorId: user.uid, state: "completed", metadata: { rating: body.rating }, createdAt: now });
    });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Choose a rating from 1 to 5." }, { status: 400 });
    return apiError(error);
  }
}

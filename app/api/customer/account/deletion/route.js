import { FieldValue } from "firebase-admin/firestore";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const rate = await enforceRateLimit(request, { key: "customer-account-deletion", limit: 5, windowMs: 60 * 60_000, identity: user.uid });
    const body = await request.json().catch(() => ({}));
    const reason = String(body?.reason || "customer_request").trim().slice(0, 500) || "customer_request";
    const { db } = getAdminServices();
    const now = FieldValue.serverTimestamp();

    const [rides, parcels, orders] = await Promise.all([
      db.collection("rideTrips").where("customerId", "==", user.uid).limit(60).get(),
      db.collection("parcelJobs").where("customerId", "==", user.uid).limit(60).get(),
      db.collection("orders").where("customerId", "==", user.uid).limit(120).get()
    ]);

    const terminal = new Set(["completed", "delivered", "cancelled", "canceled", "failed", "refunded", "expired"]);
    const activeRideCount = rides.docs.filter((doc) => !terminal.has(String(doc.data()?.state || "").toLowerCase())).length;
    const activeParcelCount = parcels.docs.filter((doc) => !terminal.has(String(doc.data()?.state || "").toLowerCase())).length;
    const activeOrderCount = orders.docs.filter((doc) => !terminal.has(String(doc.data()?.status || "").toLowerCase())).length;
    const blockers = { activeRideCount, activeParcelCount, activeOrderCount };

    const requestRef = db.collection("accountDeletionRequests").doc(user.uid);
    const userRef = db.collection("users").doc(user.uid);
    const batch = db.batch();
    batch.set(requestRef, {
      userId: user.uid,
      status: "requested",
      reason,
      blockers,
      requestedAt: now,
      updatedAt: now,
      source: "customer_ios"
    }, { merge: true });
    batch.set(userRef, { accountDeletionRequestedAt: now, accountDeletionStatus: "requested", updatedAt: now }, { merge: true });
    await batch.commit();

    return Response.json({ ok: true, status: "requested", blockers }, {
      headers: { "Cache-Control": "private, no-store", "X-RateLimit-Remaining": String(rate.remaining) }
    });
  } catch (error) {
    return apiError(error);
  }
}

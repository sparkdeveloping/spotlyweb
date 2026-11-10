import { FieldValue } from "firebase-admin/firestore";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";

export const runtime = "nodejs";

const terminal = new Set(["completed", "delivered", "cancelled", "canceled", "failed", "refunded", "expired", "rejected", "returned", "closed"]);
const assistShoppingTerminal = new Set(["completed", "cancelled", "canceled", "declined", "expired", "refunded", "closed"]);
const assistBookingTerminal = new Set(["completed", "cancelled", "canceled", "declined", "expired", "closed"]);

function activeCount(snapshot, field, terminalStates = terminal, filter = () => true) {
  return snapshot.docs.filter((doc) => {
    const data = doc.data() || {};
    return filter(data) && !terminalStates.has(String(data[field] || "").toLowerCase());
  }).length;
}

async function deletionContext(db, userId) {
  const [rides, parcels, orders, shopping, bookings, existing] = await Promise.all([
    db.collection("rideTrips").where("customerId", "==", userId).limit(100).get(),
    db.collection("parcelJobs").where("customerId", "==", userId).limit(100).get(),
    db.collection("orders").where("customerId", "==", userId).limit(200).get(),
    db.collection("independentShoppingRequests").where("customerId", "==", userId).limit(100).get(),
    db.collection("assistedBookings").where("customerId", "==", userId).limit(100).get(),
    db.collection("accountDeletionRequests").doc(userId).get()
  ]);
  // Ride and Send create linked orders. Exclude those linked order shells here so one
  // active customer transaction is never presented as two separate blockers.
  const activeOrderCount = activeCount(orders, "status", terminal, (order) => !["ride", "send"].includes(String(order.transactionType || "").toLowerCase()));
  const blockers = {
    activeRideCount: activeCount(rides, "state"),
    activeParcelCount: activeCount(parcels, "state"),
    activeOrderCount,
    activeAssistShoppingCount: activeCount(shopping, "state", assistShoppingTerminal),
    activeAssistBookingCount: activeCount(bookings, "state", assistBookingTerminal)
  };
  blockers.total = Object.values(blockers).reduce((sum, value) => sum + Number(value || 0), 0);
  const request = existing.exists ? existing.data() || {} : null;
  return { blockers, request };
}

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    const rate = await enforceRateLimit(request, { key: "customer-account-deletion-read", limit: 30, windowMs: 60_000, identity: user.uid });
    const { db } = getAdminServices();
    const { blockers, request: existing } = await deletionContext(db, user.uid);
    return Response.json({
      ok: true,
      status: existing?.status || "not_requested",
      requestedAt: existing?.requestedAt?.toDate?.()?.toISOString?.() || null,
      blockers
    }, { headers: { "Cache-Control": "private, no-store", "X-RateLimit-Remaining": String(rate.remaining) } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const rate = await enforceRateLimit(request, { key: "customer-account-deletion", limit: 5, windowMs: 60 * 60_000, identity: user.uid });
    const body = await request.json().catch(() => ({}));
    const reason = String(body?.reason || "customer_request").trim().slice(0, 500) || "customer_request";
    const source = String(body?.source || "customer").trim().slice(0, 80) || "customer";
    const { db } = getAdminServices();
    const { blockers } = await deletionContext(db, user.uid);
    const now = FieldValue.serverTimestamp();
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
      source
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

import { FieldValue } from "firebase-admin/firestore";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { deletionContext } from "@/lib/account-deletion-context";

export const runtime = "nodejs";

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

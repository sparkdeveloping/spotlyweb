import { apiError, getAdminServices, verifyAppCheckRequest } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    await verifyAppCheckRequest(request, { required: false });
    const rate = await enforceRateLimit(request, { key: "public-business-reviews", limit: 120, windowMs: 60_000 });
    const url = new URL(request.url);
    const businessId = String(url.searchParams.get("businessId") || "").trim();
    if (!businessId) throw Object.assign(new Error("Choose a business."), { status: 422 });
    const { db } = getAdminServices();
    const snapshot = await db.collection("businessReviews").where("businessId", "==", businessId).limit(100).get();
    const reviews = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) })).filter((item) => item.status === "published").sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)).slice(0, 30).map((item) => ({ id: item.id, rating: Number(item.rating || 0), comment: item.comment || "", verifiedPurchase: item.verifiedPurchase === true, transactionType: item.transactionType || "order", createdAt: item.createdAt?.toDate?.().toISOString?.() || null }));
    return Response.json({ ok: true, reviews }, { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120", "X-RateLimit-Remaining": String(rate.remaining) } });
  } catch (error) { return apiError(error); }
}

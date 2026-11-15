import { getAdminServices, apiError, verifyAppCheckRequest } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { publicCommercialTrial } from "@/lib/commercial-policies.mjs";
export const runtime = "nodejs";
export async function GET(request) {
  // No Firebase request or billable rate-limit operation while promotions are disabled.
  if (process.env.SPOTLY_COMMERCIAL_OFFER_VISIBLE !== "true" || process.env.SPOTLY_COMMERCIAL_PRICING_ENABLED !== "true") {
    return Response.json({ ok: true, offer: null }, { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } });
  }
  try {
    await verifyAppCheckRequest(request, { required: false });
    const rate = await enforceRateLimit(request, { key: "public-commercial-offer", limit: 60, windowMs: 60_000 });
    const { db } = getAdminServices();
    const current = await db.collection("platformSettings").doc("global").get();
    const offer = publicCommercialTrial(current.data()?.commercialPlans);
    return Response.json({ ok: true, offer }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=60", "X-RateLimit-Remaining": String(rate.remaining) } });
  } catch (error) { return apiError(error); }
}

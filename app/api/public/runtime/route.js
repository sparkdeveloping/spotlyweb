import { apiError, getAdminServices, verifyAppCheckRequest } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { publicPlatformSettings } from "@/lib/public-platform-settings";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    await verifyAppCheckRequest(request);
    const rate = await enforceRateLimit(request, { key: "public-runtime", limit: 180, windowMs: 60_000 });
    const { db } = getAdminServices();
    const snapshot = await db.collection("platformSettings").doc("global").get();
    const settings = publicPlatformSettings(snapshot.exists ? snapshot.data() : {});
    return Response.json({ ok: true, settings }, {
      headers: {
        "Cache-Control": "public, max-age=30, stale-while-revalidate=120",
        "X-RateLimit-Remaining": String(rate.remaining)
      }
    });
  } catch (error) { return apiError(error); }
}

import { apiError, verifyAppCheckRequest } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { licensedMapStyle } from "@/lib/mobility-map-provider";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    await verifyAppCheckRequest(request, { required: false });
    const rate = await enforceRateLimit(request, { key: "public-map-config", limit: 120, windowMs: 60_000 });
    const styleUrl = licensedMapStyle();
    return Response.json({
      ok: true,
      ready: Boolean(styleUrl),
      styleUrl,
      provider: "maplibre",
      attribution: "© OpenStreetMap contributors · map tiles subject to your licensed provider terms",
      message: styleUrl ? "" : "Configure a licensed map style URL in SPOTLY_MAP_STYLE_URL to enable interactive maps."
    }, {
      headers: {
        "Cache-Control": "public,max-age=120",
        "X-RateLimit-Remaining": String(rate.remaining)
      }
    });
  } catch (error) {
    return apiError(error);
  }
}

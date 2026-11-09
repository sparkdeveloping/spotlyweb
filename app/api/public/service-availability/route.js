import { apiError, getAdminServices, verifyAppCheckRequest } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { normalizeCountryCode } from "@/lib/country-engine";
import { normalizeServiceId, resolveServiceAvailability, resolveServiceAvailabilitySet } from "@/lib/service-availability";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    await verifyAppCheckRequest(request, { required: false });
    const rate = await enforceRateLimit(request, { key: "public-service-availability", limit: 120, windowMs: 60_000 });
    const url = new URL(request.url);
    const country = normalizeCountryCode(url.searchParams.get("country"));
    const city = String(url.searchParams.get("city") || "").trim();
    const service = normalizeServiceId(url.searchParams.get("service"));
    if (!country) throw Object.assign(new Error("Choose a supported country."), { status: 422 });
    const { db } = getAdminServices();
    const snapshot = await db.collection("platformSettings").doc("global").get();
    const settings = snapshot.exists ? snapshot.data() || {} : {};
    const decisions = service ? [resolveServiceAvailability(settings, { service, country, city })] : resolveServiceAvailabilitySet(settings, { country, city });
    return Response.json({ ok: true, country, city, revision: { id: settings.serviceAvailabilityRevisionId || null, number: Number(settings.serviceAvailabilityRevisionNumber || 0) }, services: decisions }, { headers: { "Cache-Control": "public, max-age=10, stale-while-revalidate=30", "X-RateLimit-Remaining": String(rate.remaining) } });
  } catch (error) { return apiError(error); }
}

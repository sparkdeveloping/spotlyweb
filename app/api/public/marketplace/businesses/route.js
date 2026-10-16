import { apiError, getAdminServices, verifyAppCheckRequest } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { openPlaceById } from "@/lib/open-marketplace-data";
import { publicBusinessRecord } from "@/lib/marketplace-public";
import { isMarketplaceDiscoverable, marketplaceTrust } from "@/lib/marketplace-trust";

export const runtime = "nodejs";

function parseIds(request) {
  const url = new URL(request.url);
  const raw = [
    ...url.searchParams.getAll("id"),
    ...url.searchParams.getAll("ids").flatMap((value) => String(value || "").split(","))
  ];
  return [...new Set(raw.map((value) => String(value || "").trim()).filter(Boolean))].slice(0, 100);
}

export async function GET(request) {
  try {
    await verifyAppCheckRequest(request, { required: false });
    const rate = await enforceRateLimit(request, { key: "public-marketplace-businesses", limit: 120, windowMs: 60_000 });
    const ids = parseIds(request);
    if (!ids.length) throw Object.assign(new Error("At least one business ID is required."), { status: 400 });

    const { db } = getAdminServices();
    const refs = ids.map((id) => db.collection("businesses").doc(id));
    const snapshots = await db.getAll(...refs);
    const snapshotById = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));

    const businesses = [];
    const missing = [];
    for (const id of ids) {
      const snapshot = snapshotById.get(id);
      const curated = openPlaceById(id);
      const source = snapshot?.exists ? { ...(curated || {}), ...snapshot.data() } : curated;
      if (!source || !isMarketplaceDiscoverable(source)) {
        missing.push(id);
        continue;
      }
      const trust = marketplaceTrust(source);
      businesses.push({
        ...publicBusinessRecord(id, { ...source, curated: Boolean(curated) }),
        commerceVerified: trust.commerceVerified === true
      });
    }

    return Response.json(
      { ok: true, businesses, missing },
      { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120", "X-RateLimit-Remaining": String(rate.remaining) } }
    );
  } catch (error) {
    return apiError(error);
  }
}

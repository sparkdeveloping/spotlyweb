import { apiError, getAdminServices, verifyAppCheckRequest } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { openPlaceById } from "@/lib/open-marketplace-data";
import { publicBusinessRecord } from "@/lib/marketplace-public";
import { isMarketplaceDiscoverable } from "@/lib/marketplace-trust";

export const runtime = "nodejs";

function uniqueIDs(url) {
  const values = [
    ...url.searchParams.getAll("id"),
    ...(url.searchParams.get("ids") || "").split(",")
  ];
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))].slice(0, 50);
}

export async function GET(request) {
  try {
    await verifyAppCheckRequest(request, { required: false });
    const rate = await enforceRateLimit(request, { key: "public-marketplace-businesses", limit: 120, windowMs: 60_000 });
    const url = new URL(request.url);
    const ids = uniqueIDs(url);
    if (!ids.length) throw Object.assign(new Error("At least one business ID is required."), { status: 400 });

    const { db } = getAdminServices();
    const snapshots = await Promise.all(ids.map((id) => db.collection("businesses").doc(id).get()));
    const byID = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
    const businesses = [];
    const unavailableIDs = [];

    for (const id of ids) {
      const snapshot = byID.get(id);
      const curated = openPlaceById(id);
      const source = snapshot?.exists ? { ...(curated || {}), ...(snapshot.data() || {}) } : curated;
      if (!source || !isMarketplaceDiscoverable(source)) {
        unavailableIDs.push(id);
        continue;
      }
      businesses.push(publicBusinessRecord(id, { ...source, curated: Boolean(curated) }));
    }

    return Response.json({ ok: true, businesses, unavailableIDs }, {
      headers: {
        "Cache-Control": "public, max-age=20, stale-while-revalidate=90",
        "X-RateLimit-Remaining": String(rate.remaining)
      }
    });
  } catch (error) {
    return apiError(error);
  }
}

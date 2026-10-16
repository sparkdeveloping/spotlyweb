import { apiError, getAdminServices, verifyAppCheckRequest } from "@/lib/firebase-admin";
import { pickupAvailability } from "@/lib/pickup-availability";
import { enforceRateLimit } from "@/lib/rate-limit-server";

export const runtime = "nodejs";

function isLiveBusiness(data = {}) {
  const status = String(data.status || "").toLowerCase();
  const lifecycle = String(data.lifecycleStatus || "").toLowerCase();
  return data.public === true && status !== "archived" && !data.canonicalBusinessId && (["active", "paused"].includes(status) || ["live", "paused"].includes(lifecycle));
}

export async function GET(request) {
  try {
    await verifyAppCheckRequest(request, { required: false });
    const rate = await enforceRateLimit(request, { key: "public-pickup-availability", limit: 180, windowMs: 60_000 });
    const url = new URL(request.url);
    const branchId = String(url.searchParams.get("branchId") || "").trim();
    const days = Math.min(Math.max(Number(url.searchParams.get("days") || 14), 1), 30);
    if (!branchId) throw Object.assign(new Error("Choose a business location first."), { status: 422 });

    const { db } = getAdminServices();
    const branchSnapshot = await db.collection("branches").doc(branchId).get();
    if (!branchSnapshot.exists) throw Object.assign(new Error("That location is not available."), { status: 404 });
    const branch = branchSnapshot.data() || {};
    if (branch.public === false || ["archived", "removed"].includes(String(branch.status || "").toLowerCase())) {
      throw Object.assign(new Error("That location is not accepting public orders."), { status: 404 });
    }
    const businessSnapshot = await db.collection("businesses").doc(String(branch.businessId || "")).get();
    if (!businessSnapshot.exists || !isLiveBusiness(businessSnapshot.data())) {
      throw Object.assign(new Error("This business is not currently available in the marketplace."), { status: 404 });
    }

    const availability = pickupAvailability(branch, { days });
    return Response.json({ ok: true, branchId, ...availability }, {
      headers: {
        "Cache-Control": "private, max-age=15, stale-while-revalidate=30",
        "X-RateLimit-Remaining": String(rate.remaining)
      }
    });
  } catch (error) {
    return apiError(error);
  }
}

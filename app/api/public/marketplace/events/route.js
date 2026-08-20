import { apiError, getAdminServices, verifyAppCheckRequest } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";

export const runtime = "nodejs";

function text(value) { return String(value || "").trim().toLowerCase(); }
function liveBusiness(data = {}) {
  const status = text(data.status);
  const lifecycle = text(data.lifecycleStatus);
  return data.public === true && status !== "archived" && !data.canonicalBusinessId && (["active", "paused"].includes(status) || ["live", "paused"].includes(lifecycle));
}
function plainDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export async function GET(request) {
  try {
    await verifyAppCheckRequest(request, { required: false });
    const rate = await enforceRateLimit(request, { key: "public-marketplace-events", limit: 120, windowMs: 60_000 });
    const url = new URL(request.url);
    const city = text(url.searchParams.get("city"));
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 60), 1), 120);
    const { db } = getAdminServices();
    const productsSnapshot = await db.collection("products").where("itemType", "==", "event").limit(300).get();
    const candidates = productsSnapshot.docs.filter((doc) => {
      const data = doc.data() || {};
      if (data.published !== true || data.active === false || data.available === false || data.status === "archived") return false;
      const endsAt = plainDate(data.endsAt || data.startsAt);
      return !endsAt || new Date(endsAt).getTime() >= Date.now() - 6 * 60 * 60 * 1000;
    });
    const ids = [...new Set(candidates.map((doc) => doc.data()?.businessId).filter(Boolean))];
    const businessPairs = await Promise.all(ids.map(async (id) => [id, await db.collection("businesses").doc(id).get()]));
    const businesses = new Map(businessPairs.filter(([, snap]) => snap.exists && liveBusiness(snap.data())).map(([id, snap]) => [id, snap.data()]));
    const events = candidates.map((doc) => {
      const item = doc.data() || {};
      const business = businesses.get(item.businessId);
      if (!business) return null;
      const businessCity = item.city || business.city || "";
      if (city && text(businessCity) !== city) return null;
      return {
        id: doc.id,
        businessId: item.businessId,
        businessName: business.name || business.brandName || "Business",
        name: item.name || "Event",
        description: item.description || "",
        category: item.category || "Events",
        image: item.image || business.coverImage || business.image || business.logoUrl || business.logo || "",
        currency: item.currency || "USD",
        price: Number(item.price || 0),
        prices: item.prices || {},
        capacity: Number(item.capacity || 0),
        startsAt: plainDate(item.startsAt),
        endsAt: plainDate(item.endsAt),
        venue: item.venue || business.name || "",
        city: businessCity,
        area: item.area || business.area || business.suburb || "",
        address: item.address || business.address || "",
        isFeatured: item.isFeatured === true || item.featured === true || business.isFeatured === true,
        tags: Array.isArray(item.tags) ? item.tags.slice(0, 20) : []
      };
    }).filter(Boolean).sort((a, b) => {
      const aTime = a.startsAt ? new Date(a.startsAt).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.startsAt ? new Date(b.startsAt).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime || a.name.localeCompare(b.name);
    }).slice(0, limit);
    return Response.json({ ok: true, events }, { headers: { "Cache-Control": "public, max-age=20, stale-while-revalidate=60", "X-RateLimit-Remaining": String(rate.remaining) } });
  } catch (error) {
    return apiError(error);
  }
}

import { apiError, getAdminServices, verifyAppCheckRequest } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";

export const runtime = "nodejs";

function text(value) {
  return String(value || "").trim().toLowerCase();
}

function tokens(value) {
  return text(value).replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").split(" ").filter((item) => item.length >= 2).slice(0, 8);
}

function isLive(record = {}) {
  const status = text(record.status);
  const lifecycle = text(record.lifecycleStatus);
  return record.public === true && (status === "active" || status === "paused" || lifecycle === "live" || lifecycle === "paused") && status !== "archived" && !record.canonicalBusinessId;
}

function searchable(record = {}) {
  return [
    record.name,
    record.brandName,
    record.legalName,
    record.category,
    ...(Array.isArray(record.categories) ? record.categories : []),
    record.city,
    record.area,
    record.suburb,
    record.address,
    ...(Array.isArray(record.aliases) ? record.aliases : [])
  ].filter(Boolean).join(" ").toLowerCase();
}

function publicRecord(snapshot) {
  const item = snapshot.data() || {};
  return {
    id: snapshot.id,
    name: item.name || item.brandName || "Business",
    brandName: item.brandName || "",
    category: item.category || item.categories?.[0] || "Business",
    categories: Array.isArray(item.categories) ? item.categories : [],
    description: item.description || "",
    city: item.city || "",
    area: item.area || item.suburb || "",
    suburb: item.suburb || "",
    address: item.address || "",
    logoUrl: item.logoUrl || item.logo || "",
    logo: item.logo || item.logoUrl || "",
    image: item.image || "",
    coverImage: item.coverImage || "",
    verificationStatus: item.verificationStatus || "",
    branchCount: Number(item.branchCount || item.locationCount || 0),
    locationCount: Number(item.locationCount || item.branchCount || 0),
    businessType: item.businessType || "",
    capabilities: Array.isArray(item.capabilities) ? item.capabilities : [],
    status: item.status || "",
    lifecycleStatus: item.lifecycleStatus || "",
    public: item.public === true,
    coordinates: item.coordinates || item.location || null,
    latitude: item.latitude ?? null,
    longitude: item.longitude ?? null,
    rating: Number.isFinite(Number(item.rating)) ? Number(item.rating) : null,
    reviewCount: Number.isFinite(Number(item.reviewCount)) ? Number(item.reviewCount) : 0,
    priceLevel: Number.isFinite(Number(item.priceLevel)) ? Math.max(1, Math.min(4, Number(item.priceLevel))) : null,
    tags: Array.isArray(item.tags) ? item.tags.slice(0, 24) : [],
    isFeatured: item.isFeatured === true || item.featured === true,
    openingHours: item.openingHours || null
  };
}

export async function GET(request) {
  try {
    // Discovery is public, read-only, and rate limited. Do not let an App Check rollout or
    // browser verification failure take the customer marketplace offline.
    await verifyAppCheckRequest(request, { required: false });
    const rate = await enforceRateLimit(request, { key: "public-marketplace", limit: 120, windowMs: 60_000 });
    const url = new URL(request.url);
    const queryText = url.searchParams.get("q") || "";
    const city = text(url.searchParams.get("city") || "");
    const max = Math.min(Math.max(Number(url.searchParams.get("limit") || 100), 1), 250);
    const requestedTokens = tokens(queryText);
    const { db } = getAdminServices();

    // Keep public discovery on a single-field query. This route deliberately does not depend on
    // public+name or public+searchTerms composite indexes, because a missing Firebase index must
    // never turn the whole customer marketplace into an error screen.
    const snapshot = await db.collection("businesses").where("public", "==", true).limit(500).get();
    const records = snapshot.docs
      .filter((item) => isLive(item.data()))
      .map(publicRecord)
      .filter((item) => !city || !text(item.city) || text(item.city) === city)
      .filter((item) => {
        if (!requestedTokens.length) return true;
        const haystack = searchable(item);
        return requestedTokens.every((token) => haystack.includes(token));
      })
      .sort((a, b) => String(a.name).localeCompare(String(b.name), "en", { sensitivity: "base" }))
      .slice(0, max);

    return Response.json({ ok: true, businesses: records }, {
      headers: {
        "Cache-Control": "public, max-age=20, stale-while-revalidate=60",
        "X-RateLimit-Remaining": String(rate.remaining)
      }
    });
  } catch (error) {
    return apiError(error);
  }
}

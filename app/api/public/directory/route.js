import { apiError, getAdminServices, verifyAppCheckRequest } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";

export const runtime = "nodejs";

function text(value) {
  return String(value || "").trim().toLowerCase();
}

function tokens(value) {
  return text(value).replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").split(" ").filter((item) => item.length >= 2).slice(0, 8);
}

function directoryVisible(record = {}) {
  return record.public === true && text(record.status) !== "archived" && !record.canonicalBusinessId;
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
    phone: item.phone || "",
    email: item.email || "",
    website: item.website || "",
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
    public: true
  };
}

export async function GET(request) {
  try {
    await verifyAppCheckRequest(request, { required: false });
    const rate = await enforceRateLimit(request, { key: "public-business-directory", limit: 120, windowMs: 60_000 });
    const url = new URL(request.url);
    const queryText = url.searchParams.get("q") || "";
    const city = text(url.searchParams.get("city") || "");
    const max = Math.min(Math.max(Number(url.searchParams.get("limit") || 50), 1), 250);
    const requestedTokens = tokens(queryText);
    const { db } = getAdminServices();

    // Claim/search discovery includes public provisional listings as well as live businesses.
    // Keep the database lookup single-field and apply text/city filtering in this bounded server route.
    const snapshot = await db.collection("businesses").where("public", "==", true).limit(500).get();
    const businesses = snapshot.docs
      .filter((item) => directoryVisible(item.data()))
      .map(publicRecord)
      .filter((item) => !city || !text(item.city) || text(item.city) === city)
      .filter((item) => {
        if (!requestedTokens.length) return true;
        const haystack = searchable(item);
        return requestedTokens.every((token) => haystack.includes(token));
      })
      .sort((a, b) => String(a.name).localeCompare(String(b.name), "en", { sensitivity: "base" }))
      .slice(0, max);

    return Response.json({ ok: true, businesses }, {
      headers: {
        "Cache-Control": "public, max-age=20, stale-while-revalidate=60",
        "X-RateLimit-Remaining": String(rate.remaining)
      }
    });
  } catch (error) {
    return apiError(error);
  }
}

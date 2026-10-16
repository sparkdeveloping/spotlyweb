import { apiError, getAdminServices, verifyAppCheckRequest } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";

export const runtime = "nodejs";

function text(value) {
  return String(value || "").trim().toLowerCase();
}

function words(value) {
  return text(value).replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").split(" ").filter((part) => part.length >= 2).slice(0, 8);
}

function liveBusiness(record = {}) {
  const status = text(record.status);
  const lifecycle = text(record.lifecycleStatus);
  return record.public === true && status !== "archived" && !record.canonicalBusinessId && (["active", "paused"].includes(status) || ["live", "paused"].includes(lifecycle));
}

function businessRecord(snapshot) {
  const item = snapshot.data() || {};
  return {
    id: snapshot.id,
    type: "business",
    entityId: snapshot.id,
    name: item.name || item.brandName || "Business",
    title: item.name || item.brandName || "Business",
    subtitle: [item.category || item.categories?.[0], item.area || item.suburb || item.city].filter(Boolean).join(" · "),
    description: item.description || "",
    category: item.category || item.categories?.[0] || "Business",
    categories: Array.isArray(item.categories) ? item.categories : [],
    city: item.city || "",
    area: item.area || item.suburb || "",
    address: item.address || "",
    image: item.coverImage || item.image || item.logoUrl || item.logo || "",
    businessType: item.businessType || "",
    capabilities: Array.isArray(item.capabilities) ? item.capabilities : [],
    verificationStatus: item.verificationStatus || "",
    rating: Number.isFinite(Number(item.rating)) ? Number(item.rating) : null,
    reviewCount: Number.isFinite(Number(item.reviewCount)) ? Number(item.reviewCount) : 0,
    tags: Array.isArray(item.tags) ? item.tags.slice(0, 24) : [],
    href: `/?business=${encodeURIComponent(snapshot.id)}`,
    searchText: [item.name, item.brandName, item.category, ...(item.categories || []), item.description, item.city, item.area, item.suburb, item.address, ...(item.aliases || []), ...(item.tags || [])].filter(Boolean).join(" ")
  };
}

function itemKind(item = {}) {
  const type = text(item.itemType);
  if (type === "event" || type === "ticket") return "event";
  if (["appointment", "service"].includes(type)) return "service";
  if (["booking", "stay", "activity"].includes(type)) return "service";
  return "product";
}

function productRecord(snapshot, business) {
  const item = snapshot.data() || {};
  const kind = itemKind(item);
  return {
    id: snapshot.id,
    type: kind,
    entityId: snapshot.id,
    businessId: item.businessId || "",
    businessName: business?.name || "",
    title: item.name || "Offering",
    name: item.name || "Offering",
    subtitle: [business?.name, item.category].filter(Boolean).join(" · "),
    description: item.description || "",
    category: item.category || "General",
    image: item.image || "",
    brand: item.brand || "",
    variant: item.variant || "",
    city: business?.city || "",
    area: business?.area || "",
    currency: item.currency || "USD",
    price: Number.isFinite(Number(item.price)) ? Number(item.price) : null,
    prices: item.prices || {},
    itemType: item.itemType || "product",
    durationMinutes: Number(item.durationMinutes || 0),
    startsAt: item.startsAt?.toDate ? item.startsAt.toDate().toISOString() : item.startsAt || null,
    venue: item.venue || "",
    href: `/?business=${encodeURIComponent(item.businessId || "")}&offer=${encodeURIComponent(snapshot.id)}`,
    business: business ? { id: business.id, name: business.name, category: business.category, categories: business.categories, city: business.city, area: business.area, address: business.address, coverImage: business.image, verificationStatus: business.verificationStatus, businessType: business.businessType, capabilities: business.capabilities, public: true, status: "active" } : null,
    searchText: [item.name, item.description, item.category, item.brand, item.variant, item.venue, business?.name, business?.category, business?.city, business?.area].filter(Boolean).join(" ")
  };
}

function branchRecord(snapshot, business) {
  const item = snapshot.data() || {};
  return {
    id: snapshot.id,
    type: "place",
    entityId: snapshot.id,
    businessId: item.businessId || "",
    businessName: business?.name || "",
    title: item.branchName || item.name || item.displayName || business?.name || "Place",
    subtitle: [item.suburb || item.area, item.city].filter(Boolean).join(" · "),
    description: item.address || "",
    city: item.city || business?.city || "",
    area: item.suburb || item.area || business?.area || "",
    address: item.address || "",
    image: business?.image || "",
    href: `/?business=${encodeURIComponent(item.businessId || "")}`,
    business: business ? { id: business.id, name: business.name, category: business.category, categories: business.categories, city: business.city, area: business.area, address: business.address, coverImage: business.image, verificationStatus: business.verificationStatus, businessType: business.businessType, capabilities: business.capabilities, public: true, status: "active" } : null,
    searchText: [item.branchName, item.name, item.displayName, item.address, item.suburb, item.area, item.city, business?.name].filter(Boolean).join(" ")
  };
}

function serviceMatches(service, business = {}, result = {}) {
  if (!service) return true;
  const haystack = `${business.businessType || ""} ${business.category || ""} ${(business.categories || []).join(" ")} ${(business.capabilities || []).join(" ")} ${result.category || ""} ${result.itemType || ""}`.toLowerCase();
  if (service === "eat") return /(restaurant|food|cafe|takeaway|dining|menu)/.test(haystack);
  if (service === "shop") return /(grocery|retail|store|shop|pharmacy|flowers|gift|product)/.test(haystack);
  if (service === "book") return /(appointment|service|beauty|wellness|spa|salon|doctor|fitness|gym|padel|booking|accommodation|activity)/.test(haystack);
  if (service === "events") return /(event|ticket|venue|festival|concert|market)/.test(haystack);
  return true;
}

function score(record, queryTokens) {
  if (!queryTokens.length) return record.type === "business" ? 20 : record.type === "place" ? 12 : 14;
  const haystack = text(record.searchText);
  const title = text(record.title);
  let value = 0;
  for (const token of queryTokens) {
    if (title === token) value += 50;
    else if (title.startsWith(token)) value += 30;
    else if (title.includes(token)) value += 20;
    if (haystack.includes(token)) value += 8;
  }
  if (record.type === "business") value += 4;
  if (record.type === "event" && record.startsAt) value += 3;
  return value;
}

export async function GET(request) {
  try {
    await verifyAppCheckRequest(request, { required: false });
    const rate = await enforceRateLimit(request, { key: "public-search", limit: 120, windowMs: 60_000 });
    const url = new URL(request.url);
    const queryText = url.searchParams.get("q") || "";
    const queryTokens = words(queryText);
    const city = text(url.searchParams.get("city") || "");
    const service = text(url.searchParams.get("service") || "");
    const requestedType = text(url.searchParams.get("type") || "all");
    const max = Math.min(Math.max(Number(url.searchParams.get("limit") || 40), 1), 80);
    const { db } = getAdminServices();

    const businessSnapshot = await db.collection("businesses").where("public", "==", true).limit(500).get();
    const businesses = businessSnapshot.docs.map(businessRecord).filter((business) => {
      const raw = businessSnapshot.docs.find((doc) => doc.id === business.id)?.data() || {};
      return liveBusiness(raw) && (!city || !text(business.city) || text(business.city) === city);
    });
    const businessMap = new Map(businesses.map((business) => [business.id, business]));
    const liveIds = new Set(businessMap.keys());

    const [productSnapshot, branchSnapshot] = await Promise.all([
      db.collection("products").where("published", "==", true).limit(1200).get(),
      db.collection("branches").where("public", "==", true).limit(800).get()
    ]);

    const products = productSnapshot.docs
      .filter((doc) => liveIds.has(doc.data()?.businessId) && doc.data()?.active !== false && text(doc.data()?.status) !== "archived")
      .map((doc) => productRecord(doc, businessMap.get(doc.data()?.businessId)));
    const places = branchSnapshot.docs
      .filter((doc) => liveIds.has(doc.data()?.businessId) && !["archived", "removed"].includes(text(doc.data()?.status)))
      .map((doc) => branchRecord(doc, businessMap.get(doc.data()?.businessId)))
      .filter((place) => !city || !text(place.city) || text(place.city) === city);

    const all = [...businesses, ...products, ...places]
      .filter((record) => requestedType === "all" || record.type === requestedType || (requestedType === "service" && record.type === "service"))
      .filter((record) => serviceMatches(service, record.type === "business" ? record : businessMap.get(record.businessId), record))
      .map((record) => ({ ...record, score: score(record, queryTokens) }))
      .filter((record) => !queryTokens.length || record.score > 0)
      .sort((a, b) => b.score - a.score || String(a.title).localeCompare(String(b.title), "en", { sensitivity: "base" }))
      .slice(0, max)
      .map(({ searchText: _searchText, score: _score, ...record }) => record);

    const counts = all.reduce((result, item) => ({ ...result, [item.type]: (result[item.type] || 0) + 1 }), {});
    return Response.json({ ok: true, query: queryText, results: all, counts }, {
      headers: {
        "Cache-Control": queryTokens.length ? "public, max-age=10, stale-while-revalidate=30" : "public, max-age=30, stale-while-revalidate=60",
        "X-RateLimit-Remaining": String(rate.remaining)
      }
    });
  } catch (error) {
    return apiError(error);
  }
}

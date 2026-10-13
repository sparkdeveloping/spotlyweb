import { apiError, getAdminServices, verifyAppCheckRequest } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { pickupAvailability } from "@/lib/pickup-availability";
import { promotionWindowActive, publicPromotionRecord } from "@/lib/customer-growth";

export const runtime = "nodejs";

const SERVICES = new Set(["eat", "shop", "book", "events"]);
const HARARE_TIME_ZONE = "Africa/Harare";
const SEED_TTL_MS = 30_000;
let seedCache = { expiresAt: 0, value: null, pending: null };

async function publicSeed(db) {
  const now = Date.now();
  if (seedCache.value && seedCache.expiresAt > now) return seedCache.value;
  if (seedCache.pending) return seedCache.pending;
  seedCache.pending = Promise.all([
    db.collection("businesses").where("public", "==", true).limit(500).get(),
    db.collection("branches").where("public", "==", true).limit(1200).get(),
    db.collection("products").where("published", "==", true).limit(2000).get(),
    db.collection("promotions").where("active", "==", true).limit(1000).get()
  ]).then((value) => { seedCache = { expiresAt: Date.now() + SEED_TTL_MS, value, pending: null }; return value; }).catch((error) => { seedCache.pending = null; throw error; });
  return seedCache.pending;
}

function text(value) {
  return String(value || "").trim().toLowerCase();
}

function plainDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function liveBusiness(record = {}) {
  const status = text(record.status);
  const lifecycle = text(record.lifecycleStatus);
  return record.public === true && status !== "archived" && !record.canonicalBusinessId && (["active", "paused"].includes(status) || ["live", "paused"].includes(lifecycle));
}

function matchesService(service, business = {}) {
  const type = text(business.businessType);
  if (service === "eat" && type === "restaurant_food") return true;
  if (service === "shop" && type === "grocery_retail") return true;
  if (service === "book" && ["appointments_services", "accommodation_activities"].includes(type)) return true;
  if (service === "events" && type === "ticketing_events") return true;
  const haystack = [business.businessType, business.category, ...(business.categories || []), ...(business.capabilities || []), ...(business.tags || [])].filter(Boolean).join(" ").toLowerCase();
  if (service === "eat") return /(restaurant|food|cafe|coffee|bakery|takeaway|dining|menu)/.test(haystack);
  if (service === "shop") return /(grocery|retail|store|shop|pharmacy|fashion|hardware|flowers|gift|product)/.test(haystack);
  if (service === "book") return /(appointment|service|beauty|wellness|spa|salon|health|doctor|fitness|gym|booking|accommodation|activity|stay)/.test(haystack);
  if (service === "events") return /(event|ticket|venue|festival|concert|market|show)/.test(haystack);
  return false;
}

function businessRecord(snapshot) {
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
    businessType: item.businessType || "",
    capabilities: Array.isArray(item.capabilities) ? item.capabilities : [],
    rating: Number.isFinite(Number(item.rating)) ? Number(item.rating) : null,
    reviewCount: Number.isFinite(Number(item.reviewCount)) ? Number(item.reviewCount) : 0,
    priceLevel: Number.isFinite(Number(item.priceLevel)) ? Math.max(1, Math.min(4, Number(item.priceLevel))) : null,
    tags: Array.isArray(item.tags) ? item.tags.slice(0, 24) : [],
    isFeatured: item.isFeatured === true || item.featured === true,
    openingHours: item.openingHours || null,
    status: item.status || "",
    lifecycleStatus: item.lifecycleStatus || "",
    public: item.public === true,
    coordinates: item.coordinates || item.location || null,
    latitude: item.latitude ?? null,
    longitude: item.longitude ?? null
  };
}

function branchRecord(doc) {
  const item = doc.data() || {};
  return {
    id: doc.id,
    businessId: item.businessId || "",
    branchName: item.branchName || item.name || item.displayName || "Location",
    city: item.city || "",
    area: item.suburb || item.area || "",
    address: item.address || "",
    status: item.status || "active",
    public: item.public === true,
    fulfilment: Array.isArray(item.fulfilment) ? item.fulfilment : [],
    openingHours: item.openingHours || {},
    specialHours: item.specialHours || item.openingExceptions || [],
    pickup: item.pickup || {},
    delivery: item.delivery ? {
      enabled: item.delivery.enabled === true,
      paused: item.delivery.paused === true,
      fee: Number(item.delivery.fee || 0),
      radiusKm: Number(item.delivery.radiusKm || 0)
    } : null
  };
}

function itemRecord(doc, business, service) {
  const item = doc.data() || {};
  const itemType = text(item.itemType || "product");
  const resultType = service === "events" || ["event", "ticket"].includes(itemType) ? "event" : service === "book" || ["service", "appointment", "booking", "activity", "stay", "listing"].includes(itemType) ? "service" : "product";
  const remainingCapacity = Number(item.capacity || 0) > 0 ? Math.max(0, Number(item.capacity || 0) - Math.max(0, Number(item.reservedQuantity || 0))) : null;
  return {
    id: doc.id,
    entityId: doc.id,
    type: resultType,
    businessId: item.businessId || "",
    businessName: business?.name || "",
    name: item.name || "Offering",
    title: item.name || "Offering",
    description: item.description || "",
    category: item.category || "General",
    image: item.image || business?.coverImage || business?.image || business?.logoUrl || "",
    brand: item.brand || "",
    variant: item.variant || "",
    packSize: item.packSize || "",
    unit: item.unit || "",
    currency: item.currency || "USD",
    price: Number(item.price || 0),
    prices: item.prices || {},
    compareAtPrice: item.compareAtPrice == null ? null : Number(item.compareAtPrice),
    stockStatus: item.stockStatus || "in_stock",
    stockQuantity: Number(item.stockQuantity || 0),
    available: item.available !== false && item.active !== false,
    itemType: item.itemType || "product",
    durationMinutes: Number(item.durationMinutes || 0),
    capacity: Number(item.capacity || 0),
    remainingCapacity,
    startsAt: plainDate(item.startsAt),
    endsAt: plainDate(item.endsAt),
    venue: item.venue || "",
    city: item.city || business?.city || "",
    area: item.area || business?.area || "",
    tags: Array.isArray(item.tags) ? item.tags.slice(0, 20) : [],
    isFeatured: item.isFeatured === true || item.featured === true || business?.isFeatured === true,
    business: business ? {
      id: business.id,
      name: business.name,
      category: business.category,
      categories: business.categories,
      city: business.city,
      area: business.area,
      address: business.address,
      coverImage: business.coverImage,
      image: business.image,
      logoUrl: business.logoUrl,
      verificationStatus: business.verificationStatus,
      businessType: business.businessType,
      capabilities: business.capabilities,
      public: true,
      status: business.status,
      lifecycleStatus: business.lifecycleStatus
    } : null
  };
}

function nowParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: HARARE_TIME_ZONE,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date());
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function minuteOfDay(value) {
  const [hour, minute] = String(value || "").split(":").map(Number);
  return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : null;
}

function branchOpenNow(branch) {
  if (!branch || ["paused", "closed", "archived", "removed"].includes(text(branch.status))) return false;
  const current = nowParts();
  const hours = branch.openingHours?.[text(current.weekday)];
  if (!hours || hours.closed) return false;
  const open = minuteOfDay(hours.open);
  const close = minuteOfDay(hours.close);
  const now = Number(current.hour) * 60 + Number(current.minute);
  return open !== null && close !== null && now >= open && now < close;
}

function operationalSummary(branches = []) {
  let earliest = null;
  let deliveryFeeFrom = null;
  let pickupAvailable = false;
  let deliveryAvailable = false;
  let openNow = false;
  for (const branch of branches) {
    openNow = openNow || branchOpenNow(branch);
    const pickupConfigured = !branch.fulfilment.length || branch.fulfilment.includes("pickup");
    const availability = pickupConfigured ? pickupAvailability(branch, { days: 3 }) : { available: false };
    if (availability.available) {
      pickupAvailable = true;
      const candidate = availability.earliest ? `${availability.earliest.date}T${availability.earliest.slot.start}:00+02:00` : null;
      if (candidate && (!earliest || candidate < earliest)) earliest = candidate;
    }
    if (branch.delivery?.enabled && !branch.delivery?.paused && branch.fulfilment.includes("delivery")) {
      deliveryAvailable = true;
      const fee = Number(branch.delivery.fee || 0);
      if (deliveryFeeFrom === null || fee < deliveryFeeFrom) deliveryFeeFrom = fee;
    }
  }
  return { openNow, pickupAvailable, deliveryAvailable, earliestPickup: earliest, deliveryFeeFrom, locationCount: branches.length };
}

function matchesArea(business, branches, area) {
  if (!area) return true;
  const needle = text(area);
  if (`${business.area} ${business.suburb} ${business.address}`.toLowerCase().includes(needle)) return true;
  return branches.some((branch) => `${branch.area} ${branch.address}`.toLowerCase().includes(needle));
}

function matchesQuery(record, query) {
  const tokens = text(query).replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((token) => token.length >= 2);
  if (!tokens.length) return true;
  const haystack = [record.name, record.title, record.description, record.category, record.businessName, record.city, record.area, ...(record.categories || []), ...(record.tags || [])].filter(Boolean).join(" ").toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

function itemMatchesService(service, item = {}, business = {}) {
  const type = text(item.itemType || "product");
  if (service === "events") return type === "event" || type === "ticket" || business.businessType === "ticketing_events";
  if (service === "book") return ["service", "appointment", "booking", "activity", "stay", "listing"].includes(type) || ["appointments_services", "accommodation_activities"].includes(business.businessType);
  if (["event", "ticket", "service", "appointment", "booking", "activity", "stay", "listing"].includes(type)) return false;
  return service === "eat" ? matchesService("eat", business) : service === "shop" ? matchesService("shop", business) : false;
}

function trustAdjustedRating(business = {}) {
  const rating = Math.max(0, Math.min(5, Number(business.rating || 0)));
  const count = Math.max(0, Number(business.reviewCount || 0));
  if (!rating || count <= 0) return 4.1;
  const prior = 4.1;
  const priorWeight = 6;
  return (prior * priorWeight + rating * Math.min(count, 250)) / (priorWeight + Math.min(count, 250));
}

function sortBusinesses(a, b) {
  return Number(b.isFeatured) - Number(a.isFeatured)
    || Number(b.operational?.openNow) - Number(a.operational?.openNow)
    || Number(String(b.verificationStatus || "").toLowerCase() === "verified") - Number(String(a.verificationStatus || "").toLowerCase() === "verified")
    || trustAdjustedRating(b) - trustAdjustedRating(a)
    || String(a.name).localeCompare(String(b.name), "en", { sensitivity: "base" });
}

function sortItems(service, a, b) {
  if (service === "events") {
    const aTime = a.startsAt ? new Date(a.startsAt).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.startsAt ? new Date(b.startsAt).getTime() : Number.MAX_SAFE_INTEGER;
    return Number(b.isFeatured) - Number(a.isFeatured) || aTime - bTime || a.name.localeCompare(b.name);
  }
  return Number(b.isFeatured) - Number(a.isFeatured) || a.name.localeCompare(b.name, "en", { sensitivity: "base" });
}

export async function GET(request) {
  try {
    await verifyAppCheckRequest(request, { required: false });
    const rate = await enforceRateLimit(request, { key: "public-service-feed", limit: 100, windowMs: 60_000 });
    const url = new URL(request.url);
    const service = text(url.searchParams.get("service"));
    if (!SERVICES.has(service)) throw Object.assign(new Error("Choose Eat, Shop, Book or Events."), { status: 422 });
    const city = text(url.searchParams.get("city"));
    const area = text(url.searchParams.get("area"));
    const query = String(url.searchParams.get("q") || "").trim();
    const requestedOffset = Number(url.searchParams.get("offset") || 0);
    const requestedLimit = Number(url.searchParams.get("limit") || 24);
    const offset = Number.isFinite(requestedOffset) ? Math.max(0, Math.floor(requestedOffset)) : 0;
    const itemLimit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 8), 48) : 24;
    const { db } = getAdminServices();

    const [businessSnapshot, branchSnapshot, productSnapshot, promotionSnapshot] = await publicSeed(db);

    const allBusinesses = businessSnapshot.docs.filter((doc) => liveBusiness(doc.data())).map(businessRecord);
    const branchMap = new Map();
    branchSnapshot.docs.forEach((doc) => {
      const branch = branchRecord(doc);
      if (!branch.businessId || ["archived", "removed"].includes(text(branch.status))) return;
      const group = branchMap.get(branch.businessId) || [];
      group.push(branch);
      branchMap.set(branch.businessId, group);
    });

    const promotionMap = new Map();
    const platformPromotions = [];
    promotionSnapshot.docs.forEach((doc) => {
      const raw = { id: doc.id, ...(doc.data() || {}) };
      if (!promotionWindowActive(raw) || (raw.audience && raw.audience !== "all_customers") || String(raw.code || "").trim()) return;
      if (raw.scope === "platform") {
        platformPromotions.push(publicPromotionRecord(raw));
        return;
      }
      if (!raw.businessId) return;
      const group = promotionMap.get(raw.businessId) || [];
      group.push(publicPromotionRecord(raw));
      promotionMap.set(raw.businessId, group);
    });

    for (const business of allBusinesses) {
      const applicable = platformPromotions.filter((promotion) => !promotion.businessIds?.length || promotion.businessIds.includes(business.id));
      if (!applicable.length) continue;
      promotionMap.set(business.id, [...(promotionMap.get(business.id) || []), ...applicable]);
    }

    const eligibleBusinesses = allBusinesses
      .filter((business) => matchesService(service, business))
      .filter((business) => !city || !text(business.city) || text(business.city) === city || (branchMap.get(business.id) || []).some((branch) => text(branch.city) === city))
      .filter((business) => matchesArea(business, branchMap.get(business.id) || [], area))
      .map((business) => ({ ...business, operational: operationalSummary(branchMap.get(business.id) || []), promotion: (promotionMap.get(business.id) || [])[0] || null }));

    const eligibleBusinessMap = new Map(eligibleBusinesses.map((business) => [business.id, business]));
    const itemsAll = productSnapshot.docs
      .filter((doc) => {
        const raw = doc.data() || {};
        const business = eligibleBusinessMap.get(raw.businessId);
        if (!business || raw.active === false || raw.available === false || text(raw.status) === "archived") return false;
        return itemMatchesService(service, raw, business);
      })
      .map((doc) => { const record = itemRecord(doc, eligibleBusinessMap.get(doc.data()?.businessId), service); const offers = promotionMap.get(record.businessId) || []; const scoped = offers.find((offer) => !offer.productIds?.length || offer.productIds.includes(record.id)); return { ...record, promotion: scoped || null }; })
      .filter((item) => matchesQuery(item, query))
      .filter((item) => service !== "events" || !item.endsAt || new Date(item.endsAt).getTime() >= Date.now() - 6 * 60 * 60 * 1000)
      .sort((a, b) => sortItems(service, a, b));

    const matchingBusinessIds = new Set(itemsAll.map((item) => item.businessId));
    const businesses = eligibleBusinesses.filter((business) => matchesQuery(business, query) || matchingBusinessIds.has(business.id));

    const categories = [...new Set([
      ...businesses.flatMap((business) => [business.category, ...(business.categories || [])]),
      ...itemsAll.map((item) => item.category)
    ].filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "en", { sensitivity: "base" }));

    const sortedBusinesses = [...businesses].sort(sortBusinesses).slice(0, 80);
    const items = itemsAll.slice(offset, offset + itemLimit);
    const facets = {
      openNow: businesses.filter((business) => business.operational?.openNow).length,
      pickup: businesses.filter((business) => business.operational?.pickupAvailable).length,
      delivery: businesses.filter((business) => business.operational?.deliveryAvailable).length,
      featuredBusinesses: businesses.filter((business) => business.isFeatured).length,
      deals: itemsAll.filter((item) => (Number(item.compareAtPrice || 0) > Number(item.price || 0) && Number(item.price || 0) > 0) || item.promotion).length,
      freeEvents: service === "events" ? itemsAll.filter((item) => Number(item.price || 0) <= 0).length : 0
    };

    return Response.json({
      ok: true,
      service,
      city: url.searchParams.get("city") || "",
      area: url.searchParams.get("area") || "",
      query,
      businesses: sortedBusinesses,
      items,
      categories,
      facets,
      totalBusinesses: businesses.length,
      totalItems: itemsAll.length,
      nextOffset: offset + items.length < itemsAll.length ? offset + items.length : null
    }, {
      headers: {
        "Cache-Control": query ? "public, max-age=10, stale-while-revalidate=30" : "public, max-age=20, stale-while-revalidate=60",
        "X-RateLimit-Remaining": String(rate.remaining)
      }
    });
  } catch (error) {
    return apiError(error);
  }
}

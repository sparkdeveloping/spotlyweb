import { apiError, getAdminServices, verifyAppCheckRequest } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";

export const runtime = "nodejs";

function text(value) {
  return String(value || "").trim().toLowerCase();
}

function liveBusiness(record = {}) {
  const status = text(record.status);
  const lifecycle = text(record.lifecycleStatus);
  return record.public === true && status !== "archived" && !record.canonicalBusinessId && (["active", "paused"].includes(status) || ["live", "paused"].includes(lifecycle));
}

function publicBranch(doc) {
  const item = doc.data() || {};
  return {
    id: doc.id,
    businessId: item.businessId,
    branchName: item.branchName || item.name || item.displayName || "Location",
    name: item.name || item.branchName || item.displayName || "Location",
    displayName: item.displayName || item.branchName || item.name || "Location",
    city: item.city || "",
    suburb: item.suburb || item.area || "",
    address: item.address || "",
    phone: item.phone || item.contactPhone || "",
    status: item.status || "active",
    public: item.public === true,
    fulfilment: Array.isArray(item.fulfilment) ? item.fulfilment : [],
    openingHours: item.openingHours || {},
    specialHours: item.specialHours || item.openingExceptions || [],
    pickup: item.pickup || {},
    paymentMethods: Array.isArray(item.paymentMethods) ? item.paymentMethods : [],
    acceptedCurrencies: Array.isArray(item.acceptedCurrencies) ? item.acceptedCurrencies : ["USD"],
    delivery: item.delivery ? {
      enabled: item.delivery.enabled === true,
      paused: item.delivery.paused === true,
      fee: Number(item.delivery.fee || 0),
      radiusKm: Number(item.delivery.radiusKm || 0)
    } : null,
    location: item.location && Number.isFinite(Number(item.location.lat)) && Number.isFinite(Number(item.location.lng)) ? {
      lat: Number(item.location.lat),
      lng: Number(item.location.lng)
    } : null
  };
}

function publicProduct(doc) {
  const item = doc.data() || {};
  return {
    id: doc.id,
    businessId: item.businessId,
    name: item.name || "Product",
    description: item.description || "",
    category: item.category || "General",
    image: item.image || "",
    brand: item.brand || "",
    variant: item.variant || "",
    packSize: item.packSize || "",
    unit: item.unit || "",
    currency: item.currency || "USD",
    price: Number(item.price || 0),
    prices: item.prices || {},
    compareAtPrice: item.compareAtPrice == null ? null : Number(item.compareAtPrice),
    sku: item.sku || "",
    stockMode: item.stockMode || "status",
    stockQuantity: Number(item.stockQuantity || 0),
    stockStatus: item.stockStatus || "in_stock",
    active: item.active !== false,
    available: item.available !== false,
    pickupEligible: item.pickupEligible !== false,
    maxQuantity: item.maxQuantity == null ? null : Number(item.maxQuantity),
    branchIds: Array.isArray(item.branchIds) ? item.branchIds : [],
    branchOverrides: item.branchOverrides || {},
    itemType: item.itemType || "product",
    durationMinutes: Number(item.durationMinutes || 0),
    capacity: Number(item.capacity || 0),
    startsAt: item.startsAt || null,
    endsAt: item.endsAt || null,
    venue: item.venue || ""
  };
}

export async function GET(request) {
  try {
    await verifyAppCheckRequest(request, { required: false });
    const rate = await enforceRateLimit(request, { key: "public-marketplace-business", limit: 180, windowMs: 60_000 });
    const url = new URL(request.url);
    const businessId = String(url.searchParams.get("businessId") || "").trim();
    if (!businessId) throw Object.assign(new Error("Choose a business first."), { status: 422 });

    const { db } = getAdminServices();
    const businessSnapshot = await db.collection("businesses").doc(businessId).get();
    if (!businessSnapshot.exists || !liveBusiness(businessSnapshot.data())) throw Object.assign(new Error("This business is not currently available in the marketplace."), { status: 404 });

    // Query only by businessId. Public visibility and publication flags are filtered on the
    // server so missing composite indexes cannot make a live business look empty to customers.
    const [branchesSnapshot, productsSnapshot] = await Promise.all([
      db.collection("branches").where("businessId", "==", businessId).limit(250).get(),
      db.collection("products").where("businessId", "==", businessId).limit(1000).get()
    ]);

    const branches = branchesSnapshot.docs
      .filter((doc) => doc.data()?.public === true && !["archived", "removed"].includes(text(doc.data()?.status)))
      .map(publicBranch)
      .sort((a, b) => String(a.branchName).localeCompare(String(b.branchName), "en", { sensitivity: "base" }));

    const products = productsSnapshot.docs
      .filter((doc) => doc.data()?.published === true && doc.data()?.active !== false && doc.data()?.status !== "archived")
      .map(publicProduct)
      .sort((a, b) => String(a.name).localeCompare(String(b.name), "en", { sensitivity: "base" }));

    return Response.json({ ok: true, businessId, branches, products }, {
      headers: {
        "Cache-Control": "public, max-age=10, stale-while-revalidate=30",
        "X-RateLimit-Remaining": String(rate.remaining)
      }
    });
  } catch (error) {
    return apiError(error);
  }
}

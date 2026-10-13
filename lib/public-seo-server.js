import "server-only";

import { getAdminServices } from "@/lib/firebase-admin";

function text(value) { return String(value || "").trim().toLowerCase(); }
function liveBusiness(item = {}) {
  const status = text(item.status); const lifecycle = text(item.lifecycleStatus);
  return item.public === true && status !== "archived" && !item.canonicalBusinessId && (["active", "paused"].includes(status) || ["live", "paused"].includes(lifecycle));
}
function iso(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
function businessPublic(snapshot) {
  if (!snapshot?.exists || !liveBusiness(snapshot.data() || {})) return null;
  const item = snapshot.data() || {};
  return {
    id: snapshot.id,
    name: item.name || item.brandName || "Business",
    description: item.description || "",
    category: item.category || item.categories?.[0] || "Business",
    city: item.city || "",
    area: item.area || item.suburb || "",
    address: item.address || "",
    image: item.coverImage || item.image || item.logoUrl || item.logo || "",
    logo: item.logoUrl || item.logo || "",
    phone: item.phone || item.contactPhone || "",
    rating: Number.isFinite(Number(item.rating)) ? Number(item.rating) : null,
    reviewCount: Number.isFinite(Number(item.reviewCount)) ? Number(item.reviewCount) : 0,
    updatedAt: iso(item.updatedAt || item.createdAt)
  };
}

export async function getPublicBusinessForSeo(id) {
  if (!id) return null;
  try {
    const { db } = getAdminServices();
    return businessPublic(await db.collection("businesses").doc(String(id)).get());
  } catch { return null; }
}

export async function getPublicItemForSeo(id) {
  if (!id) return null;
  try {
    const { db } = getAdminServices();
    const itemSnapshot = await db.collection("products").doc(String(id)).get();
    if (!itemSnapshot.exists) return null;
    const item = itemSnapshot.data() || {};
    if (item.published !== true || item.active === false || item.status === "archived") return null;
    const business = businessPublic(await db.collection("businesses").doc(String(item.businessId || "")).get());
    if (!business) return null;
    return {
      id: itemSnapshot.id,
      businessId: business.id,
      business,
      name: item.name || "Offering",
      description: item.description || "",
      category: item.category || "",
      itemType: item.itemType || "product",
      image: item.image || business.image || "",
      currency: item.currency || "USD",
      price: Number.isFinite(Number(item.price)) ? Number(item.price) : null,
      available: item.available !== false && item.stockStatus !== "out_of_stock",
      startsAt: iso(item.startsAt),
      endsAt: iso(item.endsAt),
      venue: item.venue || "",
      updatedAt: iso(item.updatedAt || item.createdAt)
    };
  } catch { return null; }
}

export async function getPublicSitemapEntries() {
  try {
    const { db } = getAdminServices();
    const [businessesSnapshot, productsSnapshot] = await Promise.all([
      db.collection("businesses").where("public", "==", true).limit(1000).get(),
      db.collection("products").where("published", "==", true).limit(2500).get()
    ]);
    const businesses = businessesSnapshot.docs.map(businessPublic).filter(Boolean);
    const liveIds = new Set(businesses.map((item) => item.id));
    const items = productsSnapshot.docs.map((doc) => {
      const item = doc.data() || {};
      if (!liveIds.has(item.businessId) || item.active === false || item.status === "archived") return null;
      return { id: doc.id, businessId: item.businessId, updatedAt: iso(item.updatedAt || item.createdAt) };
    }).filter(Boolean);
    return { businesses, items };
  } catch { return { businesses: [], items: [] }; }
}

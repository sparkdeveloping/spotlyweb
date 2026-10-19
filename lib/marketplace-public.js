import { publicTrustRecord } from "@/lib/marketplace-trust";

export function plainDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function publicBusinessRecord(id, item = {}) {
  const trust = publicTrustRecord(item);
  return {
    id,
    name: item.name || item.brandName || "Business",
    brandName: item.brandName || "",
    category: item.category || item.categories?.[0] || "Business",
    categories: Array.isArray(item.categories) ? item.categories : [],
    description: item.description || "",
    city: item.city || "",
    country: item.country || "ZW",
    assistEnabled: item.assistEnabled !== false,
    assistStoreId: item.assistStoreId || "",
    area: item.area || item.suburb || "",
    suburb: item.suburb || "",
    address: item.address || "",
    phone: item.phone || "",
    email: item.email || "",
    website: item.website || "",
    logoUrl: item.logoUrl || item.logo || "",
    logo: item.logo || item.logoUrl || "",
    image: item.image || "",
    coverImage: item.coverImage || item.image || "",
    verificationStatus: item.verificationStatus || "listed",
    businessType: item.businessType || "",
    status: item.status || "provisional",
    lifecycleStatus: item.lifecycleStatus || "listed",
    public: item.public === true,
    coordinates: item.coordinates || item.location || null,
    latitude: item.latitude ?? item.coordinates?.lat ?? null,
    longitude: item.longitude ?? item.coordinates?.lng ?? null,
    rating: Number.isFinite(Number(item.rating)) ? Number(item.rating) : null,
    reviewCount: Number.isFinite(Number(item.reviewCount)) ? Number(item.reviewCount) : 0,
    priceLevel: Number.isFinite(Number(item.priceLevel)) ? Math.max(1, Math.min(4, Number(item.priceLevel))) : null,
    tags: Array.isArray(item.tags) ? item.tags.slice(0, 24) : [],
    searchTerms: Array.isArray(item.searchTerms) ? item.searchTerms.slice(0, 40) : [],
    aliases: Array.isArray(item.aliases) ? item.aliases.slice(0, 20) : [],
    sourceTags: item.sourceTags && typeof item.sourceTags === "object" ? item.sourceTags : {},
    isFeatured: item.isFeatured === true || item.featured === true,
    openingHours: item.openingHours || null,
    branchCount: Number(item.branchCount || item.locationCount || 0),
    locationCount: Number(item.locationCount || item.branchCount || 0),
    fulfilment: trust.commerceVerified && Array.isArray(item.fulfilment) ? item.fulfilment : [],
    source: item.source ? {
      type: item.source.type || "",
      label: item.source.label || "",
      url: item.source.url || "",
      rightsStatus: item.source.rightsStatus || "",
      license: item.source.license || "",
      licenseUrl: item.source.licenseUrl || ""
    } : null,
    curated: item.curated === true || item.source?.type === "openstreetmap",
    ...trust
  };
}

export function publicCanonicalProduct(item = {}) {
  return {
    id: item.id,
    type: "product",
    entityId: item.id,
    name: item.canonicalName || "Product",
    title: item.canonicalName || "Product",
    subtitle: [item.brand, item.packSize, item.categoryPath?.at?.(-1)].filter(Boolean).join(" · "),
    description: item.description || "Product reference in the Spotly catalogue.",
    brand: item.brand || "",
    variant: item.variant || "",
    packSize: item.packSize || "",
    gtin: item.gtin || "",
    category: item.categoryPath?.at?.(-1) || "Groceries",
    categories: item.categoryPath || [],
    image: item.primaryImage || "",
    price: null,
    currency: "USD",
    catalogReference: true,
    merchantOfferRequired: true,
    storeAvailabilityConfirmed: false,
    sourceType: item.sourceType || "",
    sourceRightsStatus: item.sourceRightsStatus || "",
    sourceReferences: Array.isArray(item.sourceReferences) ? item.sourceReferences.slice(0, 3) : [],
    href: `/search?q=${encodeURIComponent(item.canonicalName || "")}`,
    searchText: [item.canonicalName, item.brand, item.packSize, ...(item.categoryPath || []), ...(item.searchTerms || [])].filter(Boolean).join(" ")
  };
}

export function publicMerchantProduct(id, item = {}, business = null) {
  return {
    id,
    type: item.type || "product",
    entityId: id,
    businessId: item.businessId || "",
    name: item.name || "Item",
    title: item.name || "Item",
    subtitle: [item.brand, item.variant, item.category, business?.name].filter(Boolean).join(" · "),
    description: item.description || "",
    category: item.category || "",
    brand: item.brand || "",
    variant: item.variant || "",
    image: item.image || item.imageUrl || item.photoUrl || "",
    price: Number(item.price || 0),
    currency: item.currency || business?.currency || "USD",
    stockStatus: item.stockStatus || "",
    published: item.published === true,
    catalogReference: false,
    merchantOfferRequired: false,
    storeAvailabilityConfirmed: true,
    href: `/?business=${encodeURIComponent(item.businessId || "")}&offer=${encodeURIComponent(id)}`,
    business,
    searchText: [item.name, item.description, item.category, item.brand, item.variant, business?.name, business?.category, business?.city, business?.area].filter(Boolean).join(" ")
  };
}

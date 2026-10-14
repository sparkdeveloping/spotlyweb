const EDITORIAL = {
  eat: "/marketplace/editorial/eat.webp",
  groceries: "/marketplace/editorial/groceries.webp",
  shop: "/marketplace/editorial/shop.webp",
};

export function marketplaceEditorialImage(record = {}) {
  const category = String(record.category || record.categories?.[0] || "").toLowerCase();
  const type = String(record.businessType || "").toLowerCase();
  if (type === "restaurant_food" || /restaurant|cafe|food|nightlife|takeaway/.test(category)) return EDITORIAL.eat;
  if (type === "grocery_retail" || /grocery|supermarket|bakery|butcher|pharmacy/.test(category)) return EDITORIAL.groceries;
  return EDITORIAL.shop;
}

export function shouldUseEditorialImage(record = {}) {
  return !record.coverImage && !record.image && !record.logoUrl && !record.logo;
}

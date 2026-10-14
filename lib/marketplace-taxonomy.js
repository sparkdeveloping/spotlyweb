const SHOP_TYPES = [
  ["supermarket", "supermarket", "Supermarket", "groceries"],
  ["convenience", "convenience", "Convenience store", "groceries"],
  ["greengrocer|produce", "produce", "Fresh produce", "groceries"],
  ["butcher", "butcher", "Butchery", "groceries"],
  ["bakery", "bakery", "Bakery", "eat"],
  ["pharmacy|chemist", "pharmacy", "Pharmacy", "pharmacy"],
  ["stationery|stationary|office supplies", "stationery", "Stationery & office supplies", "stationery"],
  ["books|bookstore|book shop", "books", "Bookstore", "books"],
  ["toys|toy", "toys", "Toys & kids", "toys"],
  ["baby_goods|baby goods", "baby", "Baby goods", "baby"],
  ["clothes|clothing|fashion_accessories|fashion accessories|boutique", "fashion", "Fashion & accessories", "fashion"],
  ["shoes|footwear", "footwear", "Shoes & footwear", "fashion"],
  ["jewelry|jewellery", "jewellery", "Jewellery", "fashion"],
  ["beauty|cosmetics", "beauty_products", "Beauty products", "beauty"],
  ["electronics|electrical|computer|mobile_phone|mobile phone|phone", "electronics", "Electronics", "electronics"],
  ["photo|camera", "photography", "Photography & photo services", "photography"],
  ["copyshop|copy shop|printing", "printing", "Print & copy shop", "printing"],
  ["hardware", "hardware", "Hardware", "hardware"],
  ["furniture", "furniture", "Furniture", "home"],
  ["houseware|homeware", "homeware", "Homeware", "home"],
  ["appliance", "appliances", "Appliances", "home"],
  ["fabric|textile", "fabric", "Fabric & textiles", "fashion"],
  ["sports", "sporting_goods", "Sporting goods", "sports"],
  ["bicycle", "bicycles", "Bicycles", "sports"],
  ["florist|flowers", "florist", "Florist", "florist"],
  ["gift", "gifts", "Gifts", "gifts"],
  ["pet", "pets", "Pet supplies", "pets"],
  ["car_parts|car parts|tyres|tires|auto parts", "auto_parts", "Auto parts", "automotive"],
  ["department_store|department store", "department_store", "Department store", "department"],
  ["variety_store|variety store", "variety_store", "Variety store", "department"],
  ["mall|shopping_centre|shopping centre", "mall", "Shopping centre", "department"],
  ["marketplace|market", "market", "Local market", "market"],
  ["beverages", "beverages", "Beverages", "groceries"],
  ["alcohol|wine|liquor", "alcohol", "Bottle store", "beverages"],
  ["kiosk", "kiosk", "Kiosk", "convenience"],
];

const BOOK_TYPES = [
  ["hairdresser|hair salon|salon", "hair", "Hair salon"],
  ["barber", "barber", "Barber shop"],
  ["nail", "nails", "Nail salon"],
  ["spa|massage", "spa", "Spa & massage"],
  ["beauty", "beauty", "Beauty services"],
  ["gym|fitness", "fitness", "Fitness & gym"],
  ["dentist|dental", "dental", "Dental care"],
  ["clinic|doctor|medical|hospital", "medical", "Health services"],
  ["optician|optometry", "optometry", "Optometry"],
  ["veterinary|vet", "veterinary", "Veterinary"],
  ["hotel|lodge|guest_house|guest house|motel|hostel|apartment|resort", "stay", "Stay"],
  ["photographer|photo studio", "photography", "Photography services"],
];

const EVENT_TYPES = [
  ["cinema", "cinema", "Cinema"],
  ["theatre|theater", "theatre", "Theatre"],
  ["museum", "museum", "Museum"],
  ["concert|music", "music", "Live music"],
  ["festival", "festival", "Festival"],
  ["conference", "conference", "Conference"],
  ["event|venue", "events", "Events & venues"],
  ["golf|sports", "sports_event", "Sports & activities"],
  ["attraction|activity", "activities", "Activities"],
];

function text(value) { return String(value || "").trim().toLowerCase(); }

export function marketplaceSignals(record = {}) {
  const sourceValues = Object.values(record.sourceTags || {});
  return [
    record.businessType,
    record.category,
    ...(record.categories || []),
    ...(record.tags || []),
    ...(record.searchTerms || []),
    ...sourceValues,
    record.name,
    record.brandName,
  ].filter(Boolean).join(" ").toLowerCase().replace(/[_-]+/g, " ");
}

function matchTable(signals, table) {
  for (const [pattern, id, label, mediaFamily] of table) {
    if (new RegExp(`(?:^|\\b)(?:${pattern})(?:\\b|$)`, "i").test(signals)) return { id, label, mediaFamily: mediaFamily || id };
  }
  return null;
}

export function marketplaceProfile(record = {}) {
  const signals = marketplaceSignals(record);
  const type = text(record.businessType);
  let service = "directory";
  let vertical = "business";
  let displayCategory = record.category || record.categories?.[0] || "Business";
  let mediaFamily = "default";

  if (type === "restaurant_food" || /restaurant|cafe|coffee|bakery|takeaway|fast food|food|pub|bar|nightlife/.test(signals)) {
    service = "eat";
    vertical = /bakery/.test(signals) ? "bakery" : /cafe|coffee/.test(signals) ? "cafe" : /pub|bar|nightlife/.test(signals) ? "nightlife" : "restaurant";
    displayCategory = vertical === "cafe" ? "Café" : vertical === "bakery" ? "Bakery" : vertical === "nightlife" ? "Bar & nightlife" : "Restaurant";
    mediaFamily = vertical === "cafe" ? "cafe" : vertical === "bakery" ? "bakery" : "eat";
  } else {
    const shop = matchTable(signals, SHOP_TYPES);
    const book = matchTable(signals, BOOK_TYPES);
    const event = matchTable(signals, EVENT_TYPES);
    if (shop || type === "grocery_retail" || /retail|shop|store|grocer/.test(signals)) {
      service = "shop";
      vertical = shop?.id || (type === "grocery_retail" ? "supermarket" : "retail");
      displayCategory = shop?.label || (type === "grocery_retail" ? "Shop & groceries" : "Retail");
      mediaFamily = shop?.mediaFamily || (type === "grocery_retail" ? "groceries" : "shop");
    } else if (book || ["appointments_services", "accommodation_activities"].includes(type)) {
      service = "book";
      vertical = book?.id || (type === "accommodation_activities" ? "stay" : "services");
      displayCategory = book?.label || (type === "accommodation_activities" ? "Stay" : "Services");
      mediaFamily = vertical;
    } else if (event || type === "ticketing_events") {
      service = "events";
      vertical = event?.id || "events";
      displayCategory = event?.label || "Events";
      mediaFamily = vertical;
    }
  }

  const commerceVerified = record.commerceVerified === true || record.commerceEnabled === true || record.trustState === "commerce_verified";
  const cardMode = commerceVerified ? "commerce" : "directory";
  const primaryAction = commerceVerified
    ? (service === "eat" ? "view_menu" : service === "shop" ? "shop" : service === "book" ? "book" : service === "events" ? "tickets" : "view")
    : "view_listing";

  return { service, vertical, displayCategory, mediaFamily, commerceVerified, cardMode, primaryAction };
}

export function serviceMatchesMarketplaceBusiness(service, record = {}) {
  if (!service) return true;
  return marketplaceProfile(record).service === service;
}

export const SHOP_CATEGORY_ORDER = [
  "supermarket", "convenience", "pharmacy", "fashion", "stationery", "electronics", "hardware", "homeware", "furniture", "toys", "books", "florist", "gifts", "photography", "printing", "department_store", "market"
];

export function marketplaceActionLabel(record = {}, serviceOverride = "") {
  const profile = marketplaceProfile({ ...record, businessType: record.businessType });
  if (profile.cardMode === "directory") return "View place";
  const service = serviceOverride || profile.service;
  if (service === "eat") return "View menu";
  if (service === "shop") return "Shop";
  if (service === "book") return "Book";
  if (service === "events") return "Tickets";
  return "View";
}

import { foodBrandPhotoFamily } from "./food-brand.js";
/** Bundled illustrative photography, refined by a recognised outlet identity. */
const BASE = "/marketplace/photography";
const SUBJECTS = {
  supermarket: "supermarket", restaurant: "Zimbabwean food", hotel: "guest accommodation", clinic: "medical consultation room", pharmacy: "pharmacy", "hair-salon": "hair salon", "fuel-station": "fuel station", "professional-office": "professional office",
  convenience: "convenience shop", "fresh-produce": "fresh produce shop", butchery: "butchery", bakery: "bakery", cafe: "coffee shop", "fried-chicken": "fried chicken", pizza: "pizza", burger: "burger meal", "asian-food": "Asian food", "ice-cream": "ice cream", bar: "bar and lounge", fashion: "clothing boutique", hardware: "hardware shop", electronics: "electronics", banking: "financial services", "shopping-centre": "shopping centre",
  "restaurant-interior": "restaurant dining room", takeaway: "takeaway counter", "grilled-chicken": "grilled chicken", hostel: "hostel accommodation", camping: "campsite", travel: "travel services", "vehicle-showroom": "vehicle showroom", "auto-repair": "vehicle workshop", "auto-parts": "vehicle parts and tyres", "car-wash": "car wash", furniture: "furniture showroom", homeware: "home essentials", "general-retail": "retail shop", "bottle-store": "bottle store", beverages: "drinks retailer", fitness: "fitness gym", "sports-field": "sports club", golf: "golf course", museum: "museum gallery", cinema: "cinema", theatre: "theatre", "event-venue": "events venue", dental: "dental care", optometry: "optician", veterinary: "veterinary care", "beauty-products": "beauty products", "beauty-salon": "beauty and nail studio", spa: "spa treatment room", barber: "barber shop", florist: "florist", bookshop: "bookshop", stationery: "stationery shop", footwear: "footwear shop", jewellery: "jewellery shop", gifts: "gift shop", printing: "print shop", photography: "photography studio", "baby-goods": "baby goods", toys: "toy shop", "party-supplies": "party supplies", "gas-supplies": "cooking-gas supplier", "agricultural-supplies": "agricultural supplies", "sporting-goods": "sports equipment", fabric: "fabric and tailoring", "outdoor-gear": "outdoor equipment", laundry: "laundry and dry cleaning", "garden-centre": "garden centre", tattoo: "tattoo studio", cleaning: "cleaning services", "herbal-products": "herbal products", motorcycles: "motorcycle showroom", "swimming-pool": "swimming pool", education: "education", courier: "courier services", "solar-equipment": "solar equipment", "pet-supplies": "pet supplies", funeral: "funeral services", "market-stalls": "local market", park: "park and gardens", confectionery: "confectionery", bicycles: "bicycle shop", appliances: "appliance shop", bathroom: "bathroom fixtures", "art-gallery": "art gallery", boating: "marine equipment", "pest-control": "pest-control services", "medical-supplies": "medical supplies", "betting-shop": "sports betting premises", "tobacco-shop": "tobacco shop", dance: "dance studio", "cheese-deli": "cheese and deli shop", "fuel-supplies": "fuel supplies", paint: "paint shop"
};
export const BUSINESS_PHOTO_FAMILIES = Object.freeze(SUBJECTS);

export const STRUCTURED_PHOTO_TYPES = Object.freeze({
  amenity: { fuel: "fuel-station", bank: "banking", clinic: "clinic", hospital: "clinic", doctors: "clinic", pharmacy: "pharmacy", restaurant: "restaurant-interior", fast_food: "takeaway", cafe: "cafe", bar: "bar", pub: "bar", nightclub: "bar", marketplace: "market-stalls", cinema: "cinema", theatre: "theatre", dentist: "dental", car_wash: "car-wash", veterinary: "veterinary", events_venue: "event-venue", ice_cream: "ice-cream", post_office: "courier", university: "education" },
  tourism: { hotel: "hotel", motel: "hotel", guest_house: "hotel", apartment: "hotel", hostel: "hostel", camp_site: "camping", attraction: "park", museum: "museum", gallery: "art-gallery" },
  leisure: { sports_centre: "sports-field", fitness_centre: "fitness", golf_course: "golf", water_park: "swimming-pool", dance: "dance", park: "park" },
  craft: { tailor: "fabric", photographer: "photography", cleaning: "cleaning", bookbinder: "printing" },
  shop: { supermarket: "supermarket", convenience: "convenience", clothes: "fashion", fashion: "fashion", fashion_accessories: "fashion", hardware: "hardware", car: "vehicle-showroom", butcher: "butchery", alcohol: "bottle-store", electronics: "electronics", computer: "electronics", mobile_phone: "electronics", electrical: "electronics", furniture: "furniture", mall: "shopping-centre", car_repair: "auto-repair", truck_repair: "auto-repair", yes: "general-retail", general: "general-retail", department_store: "general-retail", variety_store: "general-retail", catalogue: "general-retail", charity: "general-retail", books: "bookshop", greengrocer: "fresh-produce", farm: "fresh-produce", chemist: "pharmacy", beverages: "beverages", beauty: "beauty-salon", shoes: "footwear", copyshop: "printing", bakery: "bakery", pastry: "bakery", florist: "florist", optician: "optometry", gift: "gifts", funeral_directors: "funeral", travel_agency: "travel", car_parts: "auto-parts", tyres: "auto-parts", stationery: "stationery", photo: "photography", baby_goods: "baby-goods", kiosk: "convenience", hairdresser: "hair-salon", hairdresser_supply: "beauty-products", cosmetics: "beauty-products", perfumery: "beauty-products", bicycle: "bicycles", toys: "toys", party: "party-supplies", gas: "gas-supplies", energy: "fuel-supplies", agrarian: "agricultural-supplies", sports: "sporting-goods", fabric: "fabric", sewing: "fabric", outdoor: "outdoor-gear", fishing: "outdoor-gear", kitchen: "homeware", houseware: "homeware", appliance: "appliances", bathroom_furnishing: "bathroom", dry_cleaning: "laundry", laundry: "laundry", art: "art-gallery", antiques: "museum", interior_decoration: "furniture", carpet: "furniture", household_linen: "homeware", bed: "hotel", garden_centre: "garden-centre", tattoo: "tattoo", boat: "boating", ticket: "travel", pest_control: "pest-control", herbalist: "herbal-products", medical_supply: "medical-supplies", motorcycle: "motorcycles", jewelry: "jewellery", paint: "paint", trade: "swimming-pool", tobacco: "tobacco-shop", wholesale: "general-retail", pet: "pet-supplies", bookmaker: "betting-shop", swimming_pool: "swimming-pool", massage: "spa", confectionery: "confectionery", chocolate: "confectionery", cheese: "cheese-deli" },
  office: { company: "professional-office", lawyer: "professional-office", ngo: "professional-office", telecommunication: "electronics", insurance: "professional-office", financial: "banking", estate_agent: "professional-office", travel_agent: "travel", accountant: "professional-office" }
});

function normalized(value) { return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim(); }
const contains = (value, pattern) => new RegExp(`(?:^|\\b)(?:${pattern})(?:\\b|$)`, "i").test(value);
function tagFamily(tags, key) {
  const raw = String(tags[key] || "").toLowerCase().trim();
  return raw.split(";").map(value => STRUCTURED_PHOTO_TYPES[key]?.[value.trim()]).find(Boolean) || "";
}

function foodFamily(record, base) {
  if (!["restaurant-interior", "takeaway", "cafe", "bakery", "ice-cream"].includes(base)) return base;
  const identity = foodBrandPhotoFamily(record);
  if (identity) return identity;
  const name = normalized(record.brandName || record.name || record.title);
  const cuisine = normalized(record.sourceTags?.cuisine || record.cuisine);
  if (/\bnando(?:['’]?s)?\b/i.test(name) || contains(cuisine, "portuguese|mozambican")) return "grilled-chicken";
  if (contains(cuisine, "pizza") || /pizza inn|pizza hut|pizzeria/i.test(name)) return "pizza";
  if (contains(cuisine, "burger") || /(?:\bsteers\b|mr burger|burger king)/i.test(name)) return "burger";
  if (/creamy inn/i.test(name) || contains(cuisine, "ice cream")) return "ice-cream";
  if (/baker'?s inn/i.test(name)) return "bakery";
  if (contains(cuisine, "chicken") || /chicken inn|\bkfc\b/i.test(name)) return "fried-chicken";
  if (contains(cuisine, "chinese|thai")) return "asian-food";
  if (contains(cuisine, "african|regional|zimbabwean|traditional and organic foods")) return "restaurant";
  return base;
}

export function businessPhotoFamily(record = {}) {
  const tags = record.sourceTags && typeof record.sourceTags === "object" ? record.sourceTags : {};
  const name = normalized(record.name || record.title || record.brandName);
  // Narrow corrections for documented conflicting source tags; never a broad substring override.
  if (/^dangamvura 1 high school$/.test(name)) return "education";
  if (/^john sisk contracting$/.test(name)) return "professional-office";
  if (/^frecon solar system$/.test(name)) return "solar-equipment";
  if (/^econet$/.test(name)) return "electronics";
  if (/^veterinary distributors$/.test(name)) return "veterinary";
  if (/^mwos moors world of sport$/.test(name)) return "betting-shop";
  if (["beauty", "hairdresser"].includes(tags.shop) && contains(name, "barber")) return "barber";
  if (tags.shop === "beauty" && contains(name, "spa|massage")) return "spa";
  if (tags.amenity === "post_office") return "courier";
  // Imported outlets can carry a sibling's cuisine, a parent company as brand,
  // or a cafe/supermarket tag. Resolve the actual named food brand first, while
  // keeping explicit non-food premises (e.g. a bar or pharmacy) distinct.
  const identity = foodBrandPhotoFamily(record);
  if (identity && (!tags.amenity || ["restaurant", "fast_food", "cafe", "ice_cream"].includes(tags.amenity)) &&
      (!tags.shop || ["supermarket", "bakery", "convenience", "yes"].includes(tags.shop)) && !tags.tourism && !tags.office && !tags.leisure) return identity;
  for (const key of ["amenity", "tourism", "leisure", "craft", "shop", "office"]) {
    const family = tagFamily(tags, key);
    if (family) return foodFamily(record, family);
  }
  if (Object.hasOwn(SUBJECTS, record.photoFamily || "")) return record.photoFamily;
  const category = normalized([record.category, ...(Array.isArray(record.categories) ? record.categories : [])].filter(Boolean).join(" "));
  const signals = `${category} ${normalized(record.businessType)} ${name}`;
  const rules = [
    ["supermarkets?|grocer(?:y|ies|s)?|bon marche|pick n pay|spar", "supermarket"],
    ["pharmacy|chemist", "pharmacy"], ["pet supplies|pet shop", "pet-supplies"], ["veterinary|vets?", "veterinary"],
    ["dentist|dental", "dental"], ["optician|optometry", "optometry"], ["clinic|medical|hospital|health", "clinic"],
    ["funeral", "funeral"], ["fuel|petrol|filling station", "fuel-station"], ["car wash", "car-wash"], ["repair|mechanic", "auto-repair"], ["tyres?|auto parts", "auto-parts"],
    ["barber", "barber"], ["hair|salon", "hair-salon"], ["nails?|beauty|cosmetics?", "beauty-salon"], ["spa|massage", "spa"],
    ["coffee|cafes?", "cafe"], ["bakery|baker", "bakery"], ["restaurants?|takeaways?|fast food|restaurant food", "restaurant-interior"], ["bar|nightlife|pub", "bar"],
    ["hostel", "hostel"], ["camp", "camping"], ["accommodation|hotel|lodge|guest house|stay", "hotel"],
    ["cinema", "cinema"], ["theatre|theater", "theatre"], ["museum|gallery", "museum"], ["event|ticketing", "event-venue"], ["gym|fitness", "fitness"], ["golf", "golf"], ["sports", "sports-field"],
    ["florist|flowers", "florist"], ["clothing|fashion|boutique", "fashion"], ["shoes|footwear", "footwear"], ["jewell?ery", "jewellery"],
    ["electronics|computer|phone|telecommunication", "electronics"], ["hardware|building supplies", "hardware"], ["furniture", "furniture"], ["homeware|home living|home & living|home and living", "homeware"], ["books|bookshop", "bookshop"], ["stationery", "stationery"], ["toy", "toys"],
    ["bank|financial", "banking"], ["school|education", "education"], ["printing|copy", "printing"], ["photo", "photography"], ["courier|parcel", "courier"], ["shopping centre|mall", "shopping-centre"], ["retail|shop|store", "general-retail"]
  ];
  for (const [pattern, family] of rules) if (contains(signals, pattern)) return foodFamily(record, family);
  return "professional-office";
}

export function businessPhotography(record = {}) {
  const family = businessPhotoFamily(record);
  const src = `${BASE}/${family}-768.webp`;
  return { src, largeSrc: `${BASE}/${family}-1536.webp`, srcSet: `${BASE}/${family}-320.webp 320w, ${src} 768w, ${BASE}/${family}-1536.webp 1536w`, family, subject: SUBJECTS[family], position: "50% 50%", kind: "editorial", label: "Illustrative photo", generated: true };
}

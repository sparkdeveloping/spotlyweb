import { marketplaceProfile } from "./marketplace-taxonomy.js";

const BASE = "/marketplace/editorial-pack";

const POOLS = {
  eat: [
    "01_Eat/bakery_cakes_03.jpg","01_Eat/barista_coffee_service_02.jpg","01_Eat/coffee_croissant_02.jpg","01_Eat/eat_chef_plating_meal.jpg","01_Eat/eat_friends_restaurant_dining.jpg","01_Eat/eat_takeaway_handoff.jpg","01_Eat/eat_zimbabwe_style_grilled_meal.jpg","01_Eat/family_restaurant_meal.jpg","01_Eat/food_bowl_02.jpg","01_Eat/food_burger_closeup_02.jpg","01_Eat/food_burger_fries.jpg","01_Eat/food_grilled_healthy_bowl.jpg","01_Eat/food_pizza_cheese_02.jpg","01_Eat/food_sushi_platter.jpg","01_Eat/friends_dining_02.jpg","01_Eat/friends_dining_city_03.jpg","01_Eat/restaurant_interior_warm.jpg"
  ],
  groceries: [
    "02_Shop_Groceries/groceries_fresh_bag.jpg","02_Shop_Groceries/grocery_bag_fresh_03.jpg","02_Shop_Groceries/grocery_supermarket_customer_03.jpg","02_Shop_Groceries/local_market_stall.jpg","02_Shop_Groceries/shopping_bags_customer.jpg","01_Eat/bakery_cakes_03.jpg","01_Eat/food_bowl_02.jpg"
  ],
  pharmacy: ["02_Shop_Groceries/pharmacy_customer_03.jpg","02_Shop_Groceries/pharmacy_retail_staff.jpg"],
  fashion: ["02_Shop_Groceries/fashion_boutique_customer_02.jpg","02_Shop_Groceries/fashion_customer_boutique.jpg","02_Shop_Groceries/fashion_store_interior.jpg","02_Shop_Groceries/shopping_bags_customer.jpg","02_Shop_Groceries/retail_sneakers_product.jpg"],
  electronics: ["02_Shop_Groceries/electronics_laptop_headphones.jpg","02_Shop_Groceries/mobile_shopping_phone_02.jpg"],
  home: ["02_Shop_Groceries/home_furniture_store.jpg","10_Home_Auto_Services/moving_furniture_02.jpg"],
  shop: [
    "02_Shop_Groceries/florist_customer_03.jpg","02_Shop_Groceries/fashion_store_interior.jpg","02_Shop_Groceries/local_market_stall.jpg","02_Shop_Groceries/mobile_shopping_phone_02.jpg","02_Shop_Groceries/retail_sneakers_product.jpg","02_Shop_Groceries/shopping_bags_customer.jpg","02_Shop_Groceries/home_furniture_store.jpg","02_Shop_Groceries/electronics_laptop_headphones.jpg"
  ],
  beauty: [
    "03_Book_Beauty_Wellness/barber_client_portrait_02.jpg","03_Book_Beauty_Wellness/barber_fade_02.jpg","03_Book_Beauty_Wellness/facial_spa_02.jpg","03_Book_Beauty_Wellness/hair_braiding_02.jpg","03_Book_Beauty_Wellness/health_consultation_03.jpg","03_Book_Beauty_Wellness/manicure_02.jpg","03_Book_Beauty_Wellness/massage_02.jpg","03_Book_Beauty_Wellness/salon_hair_styling.jpg","03_Book_Beauty_Wellness/veterinary_service_03.jpg","03_Book_Beauty_Wellness/wellness_massage_session.jpg"
  ],
  services: [
    "10_Home_Auto_Services/auto_carwash_02.jpg","10_Home_Auto_Services/auto_carwash_service.jpg","10_Home_Auto_Services/auto_mechanic_02.jpg","10_Home_Auto_Services/home_service_cleaner.jpg","10_Home_Auto_Services/home_service_cleaning_02.jpg","10_Home_Auto_Services/home_service_electrician.jpg","10_Home_Auto_Services/home_service_gardener.jpg","10_Home_Auto_Services/home_service_gardening_02.jpg","10_Home_Auto_Services/home_service_hvac_02.jpg","10_Home_Auto_Services/home_service_plumber_02.jpg","10_Home_Auto_Services/moving_furniture_02.jpg"
  ],
  events: [
    "04_Events_Activities/activity_gym_workout.jpg","04_Events_Activities/activity_hiking_scenic.jpg","04_Events_Activities/birthday_party_03.jpg","04_Events_Activities/concert_crowd_03.jpg","04_Events_Activities/conference_speaker_03.jpg","04_Events_Activities/event_live_concert.jpg","04_Events_Activities/event_stage_concert.jpg","04_Events_Activities/fitness_weights_woman_02.jpg","04_Events_Activities/scenic_hike_couple_02.jpg","04_Events_Activities/wedding_event_03.jpg","04_Events_Activities/yoga_meditation_02.jpg"
  ],
  stay: ["07_Stay_Travel/hotel_room_02.jpg","07_Stay_Travel/resort_pool_02.jpg","07_Stay_Travel/stay_hotel_room.jpg","07_Stay_Travel/stay_resort_pool.jpg"],
  default: [
    "08_City_Lifestyle/city_skyline_sunset.jpg","08_City_Lifestyle/couple_using_phone.jpg","08_City_Lifestyle/customer_man_phone.jpg","08_City_Lifestyle/customer_woman_phone.jpg","08_City_Lifestyle/lifestyle_woman_using_phone.jpg","08_City_Lifestyle/zimbabwe_granite_landscape.jpg","09_Business_Merchants/local_shop_owner_03.jpg","09_Business_Merchants/merchant_cafe_pos_counter.jpg"
  ]
};

function stableHash(value = "") {
  let hash = 2166136261;
  const input = String(value || "spotly");
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function recordKey(record = {}) {
  return [record.id, record.name, record.brandName, record.city, record.area, record.category].filter(Boolean).join("|") || "spotly";
}

function poolFor(record = {}) {
  const family = marketplaceProfile(record).mediaFamily;
  if (["eat", "cafe", "bakery", "nightlife"].includes(family)) return POOLS.eat || [];
  if (["groceries", "convenience", "produce", "butcher", "beverages"].includes(family)) return POOLS.groceries || [];
  if (family === "pharmacy") return POOLS.pharmacy || [];
  if (["fashion", "footwear", "jewellery"].includes(family)) return POOLS.fashion || [];
  if (family === "electronics") return POOLS.electronics || [];
  if (["home", "homeware", "furniture", "appliances"].includes(family)) return POOLS.home || [];
  if (["beauty", "hair", "barber", "nails", "spa", "fitness", "medical", "dental", "optometry", "veterinary"].includes(family)) return POOLS.beauty || [];
  if (["events", "music", "festival", "conference", "sports_event", "activities", "museum", "cinema", "theatre"].includes(family)) return POOLS.events || [];
  if (family === "stay") return POOLS.stay || [];
  if (family === "florist") return ["02_Shop_Groceries/florist_customer_03.jpg"];
  // Specific retail types without a semantically safe editorial image intentionally
  // fall back to designed category artwork instead of receiving an unrelated photo.
  return [];
}

// Only these editorial assets ship with the deployed repository. Never return a
// path into the unshipped editorial-pack; a 404 is not an image fallback.
const SHIPPED_EDITORIAL = Object.freeze({
  eat: "/marketplace/editorial/eat.webp",
  groceries: "/marketplace/editorial/groceries.webp",
  shop: "/marketplace/editorial/shop.webp"
});

function merchantImage(record = {}) {
  // Research entries do not have permission to publish third-party brand imagery.
  if (record.source?.type === "spotly_assist_research" && record.source?.rightsStatus !== "licensed" && record.source?.rightsStatus !== "merchant_owned") return "";
  const owned = record.coverImage || record.image || record.imageUrl || record.photoUrl || record.media?.cover || record.media?.hero || "";
  if (owned) return owned;
  // Do not lift logos from independent directory data as merchant-approved media.
  if (record.commerceVerified === true && record.source?.type !== "openstreetmap") return record.logoUrl || record.logo || "";
  return "";
}

function editorialFor(record = {}) {
  const family = marketplaceProfile(record).mediaFamily;
  if (["eat", "cafe", "bakery", "nightlife"].includes(family)) return SHIPPED_EDITORIAL.eat;
  if (["groceries", "convenience", "produce", "butcher", "beverages"].includes(family)) return SHIPPED_EDITORIAL.groceries;
  if (["shop", "fashion", "footwear", "home", "homeware", "furniture"].includes(family)) return SHIPPED_EDITORIAL.shop;
  // No semantically safe editorial image is shipped for this precise business
  // type. A designed card is better than a photograph of an unrelated shop.
  return "";
}

export function marketplaceMedia(record = {}) {
  const owned = merchantImage(record);
  if (owned) return { src: owned, kind: "merchant", label: "", generated: false };
  const src = editorialFor(record);
  if (!src) return { src: "", kind: "designed", label: "", generated: false };
  return { src, kind: "editorial", label: "Category image", generated: true };
}

export function marketplaceMediaSet(records = []) {
  const used = new Set();
  const result = new Map();
  for (const record of records) {
    const key = record?.id || recordKey(record);
    const media = marketplaceMedia(record);
    // A rail should not repeat the same photo six times; use designed cards
    // after its limited, properly attributed visual set is exhausted.
    if (media.kind === "editorial" && used.has(media.src)) result.set(key, { src: "", kind: "designed", label: "", generated: false });
    else { result.set(key, media); if (media.src) used.add(media.src); }
  }
  return result;
}

export function marketplaceEditorialImage(record = {}) {
  return marketplaceMedia(record).src;
}

export function shouldUseEditorialImage(record = {}) {
  return marketplaceMedia(record).kind === "editorial";
}

export function marketplaceEditorialPoolSize(record = {}) {
  return poolFor(record).length;
}

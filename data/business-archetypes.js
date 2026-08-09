import {
  BadgeDollarSign,
  BarChart3,
  CalendarDays,
  CheckSquare2,
  ClipboardList,
  Coffee,
  LayoutDashboard,
  LayoutGrid,
  LifeBuoy,
  MapPin,
  PackageSearch,
  ScanLine,
  Settings,
  ShoppingBasket,
  Store,
  Ticket,
  UsersRound,
  UtensilsCrossed,
  WalletCards
} from "lucide-react";

export const BUSINESS_ARCHETYPES = {
  grocery_retail: {
    id: "grocery_retail",
    label: "Shop or grocery store",
    shortLabel: "Retail",
    description: "Sell physical products for pickup, with branch stock and substitutions.",
    icon: ShoppingBasket,
    categoryHints: ["Groceries", "Retail", "Pharmacy", "Fashion", "Home & Living", "Hardware", "Agriculture"],
    capabilities: ["catalog", "inventory", "pickup_orders", "promotions", "kiosk_pickup"],
    nouns: { item: "product", items: "products", activity: "orders", catalog: "Products", branch: "location" },
    setup: ["identity", "operation", "location", "offering", "starter", "review"]
  },
  restaurant_food: {
    id: "restaurant_food",
    label: "Restaurant, café, or food business",
    shortLabel: "Food",
    description: "Publish a menu, manage availability, and prepare food pickup orders.",
    icon: UtensilsCrossed,
    categoryHints: ["Restaurants"],
    capabilities: ["menu", "pickup_orders", "preparation", "promotions", "kiosk_ordering"],
    nouns: { item: "menu item", items: "menu items", activity: "orders", catalog: "Menu", branch: "location" },
    setup: ["identity", "operation", "location", "offering", "starter", "review"]
  },
  ticketing_events: {
    id: "ticketing_events",
    label: "Events and ticketing",
    shortLabel: "Ticketing",
    description: "Create events, sell ticket types, and check guests in at the door.",
    icon: Ticket,
    categoryHints: ["Events", "Activities"],
    capabilities: ["events", "tickets", "attendees", "kiosk_checkin", "promotions"],
    nouns: { item: "event", items: "events", activity: "ticket sales", catalog: "Events & tickets", branch: "venue" },
    setup: ["identity", "operation", "location", "offering", "starter", "review"]
  },
  appointments_services: {
    id: "appointments_services",
    label: "Appointments and services",
    shortLabel: "Services",
    description: "List services, availability, staff, and customer appointments.",
    icon: CalendarDays,
    categoryHints: ["Beauty", "Wellness", "Health", "Professional Services", "Education"],
    capabilities: ["services", "appointments", "staff_schedules", "promotions", "kiosk_checkin"],
    nouns: { item: "service", items: "services", activity: "appointments", catalog: "Services", branch: "location" },
    setup: ["identity", "operation", "location", "offering", "starter", "review"]
  },
  accommodation_activities: {
    id: "accommodation_activities",
    label: "Accommodation or activities",
    shortLabel: "Bookings",
    description: "Publish bookable stays, experiences, time slots, and capacity.",
    icon: MapPin,
    categoryHints: ["Accommodation", "Activities"],
    capabilities: ["listings", "bookings", "capacity", "promotions", "kiosk_checkin"],
    nouns: { item: "listing", items: "listings", activity: "bookings", catalog: "Listings", branch: "property" },
    setup: ["identity", "operation", "location", "offering", "starter", "review"]
  },
  directory_profile: {
    id: "directory_profile",
    label: "Business profile only",
    shortLabel: "Profile",
    description: "Start with a complete public profile and add commerce later.",
    icon: Store,
    categoryHints: ["Other"],
    capabilities: ["profile", "enquiries"],
    nouns: { item: "offering", items: "offerings", activity: "enquiries", catalog: "Offerings", branch: "location" },
    setup: ["identity", "operation", "location", "offering", "review"]
  }
};

export const SETUP_STEPS = [
  { id: "identity", label: "Confirm the business", short: "Business", description: "Separate the brand from its locations and confirm what this business does.", icon: Store },
  { id: "operation", label: "Choose how it operates", short: "Model", description: "Tell Spotly whether customers visit a location, book online, or collect an order.", icon: LayoutGrid },
  { id: "location", label: "Set the first location", short: "Location", description: "Confirm the exact branch or venue customers and staff will use.", icon: MapPin },
  { id: "offering", label: "Choose what customers do", short: "Experience", description: "Turn on only the workflows that make sense for this business.", icon: CheckSquare2 },
  { id: "starter", label: "Start with useful content", short: "Starter", description: "Load a relevant starter structure instead of beginning from an empty screen.", icon: PackageSearch },
  { id: "review", label: "Review and open the workspace", short: "Review", description: "Check the essentials, then continue with a workspace shaped around the business.", icon: ClipboardList }
];

export const BUSINESS_OPERATING_MODELS = [
  { id: "physical_single", label: "One physical location", description: "A single shop, office, restaurant, venue, or property." },
  { id: "physical_multi", label: "Several physical locations", description: "One brand with multiple branches, venues, or properties." },
  { id: "online_only", label: "Online only", description: "No public customer location is required." },
  { id: "mobile_service", label: "Mobile or at-customer service", description: "The business travels to customers or serves changing locations." }
];

export const KIOSK_MODES = [
  { id: "pickup_checkin", label: "Pickup check-in", description: "Customers enter an order number and tell the team they have arrived.", icon: ShoppingBasket },
  { id: "self_order", label: "Self-ordering", description: "Customers browse available products or menu items and create an in-store order.", icon: Coffee },
  { id: "ticket_checkin", label: "Ticket check-in", description: "Staff scan or enter a ticket code and record admission.", icon: ScanLine },
  { id: "appointment_checkin", label: "Appointment check-in", description: "Customers confirm arrival for an appointment, stay, or activity.", icon: CalendarDays }
];

export function inferBusinessType(business = {}) {
  if (business.businessType && BUSINESS_ARCHETYPES[business.businessType]) return business.businessType;
  const category = String(business.category || business.categories?.[0] || "").toLowerCase();
  if (["groceries", "retail", "pharmacy", "fashion", "home & living", "hardware", "agriculture"].some((item) => category.includes(item))) return "grocery_retail";
  if (category.includes("restaurant") || category.includes("food")) return "restaurant_food";
  if (category.includes("event")) return "ticketing_events";
  if (["beauty", "wellness", "health", "professional", "education"].some((item) => category.includes(item))) return "appointments_services";
  if (["accommodation", "activities"].some((item) => category.includes(item))) return "accommodation_activities";
  return "directory_profile";
}

export function businessArchetype(business = {}) {
  return BUSINESS_ARCHETYPES[inferBusinessType(business)];
}

export function capabilitiesFor(type) {
  return BUSINESS_ARCHETYPES[type]?.capabilities || BUSINESS_ARCHETYPES.directory_profile.capabilities;
}


export function businessNavigation(business = {}, setupComplete = false, branchCount = 0, businessId = "") {
  const archetype = businessArchetype(business);
  const capabilities = new Set(business.capabilities?.length ? business.capabilities : archetype.capabilities);
  const withBusiness = (href) => businessId ? `${href}${href.includes("?") ? "&" : "?"}business=${encodeURIComponent(businessId)}` : href;
  const items = [
    { id: "portfolio", label: "Business portfolio", icon: LayoutGrid, href: "/business", group: "Account" },
    { id: "setup", label: setupComplete ? "Setup centre" : "Continue setup", icon: CheckSquare2, href: withBusiness("/business/setup"), emphasis: !setupComplete, group: "Business" },
    { id: "today", label: "Today", icon: LayoutDashboard, href: withBusiness("/business/today"), group: "Business" }
  ];

  if (!setupComplete) {
    items.push({ id: "support", label: "Help & support", icon: LifeBuoy, href: withBusiness("/business/support"), group: "Business" });
    items.push({ id: "settings", label: "Business settings", icon: Settings, href: withBusiness("/business/settings"), group: "Business" });
    return items;
  }

  if (["pickup_orders", "appointments", "bookings", "tickets", "enquiries"].some((id) => capabilities.has(id))) {
    items.push({ id: "activity", label: archetype.nouns.activity[0].toUpperCase() + archetype.nouns.activity.slice(1), icon: ClipboardList, href: withBusiness("/business/activity"), group: "Operations" });
  }
  if (["catalog", "menu", "events", "services", "listings", "profile"].some((id) => capabilities.has(id))) {
    items.push({ id: "catalog", label: archetype.nouns.catalog, icon: PackageSearch, href: withBusiness("/business/catalog"), group: "Operations" });
  }
  if (branchCount > 1 || business.operatingModel === "physical_multi") {
    items.push({ id: "branches", label: archetype.nouns.branch === "venue" ? "Venues" : archetype.nouns.branch === "property" ? "Properties" : "Locations", icon: MapPin, href: withBusiness("/business/branches"), group: "Operations" });
  }
  if (["kiosk_pickup", "kiosk_ordering", "kiosk_checkin"].some((id) => capabilities.has(id))) {
    items.push({ id: "kiosk", label: "Kiosk", icon: ScanLine, href: withBusiness("/business/kiosk"), group: "Operations" });
  }
  items.push({ id: "insights", label: "Insights", icon: BarChart3, href: withBusiness("/business/insights"), group: "Grow" });
  if (capabilities.has("promotions")) items.push({ id: "promotions", label: "Promotions", icon: BadgeDollarSign, href: withBusiness("/business/promotions"), group: "Grow" });
  items.push({ id: "staff", label: "Team", icon: UsersRound, href: withBusiness("/business/staff"), group: "Business" });
  if (["pickup_orders", "orders", "tickets", "appointments", "bookings", "reservations"].some((id) => capabilities.has(id))) {
    items.push({ id: "finance", label: "Money", icon: WalletCards, href: withBusiness("/business/finance"), group: "Business" });
  }
  items.push({ id: "support", label: "Help & support", icon: LifeBuoy, href: withBusiness("/business/support"), group: "Business" });
  items.push({ id: "settings", label: "Business settings", icon: Settings, href: withBusiness("/business/settings"), group: "Business" });
  return items;
}

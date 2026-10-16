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
  Truck,
  UsersRound,
  UtensilsCrossed,
  WalletCards
} from "lucide-react";

import { businessHref } from "@/lib/business-routing";

export const BUSINESS_ARCHETYPES = {
  grocery_retail: {
    id: "grocery_retail",
    label: "Shop or grocery store",
    shortLabel: "Retail",
    description: "Sell physical products, keep availability accurate, and fulfil pickup or delivery orders.",
    icon: ShoppingBasket,
    categoryHints: ["Groceries", "Retail", "Pharmacy", "Fashion", "Home & Living", "Hardware", "Agriculture"],
    capabilities: ["catalog", "inventory", "pickup_orders", "promotions", "kiosk_pickup"],
    nouns: { item: "product", items: "products", activity: "orders", activityNav: "Orders", catalog: "Products", branch: "location" },
    setup: ["identity", "operation", "location", "offering", "starter", "review"]
  },
  restaurant_food: {
    id: "restaurant_food",
    label: "Restaurant, café, or food business",
    shortLabel: "Food",
    description: "Publish a menu, manage availability, and prepare pickup or delivery orders.",
    icon: UtensilsCrossed,
    categoryHints: ["Restaurants"],
    capabilities: ["menu", "pickup_orders", "preparation", "promotions", "kiosk_ordering"],
    nouns: { item: "menu item", items: "menu items", activity: "orders", activityNav: "Orders", catalog: "Menu", branch: "location" },
    setup: ["identity", "operation", "location", "offering", "starter", "review"]
  },
  ticketing_events: {
    id: "ticketing_events",
    label: "Events and ticketing",
    shortLabel: "Ticketing",
    description: "Create events, sell ticket types, follow attendance, and check guests in.",
    icon: Ticket,
    categoryHints: ["Events", "Activities"],
    capabilities: ["events", "tickets", "attendees", "kiosk_checkin", "promotions"],
    nouns: { item: "event", items: "events", activity: "ticket sales", activityNav: "Tickets & attendees", catalog: "Events", branch: "venue" },
    setup: ["identity", "operation", "location", "offering", "starter", "review"]
  },
  appointments_services: {
    id: "appointments_services",
    label: "Appointments and services",
    shortLabel: "Services",
    description: "Publish services, availability, staff, and customer appointments.",
    icon: CalendarDays,
    categoryHints: ["Beauty", "Wellness", "Health", "Professional Services", "Education"],
    capabilities: ["services", "appointments", "staff_schedules", "promotions", "kiosk_checkin"],
    nouns: { item: "service", items: "services", activity: "appointments", activityNav: "Calendar", catalog: "Services", branch: "location" },
    setup: ["identity", "operation", "location", "offering", "starter", "review"]
  },
  accommodation_activities: {
    id: "accommodation_activities",
    label: "Accommodation or activities",
    shortLabel: "Bookings",
    description: "Publish bookable stays, experiences, time slots, capacity, and availability.",
    icon: MapPin,
    categoryHints: ["Accommodation", "Activities"],
    capabilities: ["listings", "bookings", "capacity", "promotions", "kiosk_checkin"],
    nouns: { item: "listing", items: "listings", activity: "bookings", activityNav: "Reservations", catalog: "Listings", branch: "property" },
    setup: ["identity", "operation", "location", "offering", "starter", "review"]
  },
  directory_profile: {
    id: "directory_profile",
    label: "Business profile and enquiries",
    shortLabel: "Profile",
    description: "Keep a complete public profile, receive enquiries, and add transactional tools only when they fit.",
    icon: Store,
    categoryHints: ["Other"],
    capabilities: ["profile", "enquiries"],
    nouns: { item: "offering", items: "offerings", activity: "enquiries", activityNav: "Enquiries", catalog: "Profile & offerings", branch: "location" },
    setup: ["identity", "operation", "location", "offering", "review"]
  }
};

export const SETUP_STEPS = [
  { id: "identity", label: "Confirm the business", short: "Business", description: "Confirm the brand, category, and what customers should recognize.", icon: Store },
  { id: "operation", label: "Choose how it operates", short: "Model", description: "Tell Spotly whether customers visit, book online, collect an order, or receive a mobile service.", icon: LayoutGrid },
  { id: "location", label: "Set the first location", short: "Location", description: "Confirm the exact branch, venue, property, or service base your team will operate.", icon: MapPin },
  { id: "offering", label: "Choose what customers can do", short: "Experience", description: "Turn on only the customer actions that make sense for this business.", icon: CheckSquare2 },
  { id: "starter", label: "Add useful starter content", short: "Starter", description: "Begin with a relevant product, menu, service, event, or listing structure instead of an empty screen.", icon: PackageSearch },
  { id: "review", label: "Review your workspace", short: "Review", description: "Check the essentials, then continue into a workspace shaped around the business.", icon: ClipboardList }
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

function offeringAvailable(capabilities) {
  return ["catalog", "menu", "events", "services", "listings", "profile"].some((id) => capabilities.has(id));
}

function moneyAvailable(capabilities) {
  return ["pickup_orders", "orders", "tickets", "appointments", "bookings", "reservations"].some((id) => capabilities.has(id));
}

function locationLabel(archetype) {
  if (archetype.nouns.branch === "venue") return "Venues";
  if (archetype.nouns.branch === "property") return "Properties";
  return "Locations";
}

export function businessNavigation(business = {}, lifecycle = {}, _branchCount = 0, businessId = "") {
  const archetype = businessArchetype(business);
  const capabilities = new Set(business.capabilities?.length ? business.capabilities : archetype.capabilities);
  const href = (path, params = {}) => businessHref(path, { businessId, ...params });
  const mode = lifecycle?.navigationMode || "basics";
  const items = [];

  if (mode === "access") {
    items.push({ id: "launch", label: "Verification status", icon: CheckSquare2, href: href("/business/launch"), emphasis: true, group: "Get started" });
    items.push({ id: "support", label: "Get help", icon: LifeBuoy, href: href("/business/support"), group: "Help" });
    return items;
  }

  if (mode === "suspended") {
    items.push({ id: "launch", label: "Business status", icon: CheckSquare2, href: href("/business/launch"), emphasis: true, group: "Business" });
    items.push({ id: "settings", label: "Settings", icon: Settings, href: href("/business/settings"), group: "Manage" });
    items.push({ id: "support", label: "Get help", icon: LifeBuoy, href: href("/business/support"), group: "Manage" });
    return items;
  }

  if (mode === "basics") {
    items.push({ id: "launch", label: "Get live", icon: CheckSquare2, href: href("/business/launch"), emphasis: true, group: "Get started" });
    items.push({ id: "setup", label: "Business setup", icon: Store, href: href("/business/setup", lifecycle?.setup?.firstIncompleteId ? { step: lifecycle.setup.firstIncompleteId } : {}), group: "Get started" });
    items.push({ id: "support", label: "Get help", icon: LifeBuoy, href: href("/business/support"), group: "Help" });
    return items;
  }

  if (mode === "prelaunch") {
    items.push({ id: "launch", label: lifecycle?.stage === "review" ? "Launch review" : "Get live", icon: CheckSquare2, href: href("/business/launch"), emphasis: true, group: "Launch" });
    items.push({ id: "setup", label: "Business setup", icon: Store, href: href("/business/setup", { step: "identity" }), group: "Launch" });
    if (offeringAvailable(capabilities)) items.push({ id: "catalog", label: archetype.nouns.catalog, icon: PackageSearch, href: href("/business/catalog"), group: "Prepare" });
    items.push({ id: "branches", label: locationLabel(archetype), icon: MapPin, href: href("/business/branches"), group: "Prepare" });
    items.push({ id: "staff", label: "Team", icon: UsersRound, href: href("/business/staff"), group: "Prepare" });
    if (moneyAvailable(capabilities)) items.push({ id: "finance", label: "Money", icon: WalletCards, href: href("/business/finance"), group: "Prepare" });
    items.push({ id: "support", label: "Get help", icon: LifeBuoy, href: href("/business/support"), group: "Help" });
    return items;
  }

  items.push({ id: "today", label: "Today", icon: LayoutDashboard, href: href("/business/today"), group: "Home" });
  if (["pickup_orders", "appointments", "bookings", "tickets", "enquiries"].some((id) => capabilities.has(id))) {
    items.push({ id: "activity", label: archetype.nouns.activityNav || archetype.nouns.activity, icon: archetype.id === "appointments_services" ? CalendarDays : archetype.id === "ticketing_events" ? Ticket : ClipboardList, href: href("/business/activity"), group: "Operate" });
  }
  if (offeringAvailable(capabilities)) items.push({ id: "catalog", label: archetype.nouns.catalog, icon: PackageSearch, href: href("/business/catalog"), group: "Operate" });
  if (["pickup_orders", "orders"].some((id) => capabilities.has(id))) items.push({ id: "delivery", label: "Fulfilment & delivery", icon: Truck, href: href("/business/delivery"), group: "Operate" });

  items.push({ id: "branches", label: locationLabel(archetype), icon: MapPin, href: href("/business/branches"), group: "Business" });
  items.push({ id: "staff", label: "Team", icon: UsersRound, href: href("/business/staff"), group: "Business" });

  if (capabilities.has("promotions")) items.push({ id: "promotions", label: "Promotions", icon: BadgeDollarSign, href: href("/business/promotions"), group: "Grow" });
  items.push({ id: "insights", label: "Insights", icon: BarChart3, href: href("/business/insights"), group: "Grow" });

  if (moneyAvailable(capabilities)) items.push({ id: "finance", label: "Money", icon: WalletCards, href: href("/business/finance"), group: "Money" });

  if (["kiosk_pickup", "kiosk_ordering", "kiosk_checkin"].some((id) => capabilities.has(id))) items.push({ id: "kiosk", label: "Counter & check-in", icon: ScanLine, href: href("/business/kiosk"), group: "Manage" });
  items.push({ id: "settings", label: "Settings", icon: Settings, href: href("/business/settings"), group: "Manage" });
  items.push({ id: "support", label: "Help & support", icon: LifeBuoy, href: href("/business/support"), group: "Manage" });
  return items;
}

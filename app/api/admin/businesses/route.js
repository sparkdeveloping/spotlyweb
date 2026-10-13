import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().trim().min(2).max(140),
  brandName: z.string().trim().max(140).optional().default(""),
  branchName: z.string().trim().min(2).max(120).optional().default("Main location"),
  businessType: z.enum(["grocery_retail", "restaurant_food", "ticketing_events", "appointments_services", "accommodation_activities", "directory_profile"]).optional(),
  operatingModel: z.enum(["physical_single", "physical_multi", "online_only", "mobile_service"]).default("physical_single"),
  capabilities: z.array(z.string().max(80)).max(30).optional(),
  legalName: z.string().trim().max(180).optional().default(""),
  category: z.string().trim().min(2).max(100).default("Groceries"),
  city: z.string().trim().min(2).max(100).default("Harare"),
  description: z.string().trim().max(1600).optional().default(""),
  phone: z.string().trim().max(60).optional().default(""),
  email: z.union([z.literal(""), z.string().email()]).optional().default(""),
  website: z.string().trim().max(500).optional().default(""),
  address: z.string().trim().max(500).optional().default(""),
  status: z.enum(["provisional", "draft"]).default("provisional"),
  public: z.boolean().default(true)
});

const TYPE_CAPABILITIES = {
  grocery_retail: ["catalog", "inventory", "pickup_orders", "promotions", "kiosk_pickup"],
  restaurant_food: ["menu", "pickup_orders", "preparation", "promotions", "kiosk_ordering"],
  ticketing_events: ["events", "tickets", "attendees", "kiosk_checkin", "promotions"],
  appointments_services: ["services", "appointments", "staff_schedules", "promotions", "kiosk_checkin"],
  accommodation_activities: ["listings", "bookings", "capacity", "promotions", "kiosk_checkin"],
  directory_profile: ["profile", "enquiries"]
};

function businessTypeFor(input) {
  if (input.businessType && TYPE_CAPABILITIES[input.businessType]) return input.businessType;
  const category = input.category.toLowerCase();
  if (["groceries", "retail", "pharmacy", "fashion", "home & living", "hardware", "agriculture"].some((item) => category.includes(item))) return "grocery_retail";
  if (category.includes("restaurant") || category.includes("food")) return "restaurant_food";
  if (category.includes("event")) return "ticketing_events";
  if (["beauty", "wellness", "health", "professional", "education"].some((item) => category.includes(item))) return "appointments_services";
  if (["accommodation", "activities"].some((item) => category.includes(item))) return "accommodation_activities";
  return "directory_profile";
}

function supportsPickup(capabilities) { return capabilities.includes("pickup_orders"); }

function terms(...values) {
  const words = values.filter(Boolean).join(" ").toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter(Boolean);
  const result = new Set();
  words.forEach((word) => {
    result.add(word);
    for (let length = 2; length <= Math.min(18, word.length); length += 1) result.add(word.slice(0, length));
  });
  return [...result].slice(0, 160);
}

function openingHours() {
  return {
    monday: { open: "08:00", close: "17:00", closed: false },
    tuesday: { open: "08:00", close: "17:00", closed: false },
    wednesday: { open: "08:00", close: "17:00", closed: false },
    thursday: { open: "08:00", close: "17:00", closed: false },
    friday: { open: "08:00", close: "17:00", closed: false },
    saturday: { open: "08:00", close: "14:00", closed: false },
    sunday: { open: "", close: "", closed: true }
  };
}

export async function POST(request) {
  try {
    const actor = await authenticateRequest(request, { roles: ["super_admin", "platform_admin", "operations_manager", "data_import_manager"] });
    const input = createSchema.parse(await request.json());
    const { db } = getAdminServices();
    const organizationRef = db.collection("organizations").doc();
    const businessRef = db.collection("businesses").doc();
    const branchRef = db.collection("branches").doc();
    const brandName = input.brandName || input.name;
    const businessType = businessTypeFor(input);
    const capabilities = input.capabilities?.length ? input.capabilities : TYPE_CAPABILITIES[businessType];
    const pickupEnabled = supportsPickup(capabilities);
    const branchName = input.branchName || "Main location";
    const now = FieldValue.serverTimestamp();
    const batch = db.batch();

    batch.set(organizationRef, {
      name: brandName,
      legalName: input.legalName || "",
      businessIds: [businessRef.id],
      branchIds: [branchRef.id],
      ownerIds: [],
      country: "ZW",
      status: input.status,
      source: { type: "admin_created", imported: false },
      searchTerms: terms(brandName, input.legalName),
      createdAt: now,
      updatedAt: now,
      createdBy: actor.uid,
      updatedBy: actor.uid
    });

    batch.set(businessRef, {
      organizationId: organizationRef.id,
      branchIds: [branchRef.id],
      branchCount: 1,
      ownerIds: [],
      name: input.name,
      brandName,
      legalName: input.legalName || "",
      businessType,
      capabilities,
      operatingModel: input.operatingModel,
      onboardingStatus: "not_started",
      category: input.category,
      categories: [input.category],
      city: input.city,
      country: "ZW",
      description: input.description || `${input.name} is listed provisionally for discovery and business claiming. Details must be confirmed before full publication.`,
      phone: input.phone,
      email: input.email,
      website: input.website,
      address: input.address,
      currency: "USD",
      acceptedCurrencies: ["USD", "ZWG"],
      fulfilment: pickupEnabled ? ["pickup"] : [],
      public: input.public,
      claimStatus: "unclaimed",
      verificationStatus: "unverified",
      status: input.status,
      source: { type: "admin_created", imported: false, createdBy: actor.uid },
      aliases: [input.name, brandName, input.city],
      searchTerms: terms(input.name, brandName, input.category, input.city, input.phone),
      onboardingProgress: 0,
      createdAt: now,
      updatedAt: now,
      createdBy: actor.uid,
      updatedBy: actor.uid
    });

    batch.set(branchRef, {
      organizationId: organizationRef.id,
      businessId: businessRef.id,
      name: branchName,
      branchName,
      displayName: `${input.name} — ${branchName}`,
      city: input.city,
      country: "ZW",
      address: input.address,
      phone: input.phone,
      email: input.email,
      public: input.public,
      status: input.status,
      fulfilment: pickupEnabled ? ["pickup"] : [],
      openingHours: openingHours(),
      pickup: { enabled: pickupEnabled, slotMinutes: 30, slotCapacity: 12, preparationMinutes: 45 },
      acceptedCurrencies: ["USD", "ZWG"],
      paymentMethods: ["cash", "paynow", "ecocash", "onemoney", "card", "bank_transfer"],
      searchTerms: terms(input.name, brandName, branchName, input.city, input.address),
      source: { type: "admin_created", imported: false },
      createdAt: now,
      updatedAt: now,
      createdBy: actor.uid,
      updatedBy: actor.uid
    });

    batch.set(db.collection("auditLogs").doc(), {
      action: "admin.business_created",
      entityType: "business",
      entityId: businessRef.id,
      actorId: actor.uid,
      actorEmail: actor.email || "",
      metadata: { organizationId: organizationRef.id, branchId: branchRef.id, name: input.name, branchName, city: input.city, businessType },
      createdAt: now
    });

    await batch.commit();
    return Response.json({ ok: true, businessId: businessRef.id, organizationId: organizationRef.id, branchId: branchRef.id });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the business details and try again.", details: error.flatten() }, { status: 400 });
    return apiError(error);
  }
}

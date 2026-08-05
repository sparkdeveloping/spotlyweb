import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().trim().min(2).max(140),
  brandName: z.string().trim().max(140).optional().default(""),
  legalName: z.string().trim().max(180).optional().default(""),
  category: z.string().trim().min(2).max(100).default("Groceries"),
  city: z.string().trim().min(2).max(100).default("Harare"),
  description: z.string().trim().max(1600).optional().default(""),
  phone: z.string().trim().max(60).optional().default(""),
  email: z.union([z.literal(""), z.string().email()]).optional().default(""),
  website: z.string().trim().max(500).optional().default(""),
  address: z.string().trim().max(500).optional().default(""),
  claimStatus: z.enum(["unclaimed", "claim_pending", "claimed", "claim_needs_information"]).default("unclaimed"),
  verificationStatus: z.enum(["unverified", "pending", "approved", "rejected"]).default("unverified"),
  status: z.enum(["provisional", "draft", "pending_publication_review", "active", "paused", "removed"]).default("provisional"),
  public: z.boolean().default(true)
});

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
    const now = FieldValue.serverTimestamp();
    const batch = db.batch();

    batch.set(organizationRef, {
      name: brandName,
      legalName: input.legalName || "",
      businessIds: [businessRef.id],
      branchIds: [branchRef.id],
      ownerIds: [],
      country: "ZW",
      status: input.status === "active" ? "active" : "provisional",
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
      ownerIds: [],
      name: input.name,
      brandName,
      legalName: input.legalName || "",
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
      fulfilment: input.category === "Groceries" || input.category === "Restaurants" ? ["pickup"] : [],
      public: input.public,
      claimStatus: input.claimStatus,
      verificationStatus: input.verificationStatus,
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
      name: `${input.name} — ${input.city}`,
      city: input.city,
      country: "ZW",
      address: input.address,
      phone: input.phone,
      email: input.email,
      public: input.public,
      status: input.status === "active" ? "active" : "provisional",
      fulfilment: input.category === "Groceries" || input.category === "Restaurants" ? ["pickup"] : [],
      openingHours: openingHours(),
      pickup: { enabled: input.category === "Groceries" || input.category === "Restaurants", slotMinutes: 30, slotCapacity: 12, preparationMinutes: 45 },
      acceptedCurrencies: ["USD", "ZWG"],
      paymentMethods: ["cash", "paynow", "ecocash", "onemoney", "card", "bank_transfer"],
      searchTerms: terms(input.name, brandName, input.city, input.address),
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
      metadata: { organizationId: organizationRef.id, branchId: branchRef.id, name: input.name, city: input.city },
      createdAt: now
    });

    await batch.commit();
    return Response.json({ ok: true, businessId: businessRef.id, organizationId: organizationRef.id, branchId: branchRef.id });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the business details and try again.", details: error.flatten() }, { status: 400 });
    return apiError(error);
  }
}

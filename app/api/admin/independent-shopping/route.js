import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { independentPublicStore } from "@/lib/independent-shopping";

export const runtime = "nodejs";
const adminRoles = ["super_admin", "platform_admin", "operations_manager", "data_import_manager"];
const itemSchema = z.object({
  id: z.string().trim().regex(/^[a-zA-Z0-9_-]{2,80}$/),
  name: z.string().trim().min(2).max(150),
  category: z.string().trim().max(80).default(""),
  unit: z.string().trim().max(60).default(""),
  priceEstimate: z.number().finite().min(0).max(100000),
  priceCheckedAt: z.string().datetime({ offset: true }),
  status: z.enum(["available", "unavailable"])
}).strict();
const writeSchema = z.object({
  id: z.string().trim().regex(/^[a-zA-Z0-9_-]{3,100}$/).optional(),
  name: z.string().trim().min(2).max(160),
  country: z.enum(["ZW", "MW"]).default("ZW"),
  phone: z.string().trim().max(40).default(""),
  city: z.string().trim().min(2).max(100),
  area: z.string().trim().max(100).default(""),
  address: z.string().trim().min(6).max(350),
  category: z.string().trim().max(80).default("Restaurant"),
  directoryBusinessId: z.string().trim().max(150).default(""),
  status: z.enum(["draft", "published", "paused", "archived"]).default("draft"),
  priceCheckMethod: z.enum(["in_person", "phone", "business_authorized"]),
  items: z.array(itemSchema).max(120)
}).strict();

export async function GET(request) {
  try {
    await authenticateRequest(request, { roles: adminRoles });
    const { db } = getAdminServices();
    const all = await db.collection("independentShoppingStores").limit(100).get();
    const stores = all.docs.map((doc) => ({
      id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || null,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || null
    }));
    return Response.json({ ok: true, stores }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request) {
  try {
    const actor = await authenticateRequest(request, { roles: adminRoles });
    const input = writeSchema.parse(await request.json());
    const ids = input.items.map((item) => item.id);
    if (new Set(ids).size !== ids.length) throw Object.assign(new Error("Menu item IDs must be unique."), { status: 422 });
    if (input.status === "published") {
      const check = independentPublicStore(input.id || "preview", {
        ...input, affiliation: "unaffiliated", sourcingModel: "independent_in_person"
      });
      if (!check) throw Object.assign(new Error("A published independent listing needs at least one recently confirmed price (within 14 days)."), { status: 422 });
    }
    const { db } = getAdminServices();
    const ref = input.id ? db.collection("independentShoppingStores").doc(input.id) : db.collection("independentShoppingStores").doc();
    const old = await ref.get();
    if (old.exists && old.data()?.sourcingModel !== "independent_in_person") {
      throw Object.assign(new Error("This record is not an independent shopping listing."), { status: 409 });
    }
    let businessId = input.directoryBusinessId || old.data()?.directoryBusinessId || "";
    let businessRef = businessId ? db.collection("businesses").doc(businessId) : null;
    let businessSnap = businessRef ? await businessRef.get() : null;
    if (businessRef && !businessSnap.exists) throw Object.assign(new Error("The linked directory business does not exist. Choose a valid business or create a new listing."), { status: 422 });
    if (businessSnap && (businessSnap.data()?.commerceVerified === true || businessSnap.data()?.commerceEnabled === true)) throw Object.assign(new Error("Merchant-operated businesses must manage their own catalogue."), { status: 409 });
    if (!businessId) {
      const sameName = await db.collection("businesses").where("name", "==", input.name).limit(25).get();
      const duplicate = sameName.docs.find((doc) => String(doc.data().city || "").trim().toLowerCase() === input.city.toLowerCase() && String(doc.data().country || "ZW") === input.country);
      if (duplicate) throw Object.assign(new Error("A matching business already exists in this city. Link its business ID rather than creating a duplicate."), { status: 409 });
      businessRef = db.collection("businesses").doc();
      businessId = businessRef.id;
    }
    const now = FieldValue.serverTimestamp();
    const payload = {
      name: input.name, city: input.city, area: input.area, address: input.address,
      phone: input.phone,
      category: input.category, directoryBusinessId: businessId,
      status: input.status, priceCheckMethod: input.priceCheckMethod,
      affiliation: "unaffiliated", sourcingModel: "independent_in_person",
      items: input.items, country: input.country, currency: input.country === "MW" ? "MWK" : "USD",
      updatedBy: actor.uid, updatedAt: now
    };
    if (!old.exists) { payload.createdBy = actor.uid; payload.createdAt = now; }
    const batch = db.batch();
    batch.set(ref, payload, { merge: true });
    if (!businessSnap) {
      batch.create(businessRef, {
        name: input.name, brandName: input.name, category: input.category,
        categories: [input.category], businessType: "restaurant_food", country: input.country,
        city: input.city, area: input.area, address: input.address, phone: input.phone,
        public: true, status: "provisional", lifecycleStatus: "listed",
        claimStatus: "unclaimed", verificationStatus: "unverified",
        commerceVerificationStatus: "not_verified", capabilities: ["discover", "claim"],
        assistEnabled: true, assistStoreId: ref.id, fulfilment: [], ownerIds: [],
        source: { type: "spotly_researched", rightsStatus: "spotly_created" },
        createdAt: now, updatedAt: now, createdBy: actor.uid
      });
    } else {
      batch.set(businessRef, { assistStoreId: ref.id, updatedAt: now }, { merge: true });
    }
    await batch.commit();
    return Response.json({ ok: true, id: ref.id, directoryBusinessId: businessId, status: input.status, itemCount: input.items.length }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the listing details and independently checked item prices.", details: error.flatten() }, { status: 422 });
    return apiError(error);
  }
}

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
    const now = FieldValue.serverTimestamp();
    const payload = {
      name: input.name, city: input.city, area: input.area, address: input.address,
      category: input.category, directoryBusinessId: input.directoryBusinessId,
      status: input.status, priceCheckMethod: input.priceCheckMethod,
      affiliation: "unaffiliated", sourcingModel: "independent_in_person",
      items: input.items, country: "ZW", currency: "USD",
      updatedBy: actor.uid, updatedAt: now
    };
    if (!old.exists) { payload.createdBy = actor.uid; payload.createdAt = now; }
    await ref.set(payload, { merge: true });
    return Response.json({ ok: true, id: ref.id, status: input.status, itemCount: input.items.length }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the listing details and independently checked item prices.", details: error.flatten() }, { status: 422 });
    return apiError(error);
  }
}

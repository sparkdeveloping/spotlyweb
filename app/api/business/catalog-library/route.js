import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requireBusinessPermission } from "@/lib/access-control-server";
import { canPublishMasterImage, compareMasterProduct, normalizeProductText } from "@/lib/catalog-library";
import { safeText } from "@/lib/server-helpers";

export const runtime = "nodejs";

const addSchema = z.object({
  action: z.literal("add_offers"),
  businessId: z.string().min(3).max(180),
  items: z.array(z.object({
    masterProductId: z.string().min(3).max(180),
    branchIds: z.array(z.string().min(1).max(180)).max(100).default([]),
    price: z.number().min(0).optional(),
    currency: z.string().min(3).max(4).default("USD"),
    stockStatus: z.enum(["in_stock", "low_stock", "unavailable"]).default("in_stock")
  })).min(1).max(200)
});


const matchImportSchema = z.object({
  action: z.literal("match_import"),
  businessId: z.string().min(3).max(180),
  items: z.array(z.object({
    name: z.string().min(1).max(180),
    brand: z.string().max(120).optional(),
    barcode: z.string().max(80).optional(),
    gtin: z.string().max(80).optional(),
    variant: z.string().max(120).optional(),
    packSize: z.string().max(80).optional(),
    manufacturerSku: z.string().max(120).optional(),
    sku: z.string().max(120).optional()
  })).min(1).max(100)
});
const suggestionSchema = z.object({
  action: z.literal("suggest_product"),
  businessId: z.string().min(3).max(180),
  name: z.string().min(2).max(180),
  brand: z.string().max(120).optional(),
  barcode: z.string().max(80).optional(),
  variant: z.string().max(120).optional(),
  packSize: z.string().max(80).optional(),
  category: z.string().max(120).optional(),
  notes: z.string().max(1000).optional()
});

async function getCollections(db) {
  const snapshot = await db.collection("catalogCollections").where("publicationStatus", "==", "active").limit(100).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    const url = new URL(request.url);
    const businessId = safeText(url.searchParams.get("businessId"), 180);
    const search = safeText(url.searchParams.get("query"), 180);
    const collectionId = safeText(url.searchParams.get("collection"), 180);
    const cursor = safeText(url.searchParams.get("cursor"), 180);
    const pageSize = Math.min(60, Math.max(10, Number(url.searchParams.get("limit") || 30)));
    const { db } = getAdminServices();
    await requireBusinessPermission(db, user, businessId, "catalog.read", { allowRoles: ["organization_owner", "business_owner", "business_manager", "branch_manager", "catalog_manager"] });

    let allowedIds = null;
    if (collectionId) {
      const collectionSnapshot = await db.collection("catalogCollections").doc(collectionId).get();
      if (!collectionSnapshot.exists || collectionSnapshot.data().publicationStatus !== "active") throw Object.assign(new Error("That Spotly Library collection is not available."), { status: 404 });
      allowedIds = new Set(collectionSnapshot.data().masterProductIds || []);
    }

    let query = db.collection("masterProducts").where("verificationStatus", "==", "verified").orderBy("canonicalName").limit(pageSize + 1);
    const normalized = normalizeProductText(search);
    if (normalized) {
      const compact = normalized.replace(/\s+/g, "");
      if (/^\d{6,18}$/.test(compact)) query = db.collection("masterProducts").where("gtin", "==", compact).where("verificationStatus", "==", "verified").limit(pageSize + 1);
      else query = db.collection("masterProducts").where("searchTerms", "array-contains", normalized.split(/\s+/)[0]).where("verificationStatus", "==", "verified").orderBy("canonicalName").limit(pageSize + 1);
    }
    if (cursor) {
      const cursorSnapshot = await db.collection("masterProducts").doc(cursor).get();
      if (cursorSnapshot.exists) query = query.startAfter(cursorSnapshot);
    }
    const snapshot = await query.get();
    let records = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })).filter(canPublishMasterImage);
    if (allowedIds) records = records.filter((item) => allowedIds.has(item.id));
    if (normalized) records = records.filter((item) => `${item.canonicalName || ""} ${item.brand || ""} ${item.variant || ""} ${item.packSize || ""} ${item.gtin || ""} ${(item.searchAliases || []).join(" ")}`.toLowerCase().includes(normalized) || (item.searchTerms || []).some((term) => term.includes(normalized)));
    const hasMore = records.length > pageSize;
    const items = records.slice(0, pageSize);
    return Response.json({ ok: true, items, collections: await getCollections(db), nextCursor: hasMore ? items.at(-1)?.id || null : null });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const raw = await request.json();
    const { db } = getAdminServices();
    if (raw.action === "match_import") {
      const body = matchImportSchema.parse(raw);
      await requireBusinessPermission(db, user, body.businessId, "catalog.read", { allowRoles: ["organization_owner", "business_owner", "business_manager", "branch_manager", "catalog_manager"] });
      const matches = [];
      for (let start = 0; start < body.items.length; start += 12) {
        const group = body.items.slice(start, start + 12);
        const groupMatches = await Promise.all(group.map(async (candidate, offset) => {
          const barcode = normalizeProductText(candidate.gtin || candidate.barcode || "").replace(/\s+/g, "");
          let snapshots = [];
          if (barcode) {
            const exact = await db.collection("masterProducts").where("gtin", "==", barcode).where("verificationStatus", "==", "verified").limit(5).get();
            snapshots = exact.docs;
          }
          if (!snapshots.length) {
            const token = normalizeProductText(`${candidate.brand || ""} ${candidate.name || ""}`).split(/\s+/).find((value) => value.length >= 2);
            if (token) {
              const nearby = await db.collection("masterProducts").where("searchTerms", "array-contains", token).where("verificationStatus", "==", "verified").limit(12).get();
              snapshots = nearby.docs;
            }
          }
          const ranked = snapshots.map((snapshot) => {
            const data = snapshot.data();
            return { snapshot, data, comparison: compareMasterProduct(candidate, { id: snapshot.id, ...data }) };
          }).filter((item) => item.comparison.strength !== "none").sort((a, b) => ({ exact: 3, strong: 2, possible: 1 }[b.comparison.strength] - ({ exact: 3, strong: 2, possible: 1 }[a.comparison.strength]));
          const best = ranked[0];
          return {
            index: start + offset,
            strength: best?.comparison.strength || "none",
            reason: best?.comparison.reason || "none",
            masterProduct: best ? { id: best.snapshot.id, canonicalName: best.data.canonicalName, brand: best.data.brand || "", variant: best.data.variant || "", packSize: best.data.packSize || "", gtin: best.data.gtin || "" } : null
          };
        }));
        matches.push(...groupMatches);
      }
      return Response.json({ ok: true, matches });
    }
    if (raw.action === "suggest_product") {
      const body = suggestionSchema.parse(raw);
      await requireBusinessPermission(db, user, body.businessId, "catalog.update", { allowRoles: ["organization_owner", "business_owner", "business_manager", "catalog_manager"] });
      const ref = db.collection("masterProductSuggestions").doc();
      await ref.set({ businessId: body.businessId, submittedBy: user.uid, name: safeText(body.name, 180), brand: safeText(body.brand, 120), barcode: safeText(body.barcode, 80), variant: safeText(body.variant, 120), packSize: safeText(body.packSize, 80), category: safeText(body.category, 120), notes: safeText(body.notes, 1000), status: "needs_review", createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      return Response.json({ ok: true, suggestionId: ref.id });
    }

    const body = addSchema.parse(raw);
    await requireBusinessPermission(db, user, body.businessId, "catalog.update", { allowRoles: ["organization_owner", "business_owner", "business_manager", "catalog_manager"] });
    const requestedIds = [...new Set(body.items.map((item) => item.masterProductId))];
    const snapshots = await db.getAll(...requestedIds.map((id) => db.collection("masterProducts").doc(id)));
    const masters = new Map(snapshots.filter((snapshot) => snapshot.exists && snapshot.data().verificationStatus === "verified" && canPublishMasterImage(snapshot.data())).map((snapshot) => [snapshot.id, snapshot.data()]));
    if (masters.size !== requestedIds.length) throw Object.assign(new Error("One or more Spotly Library products are not verified for merchant use."), { status: 422 });

    const branchIds = [...new Set(body.items.flatMap((item) => item.branchIds || []))];
    if (branchIds.length) {
      const branches = await db.getAll(...branchIds.map((id) => db.collection("branches").doc(id)));
      if (branches.some((snapshot) => !snapshot.exists || snapshot.data().businessId !== body.businessId)) throw Object.assign(new Error("One or more selected locations do not belong to this business."), { status: 422 });
    }

    const existingMasterIds = new Set();
    for (let index = 0; index < requestedIds.length; index += 30) {
      const group = requestedIds.slice(index, index + 30);
      const existing = await db.collection("products").where("businessId", "==", body.businessId).where("masterProductId", "in", group).get();
      existing.docs.forEach((doc) => existingMasterIds.add(doc.data().masterProductId));
    }
    const created = [];
    for (let start = 0; start < body.items.length; start += 350) {
      const batch = db.batch();
      for (const item of body.items.slice(start, start + 350)) {
        if (existingMasterIds.has(item.masterProductId)) continue;
        const master = masters.get(item.masterProductId);
        const productRef = db.collection("products").doc();
        const price = Number(item.price || 0);
        batch.create(productRef, {
          businessId: body.businessId,
          masterProductId: item.masterProductId,
          name: master.canonicalName,
          brand: master.brand || "",
          variant: master.variant || "",
          packSize: master.packSize || "",
          description: master.description || "",
          category: master.categoryPath?.at(-1) || "Groceries",
          image: master.primaryImage || "",
          imageRightsStatus: master.imageRightsStatus || "reference_only",
          imageSourceType: master.sourceType || "spotly_library",
          currency: item.currency,
          price,
          prices: { [item.currency]: price },
          stockMode: "status",
          stockStatus: item.stockStatus,
          stockQuantity: 0,
          active: true,
          published: false,
          publicationState: "draft",
          pickupEligible: true,
          substitutionAllowed: true,
          branchIds: item.branchIds || [],
          branchOverrides: {},
          sourceType: "spotly_library",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: user.uid
        });
        created.push(productRef.id);
      }
      await batch.commit();
    }
    return Response.json({ ok: true, created: created.length, productIds: created, skipped: body.items.length - created.length });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the product details and try again.", details: error.flatten() }, { status: 400 });
    return apiError(error);
  }
}

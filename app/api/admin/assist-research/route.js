import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";

export const runtime = "nodejs";
const roles = ["super_admin", "platform_admin", "operations_manager", "data_import_manager"];
const webUrl = z.string().url().max(650).refine(s => s.startsWith("https://"), "HTTPS sources only");
const time = z.string().datetime({ offset: true });
const location = z.object({
  researchId: z.string().min(3).max(120),
  name: z.string().trim().min(2).max(180),
  brandName: z.string().trim().max(150).optional(),
  country: z.literal("ZW"),
  city: z.string().trim().min(2).max(100),
  area: z.string().trim().max(150).default(""),
  address: z.string().trim().max(350).default(""),
  category: z.string().trim().max(100).default("Restaurant"),
  phone: z.string().trim().max(50).default(""),
  sourceUrl: webUrl,
  sourceKind: z.string().trim().max(100).default("web_reference"),
  observedAt: time
}).passthrough();
const price = z.object({
  itemId: z.string().min(3).max(120),
  brand: z.string().trim().min(2).max(150),
  itemName: z.string().trim().min(2).max(180),
  currency: z.literal("USD"),
  onlineReferencePrice: z.number().finite().min(0).max(100000),
  priceSourceUrl: webUrl,
  sourceType: z.string().trim().max(100).default("web_reference"),
  observedAt: time
}).passthrough();
const schema = z.object({
  mode: z.enum(["preview", "stage"]),
  metadata: z.object({ dataset: z.string().max(200).optional(), observedAt: time.optional() }).passthrough().optional(),
  locations: z.array(location).max(120),
  priceReferences: z.array(price).max(300)
}).strict();

const normalized = value => String(value || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g," ").trim();
const signature = entry => [normalized(entry.name),normalized(entry.city),normalized(entry.area),normalized(entry.address)].join("|");

export async function GET(request) {
  try {
    await authenticateRequest(request, { roles });
    const { db } = getAdminServices();
    const snapshot = await db.collection("assistResearchBatches").orderBy("createdAt", "desc").limit(25).get();
    const batches = snapshot.docs.map(doc => {
      const item = doc.data();
      return {
        id: doc.id, country: item.country, status: item.status,
        locationCount: item.locationCount, priceCount: item.priceCount,
        distinctBrands: item.distinctBrands, reviewRequired: item.reviewRequired,
        createdAt: item.createdAt?.toDate?.()?.toISOString?.() || null
      };
    });
    return Response.json({ ok: true, batches }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}

export async function POST(request) {
  try {
    const actor = await authenticateRequest(request, { roles });
    const text = await request.text();
    if (text.length > 600000) return Response.json({ ok: false, error: "Research batch is too large. Split it into smaller batches." }, { status: 413 });
    let decoded;
    try { decoded = JSON.parse(text); } catch { return Response.json({ ok: false, error: "Upload a valid research JSON file." }, { status: 422 }); }
    const input = schema.parse(decoded);
    if (!input.locations.length && !input.priceReferences.length) return Response.json({ ok: false, error: "The research batch is empty." }, { status: 422 });

    const locationKeys = new Set();
    const collisions = [];
    for (const item of input.locations) {
      const key = signature(item);
      if (locationKeys.has(key)) collisions.push(item.name);
      locationKeys.add(key);
    }
    const itemKeys = new Set();
    for (const item of input.priceReferences) {
      const key = item.brand.toLowerCase() + "|" + item.itemName.toLowerCase() + "|" + item.priceSourceUrl;
      if (itemKeys.has(key)) collisions.push(item.brand + " / " + item.itemName);
      itemKeys.add(key);
    }
    if (collisions.length) {
      return Response.json({ ok: false, error: "Repeated research entries must be resolved before staging.", collisions: collisions.slice(0,25) }, { status: 409 });
    }

    const brands = [...new Set([...input.locations.map(x => x.brandName || x.name), ...input.priceReferences.map(x => x.brand)])].sort();
    const fileDigest = createHash("sha256").update(text.replace(/"mode"\s*:\s*"(preview|stage)"/, '"mode":"research"')).digest("hex").slice(0,24);
    const batchId = "zw_" + fileDigest;
    const report = {
      id: batchId, country: "ZW", locationCount: input.locations.length,
      priceCount: input.priceReferences.length, distinctBrands: brands,
      duplicateAudit: "PENDING_CANONICAL_FIRESTORE_REVIEW",
      rightsReview: "PENDING", sourceVerification: "ONLINE_REFERENCE_ONLY",
      publishable: false, orderable: false, importedToPublicDirectory: false,
      publicationStatus: "research_only"
    };
    if (input.mode === "preview") return Response.json({ ok: true, mode: "preview", ...report });
    const { db } = getAdminServices();
    const ref = db.collection("assistResearchBatches").doc(batchId);
    const existing = await ref.get();
    if (existing.exists) {
      return Response.json({ ok: true, mode: "stage", idempotent: true, ...report });
    }
    const batch = db.batch();
    // Research is kept PRIVATE. These records never enter businesses, products, branches
    // or independentShoppingStores until a separate, reviewed publication workflow.
    batch.create(ref, {
      country: "ZW", status: "research_only", public: false,
      importedToPublicDirectory: false, reviewRequired: true,
      locationCount: input.locations.length, priceCount: input.priceReferences.length,
      distinctBrands: brands,
      metadata: { dataset: input.metadata?.dataset || "Zimbabwe restaurant research", observedAt: input.metadata?.observedAt || null },
      createdBy: actor.uid, createdAt: FieldValue.serverTimestamp()
    });
    for (const item of input.locations) {
      const key = createHash("sha256").update(item.researchId + "|" + signature(item)).digest("hex").slice(0,24);
      batch.create(ref.collection("locations").doc(key), {
        name: item.name, brandName: item.brandName || item.name,
        country: "ZW", city: item.city, area: item.area, address: item.address,
        category: item.category, phone: item.phone,
        sourceUrl: item.sourceUrl, sourceKind: item.sourceKind,
        observedAt: item.observedAt, public: false,
        verificationStatus: "research_only", claimedStatus: "not_checked",
        duplicateReviewRequired: true, operatorVerified: false,
        sourceUseClearance: "not_assessed", priceCheckedAt: null,
        batchId, createdAt: FieldValue.serverTimestamp()
      });
    }
    for (const item of input.priceReferences) {
      const key = createHash("sha256").update(item.itemId + "|" + item.brand + "|" + item.itemName).digest("hex").slice(0,24);
      batch.create(ref.collection("prices").doc(key), {
        brand: item.brand, itemName: item.itemName,
        currency: "USD", onlineReferencePrice: item.onlineReferencePrice,
        priceSourceUrl: item.priceSourceUrl, sourceType: item.sourceType,
        observedAt: item.observedAt, priceCheckedAt: null,
        status: "online_reference_unverified", public: false,
        orderable: false, commercialReuseClearance: "not_assessed",
        batchId, createdAt: FieldValue.serverTimestamp()
      });
    }
    // A single batch includes <= 421 writes, below Firestore's 500-write limit.
    await batch.commit();
    return Response.json({ ok: true, mode: "stage", idempotent: false, ...report });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ ok: false, error: "Check the research source links, dates, Zimbabwe country codes and price values.", details: error.flatten() }, { status: 422 });
    }
    return apiError(error);
  }
}

import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requireSpotlyStaffPermission } from "@/lib/access-control-server";
import { findMasterProductByBarcode, masterProductPayload } from "@/lib/master-product-server";
import { normalizeProductText } from "@/lib/catalog-library";
import { safeText } from "@/lib/server-helpers";

export const runtime = "nodejs";

const captureSchema = z.object({
  action: z.literal("capture"),
  businessId: z.string().min(3).max(180),
  branchId: z.string().max(180).optional(),
  masterProductId: z.string().max(180).optional(),
  barcode: z.string().max(80).optional(),
  name: z.string().min(2).max(180),
  brand: z.string().max(120).optional(),
  variant: z.string().max(120).optional(),
  packSize: z.string().max(80).optional(),
  unit: z.string().max(50).optional(),
  category: z.string().max(120).optional(),
  observedPrice: z.number().min(0).optional(),
  currency: z.string().min(3).max(4).default("USD"),
  observedAvailability: z.enum(["available", "limited", "unavailable", "unknown"]).default("available"),
  packagingMatched: z.boolean().default(true),
  frontImage: z.string().max(2000).optional(),
  backImage: z.string().max(2000).optional(),
  imageStoragePath: z.string().max(1000).optional(),
  notes: z.string().max(1000).optional()
});

const reviewSchema = z.object({
  action: z.literal("review"),
  masterProductId: z.string().min(3).max(180),
  decision: z.enum(["approve", "reject"]),
  reason: z.string().max(500).optional()
});

const mergeSchema = z.object({
  action: z.literal("merge"),
  sourceMasterProductId: z.string().min(3).max(180),
  targetMasterProductId: z.string().min(3).max(180),
  reason: z.string().min(3).max(500)
});

const collectionSchema = z.object({
  action: z.literal("collection_upsert"),
  collectionId: z.string().max(180).optional(),
  name: z.string().min(2).max(180),
  description: z.string().max(500).optional(),
  masterProductIds: z.array(z.string().min(3).max(180)).max(500).default([]),
  publicationStatus: z.enum(["draft", "active", "archived"]).default("draft")
});

async function authorizeCapture(db, user) {
  return requireSpotlyStaffPermission(db, user, "master_products.capture", { roles: ["business_success", "business_success_manager", "content_editor", "content_manager", "operations_manager", "regional_operations_manager"] });
}

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    const { db } = getAdminServices();
    await authorizeCapture(db, user);
    const url = new URL(request.url);
    const type = url.searchParams.get("type") || "products";
    const search = safeText(url.searchParams.get("query"), 180);
    const barcode = safeText(url.searchParams.get("barcode"), 80).replace(/\s+/g, "");
    if (type === "sources") {
      await requireSpotlyStaffPermission(db, user, "master_products.review", { roles: ["content_manager", "operations_manager", "regional_operations_manager"] });
      const snapshot = await db.collection("catalogueSources").orderBy("sourceName").limit(100).get();
      return Response.json({ ok: true, items: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) });
    }
    if (type === "collections") {
      await requireSpotlyStaffPermission(db, user, "master_products.review", { roles: ["content_manager", "operations_manager", "regional_operations_manager"] });
      const snapshot = await db.collection("catalogCollections").orderBy("name").limit(100).get();
      return Response.json({ ok: true, items: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) });
    }
    if (type === "review") {
      await requireSpotlyStaffPermission(db, user, "master_products.review", { roles: ["content_manager", "operations_manager", "regional_operations_manager"] });
      const snapshot = await db.collection("masterProducts").where("verificationStatus", "==", "needs_review").limit(100).get();
      return Response.json({ ok: true, items: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) });
    }
    if (type === "businesses") {
      const normalized = normalizeProductText(search);
      let query = db.collection("businesses").orderBy("name").limit(30);
      if (normalized) query = db.collection("businesses").where("searchTerms", "array-contains", normalized.split(/\s+/)[0]).limit(30);
      const snapshot = await query.get();
      const businesses = snapshot.docs.map((doc) => ({ id: doc.id, name: doc.data().brandName || doc.data().name || "Business", city: doc.data().city || "", category: doc.data().category || "" }));
      return Response.json({ ok: true, businesses });
    }
    if (type === "branches") {
      const businessId = safeText(url.searchParams.get("businessId"), 180);
      const snapshot = await db.collection("branches").where("businessId", "==", businessId).limit(100).get();
      const branches = snapshot.docs.map((doc) => ({ id: doc.id, name: doc.data().branchName || doc.data().name || "Location", city: doc.data().city || "" }))
        .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
      return Response.json({ ok: true, branches });
    }
    if (barcode) {
      const product = await findMasterProductByBarcode(db, barcode);
      return Response.json({ ok: true, items: product ? [product] : [] });
    }
    const normalized = normalizeProductText(search);
    let query = db.collection("masterProducts").orderBy("canonicalName").limit(30);
    if (normalized) query = db.collection("masterProducts").where("searchTerms", "array-contains", normalized.split(/\s+/)[0]).limit(30);
    const snapshot = await query.get();
    return Response.json({ ok: true, items: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) });
  } catch (error) { return apiError(error); }
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const raw = await request.json();
    const { db } = getAdminServices();
    if (raw.action === "merge") {
      const body = mergeSchema.parse(raw);
      await requireSpotlyStaffPermission(db, user, "master_products.manage", { roles: ["content_manager", "operations_manager", "regional_operations_manager"] });
      if (body.sourceMasterProductId === body.targetMasterProductId) throw Object.assign(new Error("Choose two different master products."), { status: 422 });
      const sourceRef = db.collection("masterProducts").doc(body.sourceMasterProductId);
      const targetRef = db.collection("masterProducts").doc(body.targetMasterProductId);
      const [source, target] = await Promise.all([sourceRef.get(), targetRef.get()]);
      if (!source.exists || !target.exists) throw Object.assign(new Error("Both master products must exist."), { status: 404 });
      if (target.data().verificationStatus !== "verified") throw Object.assign(new Error("Merge into a verified master product."), { status: 422 });
      const linked = await db.collection("products").where("masterProductId", "==", body.sourceMasterProductId).limit(450).get();
      const batch = db.batch();
      linked.docs.forEach((doc) => batch.update(doc.ref, { masterProductId: body.targetMasterProductId, masterProductMergedFrom: body.sourceMasterProductId, updatedAt: FieldValue.serverTimestamp(), updatedBy: user.uid }));
      batch.update(sourceRef, { verificationStatus: "merged", mergedInto: body.targetMasterProductId, mergeReason: safeText(body.reason, 500), reviewedBy: user.uid, reviewedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      await batch.commit();
      await db.collection("auditLogs").add({ action: "master_product.merged", entityType: "masterProduct", entityId: body.sourceMasterProductId, actorId: user.uid, actorEmail: user.email || "", metadata: { targetMasterProductId: body.targetMasterProductId, updatedBusinessOffers: linked.size, reason: safeText(body.reason, 500) }, createdAt: FieldValue.serverTimestamp() });
      return Response.json({ ok: true, updatedBusinessOffers: linked.size });
    }
    if (raw.action === "collection_upsert") {
      const body = collectionSchema.parse(raw);
      await requireSpotlyStaffPermission(db, user, "master_products.manage", { roles: ["content_manager", "operations_manager", "regional_operations_manager"] });
      const ref = body.collectionId ? db.collection("catalogCollections").doc(body.collectionId) : db.collection("catalogCollections").doc();
      await ref.set({ name: safeText(body.name, 180), description: safeText(body.description, 500), masterProductIds: [...new Set(body.masterProductIds)], publicationStatus: body.publicationStatus, updatedAt: FieldValue.serverTimestamp(), updatedBy: user.uid, ...(body.collectionId ? {} : { createdAt: FieldValue.serverTimestamp(), createdBy: user.uid }) }, { merge: true });
      await db.collection("auditLogs").add({ action: "catalog_collection.updated", entityType: "catalogCollection", entityId: ref.id, actorId: user.uid, actorEmail: user.email || "", metadata: { publicationStatus: body.publicationStatus, productCount: body.masterProductIds.length }, createdAt: FieldValue.serverTimestamp() });
      return Response.json({ ok: true, collectionId: ref.id });
    }
    if (raw.action === "review") {
      const body = reviewSchema.parse(raw);
      await requireSpotlyStaffPermission(db, user, "master_products.review", { roles: ["content_manager", "operations_manager", "regional_operations_manager"] });
      const ref = db.collection("masterProducts").doc(body.masterProductId);
      const snapshot = await ref.get();
      if (!snapshot.exists) throw Object.assign(new Error("The master product was not found."), { status: 404 });
      await ref.set({ verificationStatus: body.decision === "approve" ? "verified" : "rejected", reviewReason: safeText(body.reason, 500), verifiedBy: body.decision === "approve" ? user.uid : null, verifiedAt: body.decision === "approve" ? FieldValue.serverTimestamp() : null, reviewedBy: user.uid, reviewedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      await db.collection("auditLogs").add({ action: `master_product.${body.decision}d`, entityType: "masterProduct", entityId: body.masterProductId, actorId: user.uid, actorEmail: user.email || "", metadata: { reason: safeText(body.reason, 500) }, createdAt: FieldValue.serverTimestamp() });
      return Response.json({ ok: true });
    }

    const body = captureSchema.parse(raw);
    await authorizeCapture(db, user);
    const businessSnapshot = await db.collection("businesses").doc(body.businessId).get();
    if (!businessSnapshot.exists) throw Object.assign(new Error("The observed business was not found."), { status: 404 });
    if (body.branchId) {
      const branch = await db.collection("branches").doc(body.branchId).get();
      if (!branch.exists || branch.data().businessId !== body.businessId) throw Object.assign(new Error("The selected location does not belong to that business."), { status: 422 });
    }

    let masterId = body.masterProductId || "";
    if (!masterId && body.barcode) masterId = (await findMasterProductByBarcode(db, body.barcode))?.id || "";
    if (!masterId) {
      const masterRef = db.collection("masterProducts").doc();
      const payload = masterProductPayload({ canonicalName: body.name, brand: body.brand, barcode: body.barcode, variant: body.variant, packSize: body.packSize, unit: body.unit, categoryPath: [body.category || "Groceries"], primaryImage: body.frontImage || "", additionalImages: body.backImage ? [body.backImage] : [], imageRightsStatus: body.frontImage ? "spotly_photographed" : "reference_only", sourceType: "spotly_field_capture", verificationStatus: "needs_review", metadata: { observedBusinessId: body.businessId, observedBranchId: body.branchId || null } }, user.uid);
      await masterRef.set({ ...payload, createdAt: FieldValue.serverTimestamp(), createdBy: user.uid });
      masterId = masterRef.id;
    }

    const observationRef = db.collection("productObservations").doc();
    await observationRef.set({
      masterProductId: masterId,
      businessId: body.businessId,
      branchId: body.branchId || null,
      observedPrice: body.observedPrice ?? null,
      currency: body.currency,
      observedAvailability: body.observedAvailability,
      packagingMatched: body.packagingMatched,
      sourceType: "spotly_field_collection",
      sourceReference: body.imageStoragePath || "",
      frontImage: body.frontImage || "",
      backImage: body.backImage || "",
      notes: safeText(body.notes, 1000),
      workerId: user.uid,
      observedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp()
    });
    await db.collection("masterProducts").doc(masterId).set({ lastObservedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await db.collection("auditLogs").add({ action: "master_product.observed", entityType: "masterProduct", entityId: masterId, actorId: user.uid, actorEmail: user.email || "", metadata: { businessId: body.businessId, branchId: body.branchId || null, observationId: observationRef.id }, createdAt: FieldValue.serverTimestamp() });
    return Response.json({ ok: true, masterProductId: masterId, observationId: observationRef.id });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the captured product information.", details: error.flatten() }, { status: 400 });
    return apiError(error);
  }
}

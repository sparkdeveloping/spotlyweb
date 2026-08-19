"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from "firebase/firestore";
import { getFirebaseClient } from "@/lib/firebase";
import { normalizeSearchTerms, notifyBranchesChanged, writeClientTelemetry } from "@/lib/firebase-services";
import { authenticatedFetch } from "@/lib/api-client";

function sdk() {
  const client = getFirebaseClient();
  if (!client) throw new Error("Firebase is not configured in this browser.");
  return client;
}

function clean(value) {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return value;
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, clean(item)])
    );
  }
  return value;
}

function list(snapshot) {
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

function newest(records = []) {
  const time = (value) => {
    if (!value) return 0;
    if (typeof value?.toMillis === "function") return value.toMillis();
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  };
  return [...records].sort((a, b) => time(b.updatedAt || b.createdAt) - time(a.updatedAt || a.createdAt));
}

export function subscribeBusinessOperationalSettings(businessId, callback, onError) {
  if (!businessId) return () => {};
  const { db } = sdk();
  return onSnapshot(
    doc(db, "businessOperationalSettings", businessId),
    (snapshot) => callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null),
    onError
  );
}

export async function saveBusinessOperationalSettings(businessId, values, actor) {
  const { db } = sdk();
  const payload = clean({
    businessId,
    orderNotifications: values.orderNotifications !== false,
    lowStockNotifications: values.lowStockNotifications !== false,
    supportNotifications: values.supportNotifications !== false,
    dailySummary: values.dailySummary !== false,
    defaultCurrency: values.defaultCurrency || "USD",
    inventoryMode: values.inventoryMode || "business_choice",
    substitutionsEnabled: values.substitutionsEnabled !== false,
    cancellationPolicy: values.cancellationPolicy || "before_preparation",
    autoAcceptOrders: Boolean(values.autoAcceptOrders),
    minimumOrder: Number(values.minimumOrder || 0),
    preparationMinutes: Number(values.preparationMinutes || 45),
    pickupInstructions: values.pickupInstructions || "",
    contactlessPickup: Boolean(values.contactlessPickup),
    updatedAt: serverTimestamp(),
    updatedBy: actor?.uid || null
  });
  await setDoc(doc(db, "businessOperationalSettings", businessId), payload, { merge: true });
  await writeClientTelemetry({
    action: "business_operations.updated",
    entityType: "businessOperationalSettings",
    entityId: businessId,
    actorId: actor?.uid,
    actorEmail: actor?.email
  });
}

export function subscribePromotions(businessId, callback, onError) {
  if (!businessId) return () => {};
  const { db } = sdk();
  return onSnapshot(
    query(collection(db, "promotions"), where("businessId", "==", businessId), limit(250)),
    (snapshot) => callback(newest(list(snapshot))),
    onError
  );
}

export async function savePromotion(promotion, businessId, actor) {
  const { db } = sdk();
  const promotionRef = promotion.id ? doc(db, "promotions", promotion.id) : doc(collection(db, "promotions"));
  const startsAt = promotion.startsAt || new Date().toISOString().slice(0, 10);
  const endsAt = promotion.endsAt || "";
  if (endsAt && endsAt < startsAt) throw new Error("The promotion end date must be after the start date.");
  const value = Number(promotion.value || 0);
  if (value <= 0) throw new Error("Enter a discount value greater than zero.");
  if (promotion.type === "percentage" && value > 100) throw new Error("Percentage discounts cannot exceed 100%.");

  await setDoc(promotionRef, clean({
    businessId,
    name: promotion.name.trim(),
    description: promotion.description || "",
    code: (promotion.code || "").trim().toUpperCase(),
    type: promotion.type || "percentage",
    value,
    currency: promotion.currency || "USD",
    minimumSpend: Number(promotion.minimumSpend || 0),
    usageLimit: Number(promotion.usageLimit || 0),
    usedCount: Number(promotion.usedCount || 0),
    branchIds: promotion.branchIds || [],
    productIds: promotion.productIds || [],
    audience: promotion.audience || "all_customers",
    startsAt,
    endsAt,
    active: promotion.active !== false,
    status: promotion.active === false ? "paused" : "active",
    createdAt: promotion.id ? promotion.createdAt || serverTimestamp() : serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: actor?.uid || null
  }), { merge: true });

  await writeClientTelemetry({
    action: promotion.id ? "promotion.updated" : "promotion.created",
    entityType: "promotion",
    entityId: promotionRef.id,
    actorId: actor?.uid,
    actorEmail: actor?.email,
    metadata: { businessId }
  });
  return promotionRef.id;
}

export async function deletePromotion(id, actor) {
  const { db } = sdk();
  const snapshot = await getDoc(doc(db, "promotions", id));
  await deleteDoc(doc(db, "promotions", id));
  await writeClientTelemetry({
    action: "promotion.deleted",
    entityType: "promotion",
    entityId: id,
    actorId: actor?.uid,
    actorEmail: actor?.email,
    metadata: { businessId: snapshot.data()?.businessId || null }
  });
}

export function subscribeCatalogTemplates(callback, onError) {
  const { db } = sdk();
  return onSnapshot(
    query(collection(db, "catalogTemplates"), orderBy("name"), limit(100)),
    (snapshot) => callback(list(snapshot)),
    onError
  );
}

export async function importCatalogTemplate(template, businessId, actor, options = {}) {
  const { db } = sdk();
  const records = template.products || template.items || [];
  if (!records.length) throw new Error("This template does not contain any products.");
  const existingSnapshot = await getDocs(query(collection(db, "products"), where("businessId", "==", businessId), limit(500)));
  const existingKeys = new Set(existingSnapshot.docs.map((item) => {
    const data = item.data();
    return `${String(data.name || "").toLowerCase()}|${String(data.sku || "").toLowerCase()}`;
  }));
  const toCreate = records.filter((item) => !existingKeys.has(`${String(item.name || "").toLowerCase()}|${String(item.sku || "").toLowerCase()}`));
  if (!toCreate.length) return { created: 0, skipped: records.length };

  for (let start = 0; start < toCreate.length; start += 400) {
    const batch = writeBatch(db);
    toCreate.slice(start, start + 400).forEach((item) => {
      const productRef = doc(collection(db, "products"));
      const prices = item.prices || (item.price ? { [options.currency || "USD"]: Number(item.price) } : {});
      batch.set(productRef, clean({
        businessId,
        name: item.name,
        description: item.description || "",
        category: item.category || template.category || "Groceries",
        image: item.image || "",
        sku: item.sku || "",
        barcode: item.barcode || "",
        prices,
        currency: options.currency || item.currency || "USD",
        price: Number(item.price || prices[options.currency || "USD"] || 0),
        stockMode: options.stockMode || "status",
        stockQuantity: Number(item.stockQuantity || 0),
        stockStatus: item.stockStatus || "in_stock",
        pickupEligible: item.pickupEligible ?? options.pickupEligible ?? false,
        substitutionAllowed: item.substitutionAllowed ?? options.substitutionAllowed ?? false,
        itemType: item.itemType || template.itemType || "product",
        durationMinutes: Number(item.durationMinutes || 0),
        capacity: Number(item.capacity || 0),
        startsAt: item.startsAt || null,
        endsAt: item.endsAt || null,
        venue: item.venue || "",
        requiresBusinessReview: Boolean(item.requiresBusinessReview),
        branchIds: options.branchIds || item.branchIds || [],
        sourceTemplateId: template.id,
        sourceType: "legacy_template",
        source: template.name || template.id,
        importSource: template.name || template.id,
        publicationState: "draft",
        published: false,
        imageRightsStatus: item.imageRightsStatus || (item.image ? "reference_only" : ""),
        active: false,
        searchTerms: normalizeSearchTerms(item.name, item.category, item.sku, item.barcode),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: actor?.uid || null
      }));
    });
    await batch.commit();
  }

  await writeClientTelemetry({
    action: "catalog_template.imported",
    entityType: "catalogTemplate",
    entityId: template.id,
    actorId: actor?.uid,
    actorEmail: actor?.email,
    metadata: { businessId, created: toCreate.length, skipped: records.length - toCreate.length }
  });
  return { created: toCreate.length, skipped: records.length - toCreate.length };
}

export async function quickAddProducts(products, businessId, actor) {
  const valid = products.filter((item) => item.name?.trim());
  if (!valid.length) throw new Error("Add at least one offering name.");
  const { db } = sdk();
  const batch = writeBatch(db);
  const productIds = [];
  valid.slice(0, 100).forEach((item) => {
    const productRef = doc(collection(db, "products"));
    productIds.push(productRef.id);
    const currency = item.currency || "USD";
    const price = Number(item.price || 0);
    batch.set(productRef, clean({
      businessId,
      name: item.name.trim(),
      description: item.description || "",
      category: item.category || "General",
      currency,
      price,
      prices: item.prices || { [currency]: price },
      sku: item.sku || "",
      barcode: item.barcode || "",
      stockMode: item.stockMode || "status",
      stockQuantity: Number(item.stockQuantity || 0),
      stockStatus: item.stockStatus || "in_stock",
      active: item.active !== false,
      pickupEligible: Boolean(item.pickupEligible),
      substitutionAllowed: Boolean(item.substitutionAllowed),
      itemType: item.itemType || "product",
      durationMinutes: Number(item.durationMinutes || 0),
      capacity: Number(item.capacity || 0),
      startsAt: item.startsAt || null,
      endsAt: item.endsAt || null,
      venue: item.venue || "",
      requiresBusinessReview: Boolean(item.requiresBusinessReview),
      branchIds: item.branchIds || [],
      masterProductId: item.masterProductId || null,
      brand: item.brand || "",
      variant: item.variant || "",
      packSize: item.packSize || "",
      manufacturerSku: item.manufacturerSku || "",
      branchOverrides: item.branchOverrides || {},
      image: item.image || "",
      imageStoragePath: item.imageStoragePath || "",
      imageRightsStatus: item.imageRightsStatus || "",
      imageSourceType: item.imageSourceType || "",
      sourceType: item.sourceType || "manual",
      source: item.source || item.importSource || "",
      importSource: item.importSource || "",
      importBatchId: item.importBatchId || "",
      importMatchStrength: item.importMatchStrength || "",
      importMatchReason: item.importMatchReason || "",
      importMatchCandidateId: item.importMatchCandidateId || "",
      importMatchCandidateName: item.importMatchCandidateName || "",
      sourceTemplateId: item.sourceTemplateId || item.templateId || "",
      publicationState: item.publicationState || (item.published ? "published" : "draft"),
      published: Boolean(item.published),
      searchTerms: normalizeSearchTerms(item.name, item.category, item.sku, item.barcode, item.venue, item.brand, item.variant, item.packSize),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: actor?.uid || null
    }));
  });
  await batch.commit();
  const firstImport = valid.find((item) => item.importBatchId);
  if (firstImport?.importBatchId) {
    await setDoc(doc(db, "catalogImportBatches", firstImport.importBatchId), clean({
      businessId,
      sourceType: firstImport.sourceType || "merchant_spreadsheet",
      source: firstImport.importSource || firstImport.source || "Spreadsheet import",
      productIds,
      recordCount: productIds.length,
      status: "needs_review",
      createdBy: actor?.uid || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }), { merge: true });
  }
  await writeClientTelemetry({
    action: "catalog.bulk_created",
    entityType: "product",
    entityId: businessId,
    actorId: actor?.uid,
    actorEmail: actor?.email,
    metadata: { count: Math.min(valid.length, 100) }
  });
  return Math.min(valid.length, 100);
}

export async function updateProductAvailability(productId, values, actor) {
  const { db } = sdk();
  await updateDoc(doc(db, "products", productId), clean({
    ...values,
    stockQuantity: values.stockQuantity === undefined ? undefined : Number(values.stockQuantity),
    updatedAt: serverTimestamp(),
    updatedBy: actor?.uid || null
  }));
}

export async function duplicateProduct(product, actor) {
  const { db } = sdk();
  const productRef = doc(collection(db, "products"));
  const { id, createdAt, updatedAt, ...values } = product;
  await setDoc(productRef, clean({
    ...values,
    name: `${product.name} copy`,
    sku: product.sku ? `${product.sku}-COPY` : "",
    active: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: actor?.uid || null
  }));
  return productRef.id;
}

export function subscribeBusinessMembers(businessId, callback, onError) {
  if (!businessId) return () => {};
  let active = true;
  let timer = null;
  async function load() {
    try {
      const result = await authenticatedFetch(`/api/business-team?businessId=${encodeURIComponent(businessId)}`);
      if (active) callback(result.members || []);
    } catch (error) {
      if (active) onError?.(error);
    } finally {
      if (active) timer = setTimeout(load, 15000);
    }
  }
  load();
  return () => { active = false; if (timer) clearTimeout(timer); };
}

export async function updateBusinessMembership(membershipId, values, actor, businessId) {
  if (!businessId) throw new Error("A business is required to update team access.");
  await authenticatedFetch("/api/business-team", { method: "POST", body: JSON.stringify({
    action: "update_member", businessId, membershipId, role: values.role, permissions: values.permissions || [], branchIds: values.branchIds || [], status: values.status || "active"
  }) });
}

export async function revokeBusinessInvitation(invitationId, actor, businessId) {
  if (!businessId) throw new Error("A business is required to revoke an invitation.");
  await authenticatedFetch("/api/business-team", { method: "POST", body: JSON.stringify({ action: "revoke", businessId, invitationId }) });
}

export async function resendBusinessInvitation(invitationId, actor, businessId) {
  if (!businessId) throw new Error("A business is required to resend an invitation.");
  await authenticatedFetch("/api/business-team", { method: "POST", body: JSON.stringify({ action: "resend", businessId, invitationId }) });
}

export async function deleteBranch(branchId, businessId, actor) {
  await authenticatedFetch("/api/business/branches", {
    method: "POST",
    body: JSON.stringify({ action: "delete", businessId, branchId })
  });
  await writeClientTelemetry({
    action: "branch.deleted.requested",
    entityType: "branch",
    entityId: branchId,
    actorId: actor?.uid,
    actorEmail: actor?.email,
    metadata: { businessId }
  });
  notifyBranchesChanged(businessId);
}

export async function updateBusinessOrder(order, changes, actor, note = "") {
  await authenticatedFetch("/api/business-orders/update", {
    method: "POST",
    body: JSON.stringify({ orderId: order.id, changes, note })
  });
}

export async function requestBusinessPublicationReview(business) {
  return authenticatedFetch("/api/business/launch-review/submit", {
    method: "POST",
    body: JSON.stringify({ businessId: business.id })
  });
}

export async function markLaunchCriticalBusinessChange(businessId, change) {
  if (!businessId || !change?.id || !change?.label) return { ok: true, changed: false };
  return authenticatedFetch("/api/business/launch-review/invalidate", {
    method: "POST",
    body: JSON.stringify({
      businessId,
      changeId: change.id,
      label: change.label,
      description: change.description || "",
      href: change.href || ""
    })
  });
}

export function subscribeAdminTasks(callback, options = {}) {
  const { db } = sdk();
  const constraints = [];
  if (options.status) constraints.push(where("status", "==", options.status));
  constraints.push(orderBy("createdAt", "desc"), limit(options.limit || 250));
  return onSnapshot(query(collection(db, "adminTasks"), ...constraints), (snapshot) => callback(list(snapshot)), options.onError);
}

export async function updateAdminTask(id, values, actor) {
  const { db } = sdk();
  await updateDoc(doc(db, "adminTasks", id), clean({
    ...values,
    updatedAt: serverTimestamp(),
    updatedBy: actor?.uid || null
  }));
}

export function subscribeBusinessPayouts(businessId, callback, onError) {
  if (!businessId) return () => {};
  const { db } = sdk();
  return onSnapshot(
    query(collection(db, "payouts"), where("businessId", "==", businessId), limit(250)),
    (snapshot) => callback(newest(list(snapshot))),
    onError
  );
}

export async function requestPayout(businessId, amount, currency, actor) {
  const numeric = Number(amount || 0);
  if (numeric <= 0) throw new Error("Enter a payout amount greater than zero.");
  const result = await authenticatedFetch("/api/payouts", { method: "POST", body: JSON.stringify({ action: "request", businessId, amount: numeric, currency: currency || "USD" }) });
  return result.payoutId;
}

export function subscribeBusinessActivity(businessId, callback, onError) {
  if (!businessId) return () => {};
  const { db } = sdk();
  return onSnapshot(
    query(collection(db, "auditLogs"), where("metadata.businessId", "==", businessId), limit(100)),
    (snapshot) => callback(newest(list(snapshot)).slice(0, 50)),
    onError
  );
}

export function subscribeAllPayouts(callback, options = {}) {
  const { db } = sdk();
  const constraints = [];
  if (options.status) constraints.push(where("status", "==", options.status));
  constraints.push(orderBy("createdAt", "desc"), limit(options.limit || 250));
  return onSnapshot(query(collection(db, "payouts"), ...constraints), (snapshot) => callback(list(snapshot)), options.onError);
}

export async function updatePayout(id, values, actor) {
  return authenticatedFetch("/api/payouts", { method: "POST", body: JSON.stringify({ action: "update", payoutId: id, status: values.status, reference: values.reference || "" }) });
}

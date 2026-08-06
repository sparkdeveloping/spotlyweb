"use client";

import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
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
import { normalizeSearchTerms, writeAuditLog } from "@/lib/firebase-services";

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
  await writeAuditLog({
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
    query(collection(db, "promotions"), where("businessId", "==", businessId), orderBy("createdAt", "desc"), limit(100)),
    (snapshot) => callback(list(snapshot)),
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

  await writeAuditLog({
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
  await writeAuditLog({
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
        active: options.active !== false,
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
        searchTerms: normalizeSearchTerms(item.name, item.category, item.sku, item.barcode),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: actor?.uid || null
      }));
    });
    await batch.commit();
  }

  await writeAuditLog({
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
  valid.slice(0, 100).forEach((item) => {
    const productRef = doc(collection(db, "products"));
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
      searchTerms: normalizeSearchTerms(item.name, item.category, item.sku, item.barcode, item.venue),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: actor?.uid || null
    }));
  });
  await batch.commit();
  await writeAuditLog({
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
  const { db } = sdk();
  let active = true;
  return onSnapshot(
    query(collection(db, "memberships"), where("businessIds", "array-contains", businessId), limit(250)),
    async (snapshot) => {
      try {
        const memberships = list(snapshot);
        const enriched = await Promise.all(memberships.map(async (membership) => {
          if (membership.displayName && membership.email) return membership;
          const userSnapshot = membership.userId ? await getDoc(doc(db, "users", membership.userId)) : null;
          const profile = userSnapshot?.exists() ? userSnapshot.data() : {};
          return {
            ...membership,
            displayName: membership.displayName || profile.displayName || profile.email || "Team member",
            email: membership.email || profile.email || ""
          };
        }));
        if (active) callback(enriched);
      } catch (error) {
        onError?.(error);
      }
    },
    onError
  );
}

export async function updateBusinessMembership(membershipId, values, actor) {
  const { db } = sdk();
  await updateDoc(doc(db, "memberships", membershipId), clean({
    role: values.role,
    permissions: values.permissions || [],
    branchIds: values.branchIds || [],
    status: values.status || "active",
    updatedAt: serverTimestamp(),
    updatedBy: actor?.uid || null
  }));
  await writeAuditLog({
    action: "business_membership.updated",
    entityType: "membership",
    entityId: membershipId,
    actorId: actor?.uid,
    actorEmail: actor?.email
  });
}

export async function revokeBusinessInvitation(invitationId, actor) {
  const { db } = sdk();
  await updateDoc(doc(db, "businessInvitations", invitationId), {
    status: "revoked",
    revokedAt: serverTimestamp(),
    revokedBy: actor?.uid || null,
    updatedAt: serverTimestamp()
  });
}

export async function resendBusinessInvitation(invitationId, actor) {
  const { db } = sdk();
  await updateDoc(doc(db, "businessInvitations", invitationId), {
    status: "pending",
    resendCount: increment(1),
    lastSentAt: serverTimestamp(),
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: serverTimestamp(),
    updatedBy: actor?.uid || null
  });
}

export async function deleteBranch(branchId, businessId, actor) {
  const { db } = sdk();
  const branches = await getDocs(query(collection(db, "branches"), where("businessId", "==", businessId), limit(10)));
  if (branches.size <= 1) throw new Error("A business must keep at least one branch. Edit this branch instead.");
  await deleteDoc(doc(db, "branches", branchId));
  await updateDoc(doc(db, "businesses", businessId), {
    branchIds: arrayRemove(branchId),
    branchCount: increment(-1),
    updatedAt: serverTimestamp()
  });
  await writeAuditLog({
    action: "branch.deleted",
    entityType: "branch",
    entityId: branchId,
    actorId: actor?.uid,
    actorEmail: actor?.email,
    metadata: { businessId }
  });
}

export async function updateBusinessOrder(order, changes, actor, note = "") {
  const { db } = sdk();
  const orderRef = doc(db, "orders", order.id);
  const nextStatus = changes.status || order.status;
  const timelineEntry = {
    status: nextStatus,
    note: note || changes.note || "",
    at: new Date().toISOString(),
    actorId: actor?.uid || null,
    actorName: actor?.displayName || actor?.email || "Business team"
  };
  await updateDoc(orderRef, clean({
    ...changes,
    timeline: arrayUnion(timelineEntry),
    updatedAt: serverTimestamp(),
    updatedBy: actor?.uid || null
  }));
  await addDoc(collection(db, "orderEvents"), clean({
    orderId: order.id,
    type: "order_updated",
    status: nextStatus,
    note,
    actorId: actor?.uid || null,
    createdAt: serverTimestamp()
  }));
  if (order.customerId) {
    await addDoc(collection(db, "notifications"), {
      userId: order.customerId,
      businessId: order.businessId,
      orderId: order.id,
      title: `Order ${order.number || order.id.slice(0, 8)}`,
      body: note || `Your order is now ${String(nextStatus).replaceAll("_", " ")}.`,
      href: `/marketplace?order=${order.id}`,
      category: "order",
      read: false,
      createdAt: serverTimestamp()
    });
  }
}

export async function requestBusinessPublicationReview(business, actor) {
  const { db } = sdk();
  const taskRef = doc(collection(db, "adminTasks"));
  const batch = writeBatch(db);
  batch.set(taskRef, {
    type: "business_publication_review",
    businessId: business.id,
    businessName: business.name,
    status: "open",
    priority: "normal",
    requestedBy: actor?.uid || null,
    requestedByEmail: actor?.email || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  batch.set(doc(db, "businesses", business.id), {
    status: "pending_publication_review",
    publicationReviewRequestedAt: serverTimestamp(),
    publicationReviewRequestedBy: actor?.uid || null,
    updatedAt: serverTimestamp()
  }, { merge: true });
  await batch.commit();
  await writeAuditLog({
    action: "business.publication_review_requested",
    entityType: "business",
    entityId: business.id,
    actorId: actor?.uid,
    actorEmail: actor?.email
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
    query(collection(db, "payouts"), where("businessId", "==", businessId), orderBy("createdAt", "desc"), limit(100)),
    (snapshot) => callback(list(snapshot)),
    onError
  );
}

export async function requestPayout(businessId, amount, currency, actor) {
  const numeric = Number(amount || 0);
  if (numeric <= 0) throw new Error("Enter a payout amount greater than zero.");
  const { db } = sdk();
  const payoutRef = doc(collection(db, "payouts"));
  await setDoc(payoutRef, {
    businessId,
    amount: numeric,
    currency: currency || "USD",
    status: "requested",
    requestedBy: actor?.uid || null,
    requestedByEmail: actor?.email || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return payoutRef.id;
}

export function subscribeBusinessActivity(businessId, callback, onError) {
  if (!businessId) return () => {};
  const { db } = sdk();
  return onSnapshot(
    query(collection(db, "auditLogs"), where("metadata.businessId", "==", businessId), orderBy("createdAt", "desc"), limit(50)),
    (snapshot) => callback(list(snapshot)),
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
  const { db } = sdk();
  await updateDoc(doc(db, "payouts", id), clean({
    ...values,
    updatedAt: serverTimestamp(),
    updatedBy: actor?.uid || null
  }));
  await writeAuditLog({
    action: `payout.${values.status || "updated"}`,
    entityType: "payout",
    entityId: id,
    actorId: actor?.uid,
    actorEmail: actor?.email,
    metadata: values
  });
}

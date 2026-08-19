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
import { deleteObject, getDownloadURL, ref, uploadBytes, uploadBytesResumable } from "firebase/storage";
import { getFirebaseAnalytics, getFirebaseClient } from "@/lib/firebase";
import { logEvent } from "firebase/analytics";
import { authenticatedFetch, publicApiFetch } from "@/lib/api-client";

export { DEFAULT_PLATFORM_SETTINGS } from "@/lib/platform-defaults";
import { DEFAULT_PLATFORM_SETTINGS } from "@/lib/platform-defaults";

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
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, clean(item)]));
  }
  return value;
}

export function normalizeSearchTerms(...values) {
  const combined = values.filter(Boolean).join(" ").toLowerCase().replace(/[^a-z0-9\s-]/g, " ");
  const words = combined.split(/\s+/).filter(Boolean);
  const prefixes = new Set();
  words.forEach((word) => {
    for (let index = 2; index <= Math.min(word.length, 18); index += 1) prefixes.add(word.slice(0, index));
  });
  words.forEach((word) => prefixes.add(word));
  return [...prefixes].slice(0, 120);
}

export async function track(name, parameters = {}) {
  try {
    const analytics = await getFirebaseAnalytics();
    if (analytics) logEvent(analytics, name, clean(parameters));
  } catch {
    // Analytics must never block the product experience.
  }
}

export async function writeClientTelemetry({ action, entityType, entityId, metadata = {}, actorId, actorEmail }) {
  if (!actorId) return null;
  try {
    const { db } = sdk();
    return await addDoc(collection(db, "clientTelemetry"), clean({
      action, entityType, entityId, metadata, actorId, actorEmail: actorEmail || null, createdAt: serverTimestamp()
    }));
  } catch {
    // Untrusted client telemetry is best-effort and must never block the user action it describes.
    return null;
  }
}

export async function ensureUserProfile(user, extras = {}) {
  if (!user) return null;
  const { db } = sdk();
  const profileRef = doc(db, "users", user.uid);
  const snapshot = await getDoc(profileRef);
  const providers = user.providerData.map((provider) => provider.providerId);
  const payload = clean({
    uid: user.uid,
    email: user.email || extras.email || "",
    displayName: user.displayName || extras.displayName || "",
    phoneNumber: user.phoneNumber || extras.phoneNumber || "",
    photoURL: user.photoURL || "",
    providers,
    locale: extras.locale || "en",
    lastSeenAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  if (!snapshot.exists()) {
    await setDoc(profileRef, { ...payload, roles: ["customer"], status: "active", createdAt: serverTimestamp() });
  } else {
    await setDoc(profileRef, payload, { merge: true });
  }
  return profileRef;
}

export async function saveUserPreferences(uid, preferences) {
  if (!uid) throw new Error("Sign in to save account preferences.");
  const { db } = sdk();
  await setDoc(doc(db, "users", uid), clean({ preferences, locale: preferences.language || undefined, updatedAt: serverTimestamp() }), { merge: true });
}

export async function saveUserProfileDetails(uid, values) {
  if (!uid) throw new Error("Sign in to update your profile.");
  const { db } = sdk();
  await setDoc(doc(db, "users", uid), clean({ ...values, updatedAt: serverTimestamp() }), { merge: true });
}

export function subscribeUserProfile(uid, callback, onError) {
  if (!uid) return () => {};
  const { db } = sdk();
  return onSnapshot(doc(db, "users", uid), (snapshot) => callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null), onError);
}

export function subscribePlatformSettings(callback, onError) {
  const { db } = sdk();
  return onSnapshot(doc(db, "platformSettings", "global"), (snapshot) => {
    callback(snapshot.exists() ? mergeSettings(DEFAULT_PLATFORM_SETTINGS, snapshot.data()) : DEFAULT_PLATFORM_SETTINGS);
  }, onError);
}

function mergeSettings(base, override) {
  return Object.fromEntries(Object.entries(base).map(([key, value]) => [
    key,
    value && typeof value === "object" && !Array.isArray(value)
      ? { ...value, ...(override?.[key] || {}) }
      : override?.[key] ?? value
  ]));
}

export async function savePlatformSettings(settings, actor) {
  const { db } = sdk();
  await setDoc(doc(db, "platformSettings", "global"), clean({ ...settings, updatedAt: serverTimestamp(), updatedBy: actor?.uid || null }), { merge: true });
  await writeClientTelemetry({ action: "platform_settings.updated", entityType: "platformSettings", entityId: "global", actorId: actor?.uid, actorEmail: actor?.email });
}

export async function joinWaitlist(payload) {
  const result = await publicApiFetch("/api/public/waitlist", { method: "POST", body: JSON.stringify(payload) });
  await track(result.alreadyJoined ? "waitlist_updated" : "waitlist_joined", { source: payload.source || "coming_soon", city: payload.city || "" });
  return result;
}

export async function submitPartnershipLead(payload) {
  const result = await publicApiFetch("/api/public/partnership", { method: "POST", body: JSON.stringify(payload) });
  await track("partnership_lead_submitted", { type: payload.type || "general" });
  return result.id;
}

export async function searchBusinesses(searchText, max = 20) {
  const { db } = sdk();
  const term = searchText.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ");
  if (!term) {
    const snapshot = await getDocs(query(collection(db, "businesses"), where("public", "==", true), orderBy("name"), limit(max)));
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  }
  const tokens = term.split(" ").filter((item) => item.length >= 2);
  const lookup = (tokens.sort((a, b) => b.length - a.length)[0] || term).slice(0, 18);
  const snapshot = await getDocs(query(collection(db, "businesses"), where("public", "==", true), where("searchTerms", "array-contains", lookup), limit(Math.min(100, Math.max(max * 4, 32)))));
  const records = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).filter((item) => item.status !== "archived" && !item.canonicalBusinessId);
  const matches = records.filter((item) => {
    const haystack = [item.name, item.brandName, item.branchName, item.category, item.city, item.phone, item.instagram, ...(item.aliases || [])].filter(Boolean).join(" ").toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  });
  return (matches.length ? matches : records).slice(0, max);
}

export function isCustomerLiveBusiness(item = {}) {
  const state = String(item.lifecycleStatus || "").toLowerCase();
  const currentStatus = String(item.status || "").toLowerCase();
  return item.public === true && (["active", "paused"].includes(currentStatus) || ["live", "paused"].includes(state));
}

export async function searchLiveBusinesses(searchText, max = 20) {
  const candidates = await searchBusinesses(searchText, Math.min(Math.max(max * 4, max), 250));
  return candidates.filter(isCustomerLiveBusiness).slice(0, max);
}

export async function getFeaturedBusinesses(featuredIds = [], max = 6) {
  if (!featuredIds.length) return [];
  const records = await Promise.all(featuredIds.slice(0, max).map((id) => getBusiness(id).catch(() => null)));
  return records.filter((item) => item && isCustomerLiveBusiness(item) && ["approved", "verified"].includes(item.verificationStatus));
}

export async function getBusiness(id) {
  const { db } = sdk();
  const snapshot = await getDoc(doc(db, "businesses", id));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}


function sortBranchRecords(records = []) {
  return [...records].sort((a, b) => String(a.branchName || a.name || a.displayName || "").localeCompare(String(b.branchName || b.name || b.displayName || ""), "en", { sensitivity: "base" }));
}

function sortProductRecords(records = []) {
  return [...records].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "en", { sensitivity: "base" }));
}

function sortNewestFirst(records = []) {
  const time = (value) => {
    if (!value) return 0;
    if (typeof value?.toMillis === "function") return value.toMillis();
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  };
  return [...records].sort((a, b) => time(b.updatedAt || b.createdAt || b.submittedAt) - time(a.updatedAt || a.createdAt || a.submittedAt));
}

export function notifyBranchesChanged(businessId) {
  if (typeof window === "undefined" || !businessId) return;
  window.dispatchEvent(new CustomEvent("spotly:branches-changed", { detail: { businessId } }));
}

export async function getBranchesForBusiness(businessId) {
  if (!businessId) return [];
  const payload = await authenticatedFetch(`/api/business/branches?businessId=${encodeURIComponent(businessId)}`, { cache: "no-store" });
  return sortBranchRecords(payload.branches || []);
}

export async function getPublicBranchesForBusiness(businessId) {
  if (!businessId) return [];
  const { db } = sdk();
  // Keep this query independent of the businessId+public+name composite index. Security rules
  // still require public==true for anonymous/public reads; ordering is stable client-side.
  const snapshot = await getDocs(query(collection(db, "branches"), where("businessId", "==", businessId), where("public", "==", true), limit(100)));
  return sortBranchRecords(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
}

export function subscribeBusinesses(callback, options = {}) {
  const { db } = sdk();
  const constraints = [];
  if (options.claimStatus) constraints.push(where("claimStatus", "==", options.claimStatus));
  constraints.push(orderBy("name"), limit(options.limit || 100));
  return onSnapshot(query(collection(db, "businesses"), ...constraints), (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).filter((item) => item.status !== "archived" && !item.canonicalBusinessId)), options.onError);
}

export async function saveClaimDraft(userId, draft) {
  if (!userId) throw new Error("Sign in to save this claim across devices.");
  const { db } = sdk();
  const id = draft.id || `claim_${Date.now()}`;
  await setDoc(doc(db, "businessClaimDrafts", `${userId}_${id}`), clean({ ...draft, id, applicantId: userId, status: "draft", updatedAt: serverTimestamp(), createdAt: draft.createdAt || serverTimestamp() }), { merge: true });
  return id;
}

export function subscribeClaimDrafts(userId, callback, onError) {
  if (!userId) return () => {};
  const { db } = sdk();
  return onSnapshot(query(collection(db, "businessClaimDrafts"), where("applicantId", "==", userId), orderBy("updatedAt", "desc"), limit(25)), (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.data().id || item.id.split("_").slice(1).join("_"), recordId: item.id, ...item.data() }))), onError);
}

export async function getClaimDraft(userId, draftId) {
  if (!userId || !draftId) return null;
  const { db } = sdk();
  const snapshot = await getDoc(doc(db, "businessClaimDrafts", `${userId}_${draftId}`));
  return snapshot.exists() ? { recordId: snapshot.id, ...snapshot.data() } : null;
}

export async function deleteClaimDraft(userId, draftId) {
  if (!userId || !draftId) return;
  const { db } = sdk();
  await deleteDoc(doc(db, "businessClaimDrafts", `${userId}_${draftId}`));
}

export function subscribeClaim(claimId, callback, onError) {
  if (!claimId) return () => {};
  const { db } = sdk();
  return onSnapshot(doc(db, "businessClaims", claimId), (snapshot) => callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null), onError);
}

export async function deleteClaimEvidence(path) {
  if (!path) return;
  const { storage } = sdk();
  await deleteObject(ref(storage, path));
}

export function uploadClaimEvidence(userId, draftId, file, onProgress) {
  if (!userId) return Promise.reject(new Error("Sign in before uploading evidence."));
  const { storage } = sdk();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileRef = ref(storage, `claim-evidence/${userId}/${draftId}/${Date.now()}-${safeName}`);
  const task = uploadBytesResumable(fileRef, file, { contentType: file.type, customMetadata: { userId, draftId, originalName: file.name } });
  return new Promise((resolve, reject) => {
    task.on("state_changed", (snapshot) => onProgress?.(Math.round((snapshot.bytesTransferred / Math.max(snapshot.totalBytes, 1)) * 100)), reject, async () => {
      resolve({ name: file.name, type: file.type, size: file.size, path: fileRef.fullPath, url: await getDownloadURL(fileRef), uploadedAt: new Date().toISOString() });
    });
  });
}

export function subscribeClaims(callback, options = {}) {
  const { db } = sdk();
  const constraints = [orderBy("createdAt", "desc"), limit(options.limit || 100)];
  if (options.applicantId) constraints.unshift(where("applicantId", "==", options.applicantId));
  if (options.status) constraints.unshift(where("status", "==", options.status));
  return onSnapshot(query(collection(db, "businessClaims"), ...constraints), (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), options.onError);
}

export async function decideBusinessClaim(claim, decision, actor, reason = "") {
  const response = await authenticatedFetch("/api/admin/business-claims/decision", {
    method: "POST",
    body: JSON.stringify({ claimId: claim.id, decision, reason })
  });
  return response;
}

export async function saveBusinessProfile(businessId, values, user) {
  const { db } = sdk();
  const businessRef = doc(db, "businesses", businessId);
  const searchableKeys = ["name", "brandName", "legalName", "category", "categories", "city", "address", "phone", "instagram"];
  const updatesSearch = searchableKeys.some((key) => Object.prototype.hasOwnProperty.call(values, key));
  let searchTerms;

  if (updatesSearch) {
    const currentSnapshot = await getDoc(businessRef);
    const current = currentSnapshot.exists() ? currentSnapshot.data() : {};
    const merged = { ...current, ...values };
    searchTerms = normalizeSearchTerms(
      merged.name,
      merged.brandName,
      merged.legalName,
      merged.category,
      ...(Array.isArray(merged.categories) ? merged.categories : []),
      merged.city,
      merged.address,
      merged.phone,
      merged.instagram
    );
  }

  await setDoc(businessRef, clean({
    ...values,
    ...(updatesSearch ? { searchTerms } : {}),
    updatedAt: serverTimestamp(),
    updatedBy: user?.uid || null
  }), { merge: true });
  await writeClientTelemetry({ action: "business.updated", entityType: "business", entityId: businessId, actorId: user?.uid, actorEmail: user?.email });
}

export function subscribeMemberships(uid, callback, onError) {
  if (!uid) return () => {};
  const { db } = sdk();
  return onSnapshot(query(collection(db, "memberships"), where("userId", "==", uid), where("status", "==", "active")), (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), onError);
}

export function subscribeBusinessCatalog(businessId, callback, onError) {
  if (!businessId) return () => {};
  const { db } = sdk();
  // Business catalogue reads must not disappear just because a composite sort index was not
  // deployed with the web release. Scope by business in Firestore, then sort deterministically
  // in the client. This also keeps legacy products without a `name` index entry visible.
  return onSnapshot(
    query(collection(db, "products"), where("businessId", "==", businessId), limit(500)),
    (snapshot) => callback(sortProductRecords(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))),
    onError
  );
}

export function subscribePublicBusinessCatalog(businessId, callback, onError) {
  if (!businessId) return () => {};
  const { db } = sdk();
  // Equality filters can use Firestore index merging; removing orderBy avoids making the public
  // catalogue depend on a separate businessId+published+active+name composite index.
  return onSnapshot(
    query(collection(db, "products"), where("businessId", "==", businessId), where("published", "==", true), where("active", "==", true), limit(500)),
    (snapshot) => callback(sortProductRecords(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))),
    onError
  );
}

export async function saveProduct(product, businessId, user) {
  const { db } = sdk();
  const productRef = product.id ? doc(db, "products", product.id) : doc(collection(db, "products"));
  await setDoc(productRef, clean({
    businessId,
    name: product.name,
    description: product.description || "",
    category: product.category || "General",
    image: product.image || "",
    imageStoragePath: product.imageStoragePath || "",
    imageRightsStatus: product.imageRightsStatus || (product.image ? "merchant_owned" : ""),
    imageSourceType: product.imageSourceType || (product.image ? "merchant_owned" : ""),
    imageProvenance: product.imageProvenance || null,
    masterProductId: product.masterProductId || null,
    brand: product.brand || "",
    variant: product.variant || "",
    packSize: product.packSize || "",
    manufacturerSku: product.manufacturerSku || "",
    publicationState: product.publicationState || (product.published ? "published" : "draft"),
    branchOverrides: product.branchOverrides || {},
    currency: product.currency || "USD",
    price: Number(product.price || 0),
    compareAtPrice: product.compareAtPrice ? Number(product.compareAtPrice) : null,
    sku: product.sku || "",
    barcode: product.barcode || "",
    stockMode: product.stockMode || "status",
    stockQuantity: Number(product.stockQuantity || 0),
    stockStatus: product.stockStatus || "in_stock",
    active: product.active !== false,
    pickupEligible: product.pickupEligible !== false,
    substitutionAllowed: product.substitutionAllowed !== false,
    itemType: product.itemType || "product",
    durationMinutes: Number(product.durationMinutes || 0),
    capacity: Number(product.capacity || 0),
    startsAt: product.startsAt || null,
    endsAt: product.endsAt || null,
    venue: product.venue || "",
    requiresBusinessReview: Boolean(product.requiresBusinessReview),
    published: Boolean(product.published),
    publishedAt: product.publishedAt || null,
    branchIds: product.branchIds || [],
    prices: product.prices || { [product.currency || "USD"]: Number(product.price || 0) },
    searchTerms: normalizeSearchTerms(product.name, product.category, product.sku, product.barcode),
    createdAt: product.id ? product.createdAt || serverTimestamp() : serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: user?.uid || null
  }), { merge: true });
  return productRef.id;
}

export async function removeProduct(productId, actor) {
  const { db } = sdk();
  await deleteDoc(doc(db, "products", productId));
  await writeClientTelemetry({ action: "product.deleted", entityType: "product", entityId: productId, actorId: actor?.uid, actorEmail: actor?.email });
}

export function subscribeOrdersForBusiness(businessId, callback, onError) {
  if (!businessId) return () => {};
  const { db } = sdk();
  // Keep the live Business queue resilient even when Firebase composite indexes lag a deploy.
  return onSnapshot(
    query(collection(db, "orders"), where("businessId", "==", businessId), limit(500)),
    (snapshot) => callback(sortNewestFirst(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))),
    onError
  );
}

export async function updateOrderStatus(orderId, status, actor, note = "") {
  return authenticatedFetch("/api/business-orders/update", { method: "POST", body: JSON.stringify({ orderId, changes: { status }, note }) });
}

export async function createSupportConversation(payload, user) {
  const result = await authenticatedFetch("/api/support/conversations", { method: "POST", body: JSON.stringify({ action: "create", ...payload }) });
  await track("support_conversation_opened", { category: payload.category || "general" });
  return result.conversationId;
}

export function subscribeSupportConversations(callback, options = {}) {
  const { db } = sdk();
  const constraints = [];
  if (options.requesterId) constraints.push(where("requesterId", "==", options.requesterId));
  if (options.businessId) constraints.push(where("businessId", "==", options.businessId));
  if (options.status) constraints.push(where("status", "==", options.status));
  constraints.push(limit(Math.max(options.limit || 100, 100)));
  return onSnapshot(query(collection(db, "supportConversations"), ...constraints), (snapshot) => {
    const records = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => {
      const time = (value) => value?.toMillis?.() ?? (Number.isFinite(Date.parse(value || "")) ? Date.parse(value) : 0);
      return time(b.lastMessageAt || b.updatedAt || b.createdAt) - time(a.lastMessageAt || a.updatedAt || a.createdAt);
    });
    callback(records.slice(0, options.limit || 100));
  }, options.onError);
}

export function subscribeSupportMessages(conversationId, callback, onError) {
  if (!conversationId) return () => {};
  const { db } = sdk();
  return onSnapshot(query(collection(db, "supportMessages"), where("conversationId", "==", conversationId), limit(500)), (snapshot) => {
    const records = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => {
      const av = a.createdAt?.toMillis?.() ?? (Date.parse(a.createdAt || 0) || 0);
      const bv = b.createdAt?.toMillis?.() ?? (Date.parse(b.createdAt || 0) || 0);
      return av - bv;
    });
    callback(records);
  }, onError);
}

export async function sendSupportMessage(conversationId, body, user, options = {}) {
  return authenticatedFetch("/api/support/conversations", { method: "POST", body: JSON.stringify({
    action: "message", conversationId, body, attachments: options.attachments || [], context: options.context || null, internal: Boolean(options.internal), status: options.status, senderName: options.senderName, senderRole: options.senderRole
  }) });
}

export async function updateSupportConversation(id, values, actor) {
  const safeValues = { status: values.status, assignedTo: values.assignedTo, priority: values.priority, satisfaction: values.satisfaction };
  return authenticatedFetch("/api/support/conversations", { method: "POST", body: JSON.stringify({ action: "update", conversationId: id, ...clean(safeValues) }) });
}

export async function uploadSupportAttachment(conversationId, file, userId, onProgress) {
  if (!conversationId) throw new Error("Start the conversation before adding an attachment.");
  const { storage } = sdk();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileRef = ref(storage, `support/${conversationId}/${userId || "anonymous"}/${Date.now()}-${safeName}`);
  const task = uploadBytesResumable(fileRef, file, {
    contentType: file.type,
    contentDisposition: `attachment; filename="${safeName}"`,
    customMetadata: clean({ conversationId, userId: userId || "anonymous", originalName: file.name, scanStatus: "unscanned" })
  });
  return new Promise((resolve, reject) => {
    task.on("state_changed", (snapshot) => onProgress?.(Math.round((snapshot.bytesTransferred / Math.max(snapshot.totalBytes, 1)) * 100)), reject, async () => {
      resolve({ name: file.name, type: file.type, size: file.size, path: fileRef.fullPath, url: await getDownloadURL(fileRef) });
    });
  });
}

export async function closeSupportConversation(id, user) {
  return updateSupportConversation(id, { status: "closed" }, user);
}

export async function reopenSupportConversation(id, user) {
  return updateSupportConversation(id, { status: "open" }, user);
}

export async function rateSupportConversation(id, rating, user) {
  return updateSupportConversation(id, { satisfaction: rating }, user);
}

export async function uploadFile(path, file, metadata = {}) {
  const { storage } = sdk();
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file, { customMetadata: clean(metadata), contentType: file.type });
  return getDownloadURL(fileRef);
}

export async function seedClientData(seed) {
  const { db } = sdk();
  const batchSize = 400;
  for (let offset = 0; offset < seed.businesses.length; offset += batchSize) {
    const batch = writeBatch(db);
    seed.businesses.slice(offset, offset + batchSize).forEach((business) => {
      const id = business.id;
      batch.set(doc(db, "businesses", id), clean({ ...business, searchTerms: normalizeSearchTerms(business.name, business.category, business.city, ...(business.aliases || [])), createdAt: serverTimestamp(), updatedAt: serverTimestamp() }), { merge: true });
    });
    await batch.commit();
  }
  await setDoc(doc(db, "platformSettings", "global"), DEFAULT_PLATFORM_SETTINGS, { merge: true });
}

export function defaultOpeningHours() {
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

export async function upsertProvisionalBusiness(business) {
  const { db } = sdk();
  await setDoc(doc(db, "businesses", business.id), clean({
    ...business,
    searchTerms: normalizeSearchTerms(business.name, business.brandName, business.category, business.city, ...(business.aliases || [])),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }), { merge: true });
  return business.id;
}

export function subscribeHelpResources(callback, options = {}) {
  const { db } = sdk();
  const constraints = [];
  if (options.audience) constraints.push(where("audience", "array-contains", options.audience));
  constraints.push(orderBy("order"), limit(options.limit || 100));
  return onSnapshot(query(collection(db, "helpResources"), ...constraints), (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), options.onError);
}

export async function saveHelpResource(resource, actor) {
  const { db } = sdk();
  const resourceRef = resource.id ? doc(db, "helpResources", resource.id) : doc(collection(db, "helpResources"));
  await setDoc(resourceRef, clean({
    title: resource.title,
    description: resource.description || "",
    type: resource.type || "article",
    youtubeId: resource.youtubeId || "",
    url: resource.url || "",
    category: resource.category || "Getting started",
    language: resource.language || "en",
    audience: resource.audience || ["public", "business"],
    published: resource.published !== false,
    order: Number(resource.order || 0),
    updatedAt: serverTimestamp(),
    updatedBy: actor?.uid || null,
    createdAt: resource.id ? resource.createdAt || serverTimestamp() : serverTimestamp()
  }), { merge: true });
  return resourceRef.id;
}

export async function deleteHelpResource(id, actor) {
  const { db } = sdk();
  await deleteDoc(doc(db, "helpResources", id));
  await writeClientTelemetry({ action: "help_resource.deleted", entityType: "helpResource", entityId: id, actorId: actor?.uid, actorEmail: actor?.email });
}

export function subscribeAnnouncements(callback, options = {}) {
  const { db } = sdk();
  const constraints = [];
  if (options.activeOnly) constraints.push(where("active", "==", true));
  constraints.push(orderBy("createdAt", "desc"), limit(options.limit || 50));
  return onSnapshot(query(collection(db, "announcements"), ...constraints), (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), options.onError);
}

export async function saveAnnouncement(announcement, actor) {
  const { db } = sdk();
  const announcementRef = announcement.id ? doc(db, "announcements", announcement.id) : doc(collection(db, "announcements"));
  await setDoc(announcementRef, clean({
    title: announcement.title,
    message: announcement.message,
    audience: announcement.audience || ["all"],
    priority: announcement.priority || "normal",
    active: announcement.active !== false,
    startsAt: announcement.startsAt || null,
    endsAt: announcement.endsAt || null,
    createdAt: announcement.id ? announcement.createdAt || serverTimestamp() : serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: actor?.uid || null
  }), { merge: true });
  return announcementRef.id;
}

export function subscribeBusiness(businessId, callback, onError) {
  if (!businessId) return () => {};
  const { db } = sdk();
  return onSnapshot(doc(db, "businesses", businessId), (snapshot) => callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null), onError);
}

export function subscribeBranches(businessId, callback, onError) {
  if (!businessId) return () => {};
  let active = true;
  let timer = null;
  let requestVersion = 0;

  async function load() {
    if (!active) return;
    const version = ++requestVersion;
    try {
      const records = await getBranchesForBusiness(businessId);
      // A slow old request must never overwrite a newer explicit refresh after a save.
      if (active && version === requestVersion) callback(records);
    } catch (error) {
      if (active && version === requestVersion) onError?.(error);
    } finally {
      if (active && version === requestVersion) timer = window.setTimeout(load, 15000);
    }
  }

  function refresh(event) {
    if (!event?.detail?.businessId || event.detail.businessId === businessId) {
      if (timer) window.clearTimeout(timer);
      timer = null;
      // Incrementing inside load makes any already-running request stale.
      load();
    }
  }

  window.addEventListener("spotly:branches-changed", refresh);
  load();
  return () => {
    active = false;
    requestVersion += 1;
    if (timer) window.clearTimeout(timer);
    window.removeEventListener("spotly:branches-changed", refresh);
  };
}

export function subscribePublicBranches(businessId, callback, onError) {
  if (!businessId) return () => {};
  const { db } = sdk();
  return onSnapshot(query(collection(db, "branches"), where("businessId", "==", businessId), where("public", "==", true), limit(100)), (snapshot) => callback(sortBranchRecords(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))), onError);
}

export async function saveBranch(branch, businessId, organizationId, actor, options = {}) {
  const response = await authenticatedFetch("/api/business/branches", {
    method: "POST",
    body: JSON.stringify({ action: "upsert", businessId, branch: { ...branch, organizationId }, makePrimary: Boolean(options.makePrimary) })
  });
  await writeClientTelemetry({ action: branch.id ? "branch.updated.requested" : "branch.created.requested", entityType: "branch", entityId: response.branchId, actorId: actor?.uid, actorEmail: actor?.email, metadata: { businessId } });
  notifyBranchesChanged(businessId);
  return response.branchId;
}

export function subscribeBusinessInvitations(businessId, callback, onError) {
  if (!businessId) return () => {};
  let active = true;
  let timer = null;
  async function load() {
    try {
      const result = await authenticatedFetch(`/api/business-team?businessId=${encodeURIComponent(businessId)}`);
      if (active) callback(result.invitations || []);
    } catch (error) {
      if (active) onError?.(error);
    } finally {
      if (active) timer = setTimeout(load, 15000);
    }
  }
  load();
  return () => { active = false; if (timer) clearTimeout(timer); };
}

export async function inviteBusinessStaff(invitation, business) {
  const payload = await authenticatedFetch("/api/business-team", {
    method: "POST",
    body: JSON.stringify({
      action: "invite",
      businessId: business.id,
      name: invitation.name || "",
      email: invitation.email,
      role: invitation.role || "order_staff",
      branchIds: invitation.branchIds || [],
      permissions: invitation.permissions || []
    })
  });
  return payload.invitationId;
}

export function subscribeBusinessClaimsForBusiness(businessId, callback, onError) {
  if (!businessId) return () => {};
  const { db } = sdk();
  return onSnapshot(
    query(collection(db, "businessClaims"), where("businessId", "==", businessId), limit(100)),
    (snapshot) => callback(sortNewestFirst(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))),
    onError
  );
}

export async function saveBusinessFinanceSettings(businessId, finance, actor) {
  const { db } = sdk();
  await setDoc(doc(db, "businessFinanceSettings", businessId), clean({
    businessId,
    acceptedCurrencies: finance.acceptedCurrencies || ["USD", "ZWG"],
    paymentMethods: finance.paymentMethods || ["cash", "paynow", "ecocash", "onemoney", "card", "bank_transfer"],
    paymentRecipient: finance.paymentRecipient || "platform",
    payoutCadence: finance.payoutCadence || "weekly",
    payoutMethod: finance.payoutMethod || "bank_transfer",
    bankName: finance.bankName || "",
    accountName: finance.accountName || "",
    accountNumberMasked: finance.accountNumberMasked || "",
    mobileMoneyNumber: finance.mobileMoneyNumber || "",
    taxNumber: finance.taxNumber || "",
    legalName: finance.legalName || "",
    companyRegistrationNumber: finance.companyRegistrationNumber || "",
    bankBranch: finance.bankBranch || "",
    mobileMoneyProvider: finance.mobileMoneyProvider || "ecocash",
    fiscalInvoiceEnabled: Boolean(finance.fiscalInvoiceEnabled),
    invoicePrefix: finance.invoicePrefix || "SPT",
    settlementReservePercent: Number(finance.settlementReservePercent || 0),
    payoutMinimum: Number(finance.payoutMinimum || 0),
    updatedAt: serverTimestamp(),
    updatedBy: actor?.uid || null
  }), { merge: true });
  await writeClientTelemetry({ action: "business_finance.updated", entityType: "businessFinanceSettings", entityId: businessId, actorId: actor?.uid, actorEmail: actor?.email });
}

export function subscribeBusinessFinanceSettings(businessId, callback, onError) {
  if (!businessId) return () => {};
  const { db } = sdk();
  return onSnapshot(doc(db, "businessFinanceSettings", businessId), (snapshot) => callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null), onError);
}

export function subscribeUsers(callback, options = {}) {
  const { db } = sdk();
  const constraints = [orderBy("updatedAt", "desc"), limit(options.limit || 250)];
  return onSnapshot(query(collection(db, "users"), ...constraints), (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), options.onError);
}

export async function saveUserAccess(userId, access, actor) {
  return authenticatedFetch("/api/admin/user-access", { method: "POST", body: JSON.stringify({
    userId, roles: access.roles || ["customer"], customPermissions: access.customPermissions || [], status: access.status || "active", privateBeta: Boolean(access.privateBeta)
  }) });
}

export function subscribeAuditLogs(callback, options = {}) {
  const { db } = sdk();
  return onSnapshot(query(collection(db, "auditLogs"), orderBy("createdAt", "desc"), limit(options.limit || 250)), (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), options.onError);
}

export function subscribeWaitlist(callback, options = {}) {
  const { db } = sdk();
  return onSnapshot(query(collection(db, "waitlistEntries"), orderBy("createdAt", "desc"), limit(options.limit || 500)), (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), options.onError);
}

export function subscribePartnershipLeads(callback, options = {}) {
  const { db } = sdk();
  return onSnapshot(query(collection(db, "partnershipLeads"), orderBy("createdAt", "desc"), limit(options.limit || 250)), (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), options.onError);
}

export async function updatePartnershipLead(id, values, actor) {
  const { db } = sdk();
  await updateDoc(doc(db, "partnershipLeads", id), clean({ ...values, updatedAt: serverTimestamp(), updatedBy: actor?.uid || null }));
  await writeClientTelemetry({ action: "partnership_lead.updated", entityType: "partnershipLead", entityId: id, actorId: actor?.uid, actorEmail: actor?.email, metadata: values });
}

export async function adminUpdateBusiness(id, values, actor) {
  const { db } = sdk();
  await setDoc(doc(db, "businesses", id), clean({
    ...values,
    searchTerms: normalizeSearchTerms(values.name, values.brandName, values.category, values.city, ...(values.aliases || [])),
    updatedAt: serverTimestamp(),
    updatedBy: actor?.uid || null
  }), { merge: true });
  await writeClientTelemetry({ action: "admin.business_updated", entityType: "business", entityId: id, actorId: actor?.uid, actorEmail: actor?.email, metadata: values });
}

export async function assignSupportConversation(id, assigneeId, actor) {
  return updateSupportConversation(id, { assignedTo: assigneeId || null, status: assigneeId ? "assigned" : "open" }, actor);
}

export async function saveRoleTemplate(role, actor) {
  const { db } = sdk();
  const roleRef = role.id ? doc(db, "roleTemplates", role.id) : doc(collection(db, "roleTemplates"));
  await setDoc(roleRef, clean({
    name: role.name,
    description: role.description || "",
    level: Number(role.level || 10),
    permissions: role.permissions || [],
    system: Boolean(role.system),
    updatedAt: serverTimestamp(),
    updatedBy: actor?.uid || null,
    createdAt: role.id ? role.createdAt || serverTimestamp() : serverTimestamp()
  }), { merge: true });
  return roleRef.id;
}

export function subscribeRoleTemplates(callback, options = {}) {
  const { db } = sdk();
  return onSnapshot(query(collection(db, "roleTemplates"), orderBy("level", "desc"), limit(options.limit || 100)), (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), options.onError);
}

export function subscribeCustomerOrders(userId, callback, onError) {
  if (!userId) return () => {};
  const { db } = sdk();
  return onSnapshot(
    query(collection(db, "orders"), where("customerId", "==", userId), orderBy("createdAt", "desc"), limit(100)),
    (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError
  );
}

export function subscribeOrder(orderId, callback, onError) {
  if (!orderId) return () => {};
  const { db } = sdk();
  return onSnapshot(doc(db, "orders", orderId), (snapshot) => callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null), onError);
}

export async function saveNotificationPreferences(userId, preferences) {
  const { db } = sdk();
  await setDoc(doc(db, "notificationPreferences", userId), clean({
    userId,
    ...preferences,
    updatedAt: serverTimestamp()
  }), { merge: true });
}

export function subscribeNotifications(userId, callback, onError) {
  if (!userId) return () => {};
  const { db } = sdk();
  return onSnapshot(
    query(collection(db, "notifications"), where("userId", "==", userId), orderBy("createdAt", "desc"), limit(100)),
    (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError
  );
}

export async function markNotificationRead(notificationId) {
  const { db } = sdk();
  await updateDoc(doc(db, "notifications", notificationId), { read: true, readAt: serverTimestamp() });
}

export async function saveFavorite(userId, businessId, saved = true) {
  const { db } = sdk();
  const favoriteRef = doc(db, "favorites", `${userId}_${businessId}`);
  if (!saved) return deleteDoc(favoriteRef);
  return setDoc(favoriteRef, { userId, businessId, createdAt: serverTimestamp() }, { merge: true });
}

export function subscribeFavorites(userId, callback, onError) {
  if (!userId) return () => {};
  const { db } = sdk();
  return onSnapshot(query(collection(db, "favorites"), where("userId", "==", userId)), (snapshot) => callback(snapshot.docs.map((item) => item.data().businessId)), onError);
}

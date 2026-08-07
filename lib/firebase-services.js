"use client";

import {
  addDoc,
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
import { getDownloadURL, ref, uploadBytes, uploadBytesResumable } from "firebase/storage";
import { getFirebaseAnalytics, getFirebaseClient } from "@/lib/firebase";
import { logEvent } from "firebase/analytics";

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

export async function writeAuditLog({ action, entityType, entityId, metadata = {}, actorId, actorEmail }) {
  const { db } = sdk();
  return addDoc(collection(db, "auditLogs"), clean({
    action,
    entityType,
    entityId,
    metadata,
    actorId: actorId || null,
    actorEmail: actorEmail || null,
    createdAt: serverTimestamp()
  }));
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
  await writeAuditLog({ action: "platform_settings.updated", entityType: "platformSettings", entityId: "global", actorId: actor?.uid, actorEmail: actor?.email });
}

export async function joinWaitlist(payload) {
  const { db } = sdk();
  const normalizedEmail = payload.email.trim().toLowerCase();
  const id = normalizedEmail.replace(/[^a-z0-9]/g, "_");
  const entryRef = doc(db, "waitlistEntries", id);
  const existing = await getDoc(entryRef);
  const values = clean({
    name: payload.name || "",
    city: payload.city || "",
    interests: payload.interests || [],
    locale: payload.locale || "en",
    consent: Boolean(payload.consent),
    source: payload.source || "coming_soon",
    email: normalizedEmail,
    updatedAt: serverTimestamp()
  });
  await setDoc(entryRef, existing.exists() ? values : { ...values, country: "ZW", status: "waiting", createdAt: serverTimestamp() }, { merge: true });
  await track("waitlist_joined", { source: payload.source || "coming_soon", city: payload.city || "" });
}

export async function submitPartnershipLead(payload) {
  const { db } = sdk();
  const result = await addDoc(collection(db, "partnershipLeads"), clean({ ...payload, status: "new", createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
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
  const snapshot = await getDocs(query(collection(db, "businesses"), where("searchTerms", "array-contains", lookup), limit(Math.min(100, Math.max(max * 4, 32)))));
  const records = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).filter((item) => item.status !== "archived" && !item.canonicalBusinessId);
  const matches = records.filter((item) => {
    const haystack = [item.name, item.brandName, item.branchName, item.category, item.city, item.phone, item.instagram, ...(item.aliases || [])].filter(Boolean).join(" ").toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  });
  return (matches.length ? matches : records).slice(0, max);
}

export async function getFeaturedBusinesses(featuredIds = [], max = 6) {
  if (!featuredIds.length) return [];
  const records = await Promise.all(featuredIds.slice(0, max).map((id) => getBusiness(id).catch(() => null)));
  return records.filter((item) => item && item.public && item.status !== "archived" && ["approved", "verified"].includes(item.verificationStatus));
}

export async function getBusiness(id) {
  const { db } = sdk();
  const snapshot = await getDoc(doc(db, "businesses", id));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function getBranchesForBusiness(businessId) {
  if (!businessId) return [];
  const { db } = sdk();
  const snapshot = await getDocs(query(collection(db, "branches"), where("businessId", "==", businessId), orderBy("name"), limit(100)));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export function subscribeBusinesses(callback, options = {}) {
  const { db } = sdk();
  const constraints = [];
  if (options.claimStatus) constraints.push(where("claimStatus", "==", options.claimStatus));
  constraints.push(orderBy("name"), limit(options.limit || 100));
  return onSnapshot(query(collection(db, "businesses"), ...constraints), (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).filter((item) => item.status !== "archived" && !item.canonicalBusinessId)), options.onError);
}

export async function createBusinessDraft(payload, user) {
  const { db } = sdk();
  const organizationRef = doc(collection(db, "organizations"));
  const businessRef = doc(collection(db, "businesses"));
  const branchRef = doc(collection(db, "branches"));
  const batch = writeBatch(db);
  const organization = clean({
    name: payload.organizationName || payload.name,
    ownerIds: user ? [user.uid] : [],
    status: "onboarding",
    businessIds: [businessRef.id],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  const business = clean({
    organizationId: organizationRef.id,
    name: payload.name,
    legalName: payload.legalName || "",
    description: payload.description || "",
    category: payload.category || "Groceries",
    categories: payload.categories || [payload.category || "Groceries"],
    phone: payload.phone || "",
    email: payload.email || user?.email || "",
    website: payload.website || "",
    instagram: payload.instagram || "",
    city: payload.city || "Harare",
    country: "ZW",
    currency: payload.currency || "USD",
    public: false,
    status: "draft",
    claimStatus: "claimed_pending_verification",
    verificationStatus: "not_submitted",
    ownerIds: user ? [user.uid] : [],
    branchIds: [branchRef.id],
    searchTerms: normalizeSearchTerms(payload.name, payload.category, payload.city, payload.phone, payload.instagram),
    source: { type: "owner_created", imported: false },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  const branch = clean({
    organizationId: organizationRef.id,
    businessId: businessRef.id,
    name: payload.branchName || `${payload.name} — ${payload.city || "Main branch"}`,
    city: payload.city || "Harare",
    address: payload.address || "",
    phone: payload.phone || "",
    status: "draft",
    public: false,
    fulfilment: ["pickup"],
    openingHours: defaultOpeningHours(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  batch.set(organizationRef, organization);
  batch.set(businessRef, business);
  batch.set(branchRef, branch);
  if (user) batch.set(doc(db, "memberships", `${organizationRef.id}_${user.uid}`), { organizationId: organizationRef.id, userId: user.uid, role: "owner", businessIds: [businessRef.id], branchIds: [branchRef.id], status: "active", createdAt: serverTimestamp() });
  await batch.commit();
  await writeAuditLog({ action: "business.created", entityType: "business", entityId: businessRef.id, actorId: user?.uid, actorEmail: user?.email });
  return { organizationId: organizationRef.id, businessId: businessRef.id, branchId: branchRef.id };
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

export async function submitBusinessClaim(payload, user) {
  const { db } = sdk();
  const claimRef = doc(collection(db, "businessClaims"));
  await setDoc(claimRef, clean({
    businessId: payload.businessId,
    organizationId: payload.organizationId || null,
    applicantId: user.uid,
    applicantEmail: user.email || payload.email || "",
    applicantName: payload.applicantName || user.displayName || "",
    phone: payload.phone || user.phoneNumber || "",
    roleAtBusiness: payload.roleAtBusiness || "owner",
    evidence: payload.evidence || [],
    notes: payload.notes || "",
    riskScore: payload.riskScore || 0,
    status: "submitted",
    verificationChecklist: {},
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }));
  await updateDoc(doc(db, "businesses", payload.businessId), { claimStatus: "claim_pending", updatedAt: serverTimestamp() });
  await writeAuditLog({ action: "business_claim.submitted", entityType: "businessClaim", entityId: claimRef.id, actorId: user.uid, actorEmail: user.email, metadata: { businessId: payload.businessId } });
  await track("business_claim_submitted", { business_id: payload.businessId });
  return claimRef.id;
}

export function subscribeClaims(callback, options = {}) {
  const { db } = sdk();
  const constraints = [orderBy("createdAt", "desc"), limit(options.limit || 100)];
  if (options.applicantId) constraints.unshift(where("applicantId", "==", options.applicantId));
  if (options.status) constraints.unshift(where("status", "==", options.status));
  return onSnapshot(query(collection(db, "businessClaims"), ...constraints), (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), options.onError);
}

export async function decideBusinessClaim(claim, decision, actor, reason = "") {
  const { db } = sdk();
  const batch = writeBatch(db);
  const status = decision === "approve" ? "approved" : decision === "request" ? "needs_information" : "rejected";
  batch.update(doc(db, "businessClaims", claim.id), { status, decisionReason: reason, reviewedBy: actor.uid, reviewedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  if (decision === "approve") {
    const newBusiness = claim.claimType === "new_business";
    const membershipRef = doc(db, "memberships", `${claim.organizationId || claim.businessId}_${claim.applicantId}`);
    const membershipSnapshot = await getDoc(membershipRef);
    batch.update(doc(db, "businesses", claim.businessId), {
      claimStatus: "claimed",
      verificationStatus: "approved",
      ownerIds: arrayUnion(claim.applicantId),
      status: newBusiness ? "draft" : "active",
      public: !newBusiness,
      updatedAt: serverTimestamp()
    });
    batch.set(membershipRef, {
      organizationId: claim.organizationId || null,
      businessId: membershipSnapshot.data()?.businessId || claim.businessId,
      businessIds: arrayUnion(claim.businessId),
      ...((claim.branchIds?.length || claim.branchId) ? { branchIds: arrayUnion(...(claim.branchIds?.length ? claim.branchIds : [claim.branchId])) } : membershipSnapshot.exists() ? {} : { branchIds: [] }),
      userId: claim.applicantId,
      email: claim.applicantEmail || membershipSnapshot.data()?.email || "",
      displayName: claim.applicantName || membershipSnapshot.data()?.displayName || "",
      role: claim.roleAtBusiness === "owner" ? (claim.organizationId ? "organization_owner" : "business_owner") : claim.roleAtBusiness === "branch_manager" ? "branch_manager" : claim.roleAtBusiness === "marketing" ? "marketing_manager" : "business_manager",
      permissions: arrayUnion("businesses.*", "branches.*", "catalog.*", "orders.*", "staff.*", "finance.read", "finance.configure", "support.*"),
      status: "active",
      ...(membershipSnapshot.exists() ? {} : { createdAt: serverTimestamp() }),
      updatedAt: serverTimestamp()
    }, { merge: true });
  } else {
    batch.update(doc(db, "businesses", claim.businessId), { claimStatus: decision === "request" ? "claim_needs_information" : "unclaimed", updatedAt: serverTimestamp() });
  }
  await batch.commit();
  await writeAuditLog({ action: `business_claim.${status}`, entityType: "businessClaim", entityId: claim.id, actorId: actor.uid, actorEmail: actor.email, metadata: { reason, businessId: claim.businessId } });
}

export async function saveBusinessProfile(businessId, values, user) {
  const { db } = sdk();
  await setDoc(doc(db, "businesses", businessId), clean({
    ...values,
    searchTerms: normalizeSearchTerms(values.name, values.category, values.city, values.phone, values.instagram),
    updatedAt: serverTimestamp(),
    updatedBy: user?.uid || null
  }), { merge: true });
  await writeAuditLog({ action: "business.updated", entityType: "business", entityId: businessId, actorId: user?.uid, actorEmail: user?.email });
}

export function subscribeMemberships(uid, callback, onError) {
  if (!uid) return () => {};
  const { db } = sdk();
  return onSnapshot(query(collection(db, "memberships"), where("userId", "==", uid), where("status", "==", "active")), (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), onError);
}

export function subscribeBusinessCatalog(businessId, callback, onError) {
  if (!businessId) return () => {};
  const { db } = sdk();
  return onSnapshot(query(collection(db, "products"), where("businessId", "==", businessId), orderBy("name"), limit(250)), (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), onError);
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
  await writeAuditLog({ action: "product.deleted", entityType: "product", entityId: productId, actorId: actor?.uid, actorEmail: actor?.email });
}

export function subscribeOrdersForBusiness(businessId, callback, onError) {
  if (!businessId) return () => {};
  const { db } = sdk();
  return onSnapshot(query(collection(db, "orders"), where("businessId", "==", businessId), orderBy("createdAt", "desc"), limit(100)), (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), onError);
}

export async function updateOrderStatus(orderId, status, actor, note = "") {
  const { db } = sdk();
  const batch = writeBatch(db);
  batch.update(doc(db, "orders", orderId), { status, updatedAt: serverTimestamp(), updatedBy: actor?.uid || null });
  const eventRef = doc(collection(db, "orderEvents"));
  batch.set(eventRef, { orderId, status, note, actorId: actor?.uid || null, createdAt: serverTimestamp() });
  await batch.commit();
}

export async function createSupportConversation(payload, user) {
  const { db } = sdk();
  const conversationRef = doc(collection(db, "supportConversations"));
  await setDoc(conversationRef, clean({
    requesterId: user?.uid || null,
    requesterEmail: user?.email || payload.email || "",
    requesterName: user?.displayName || payload.name || "",
    audience: payload.audience || "public",
    subject: payload.subject,
    category: payload.category || "general",
    priority: payload.priority || "normal",
    status: "open",
    businessId: payload.businessId || null,
    contextType: payload.contextType || null,
    contextId: payload.contextId || payload.reference || null,
    context: payload.context || null,
    assignedTo: null,
    lastMessage: payload.message,
    lastMessageAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }));
  await addDoc(collection(db, "supportMessages"), clean({
    conversationId: conversationRef.id,
    senderId: user?.uid || null,
    senderName: user?.displayName || payload.name || "Visitor",
    senderRole: payload.audience || "public",
    body: payload.message,
    internal: false,
    createdAt: serverTimestamp()
  }));
  await track("support_conversation_opened", { category: payload.category || "general" });
  return conversationRef.id;
}

export function subscribeSupportConversations(callback, options = {}) {
  const { db } = sdk();
  const constraints = [];
  if (options.requesterId) constraints.push(where("requesterId", "==", options.requesterId));
  if (options.businessId) constraints.push(where("businessId", "==", options.businessId));
  if (options.status) constraints.push(where("status", "==", options.status));
  constraints.push(orderBy("lastMessageAt", "desc"), limit(options.limit || 100));
  return onSnapshot(query(collection(db, "supportConversations"), ...constraints), (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), options.onError);
}

export function subscribeSupportMessages(conversationId, callback, onError) {
  if (!conversationId) return () => {};
  const { db } = sdk();
  return onSnapshot(query(collection(db, "supportMessages"), where("conversationId", "==", conversationId), orderBy("createdAt"), limit(500)), (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), onError);
}

export async function sendSupportMessage(conversationId, body, user, options = {}) {
  const { db } = sdk();
  const batch = writeBatch(db);
  const messageRef = doc(collection(db, "supportMessages"));
  batch.set(messageRef, clean({
    conversationId,
    senderId: user?.uid || null,
    senderName: user?.displayName || options.senderName || "Spotly Support",
    senderRole: options.senderRole || "customer",
    body,
    attachments: options.attachments || [],
    context: options.context || null,
    internal: Boolean(options.internal),
    createdAt: serverTimestamp()
  }));
  batch.update(doc(db, "supportConversations", conversationId), {
    lastMessage: options.internal ? "Internal note" : body,
    lastMessageAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    status: options.status || "open"
  });
  await batch.commit();
}

export async function updateSupportConversation(id, values, actor) {
  const { db } = sdk();
  await updateDoc(doc(db, "supportConversations", id), clean({ ...values, updatedAt: serverTimestamp() }));
  await writeAuditLog({ action: "support_conversation.updated", entityType: "supportConversation", entityId: id, actorId: actor?.uid, actorEmail: actor?.email, metadata: values });
}

export async function uploadSupportAttachment(conversationId, file, userId, onProgress) {
  if (!conversationId) throw new Error("Start the conversation before adding an attachment.");
  const { storage } = sdk();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileRef = ref(storage, `support/${conversationId}/${userId || "anonymous"}/${Date.now()}-${safeName}`);
  const task = uploadBytesResumable(fileRef, file, { contentType: file.type, customMetadata: clean({ conversationId, userId: userId || "anonymous", originalName: file.name }) });
  return new Promise((resolve, reject) => {
    task.on("state_changed", (snapshot) => onProgress?.(Math.round((snapshot.bytesTransferred / Math.max(snapshot.totalBytes, 1)) * 100)), reject, async () => {
      resolve({ name: file.name, type: file.type, size: file.size, path: fileRef.fullPath, url: await getDownloadURL(fileRef) });
    });
  });
}

export async function closeSupportConversation(id, user) {
  return updateSupportConversation(id, { status: "closed", closedAt: serverTimestamp(), closedBy: user?.uid || null }, user);
}

export async function reopenSupportConversation(id, user) {
  return updateSupportConversation(id, { status: "open", reopenedAt: serverTimestamp(), reopenedBy: user?.uid || null }, user);
}

export async function rateSupportConversation(id, rating, user) {
  return updateSupportConversation(id, { satisfaction: rating, satisfactionAt: serverTimestamp(), satisfactionBy: user?.uid || null }, user);
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
  await writeAuditLog({ action: "help_resource.deleted", entityType: "helpResource", entityId: id, actorId: actor?.uid, actorEmail: actor?.email });
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
  const { db } = sdk();
  return onSnapshot(query(collection(db, "branches"), where("businessId", "==", businessId), orderBy("name"), limit(100)), (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), onError);
}

export async function saveBranch(branch, businessId, organizationId, actor) {
  const { db } = sdk();
  const isNew = !branch.id;
  const branchRef = branch.id ? doc(db, "branches", branch.id) : doc(collection(db, "branches"));
  const branchName = String(branch.branchName || branch.name || "Main location").trim();
  const businessSnapshot = await getDoc(doc(db, "businesses", businessId));
  const businessName = businessSnapshot.data()?.brandName || businessSnapshot.data()?.name || "Business";
  const fulfilment = branch.fulfilment?.length ? branch.fulfilment : ["profile"];
  await setDoc(branchRef, clean({
    businessId,
    organizationId: organizationId || null,
    name: branchName,
    branchName,
    displayName: `${businessName} — ${branchName}`,
    city: branch.city || "Harare",
    address: branch.address || "",
    phone: branch.phone || "",
    email: branch.email || "",
    public: branch.public !== false,
    status: branch.status || "active",
    fulfilment,
    openingHours: branch.openingHours || defaultOpeningHours(),
    pickup: branch.pickup || { enabled: fulfilment.includes("pickup"), slotMinutes: 30, slotCapacity: 12, preparationMinutes: 45 },
    paymentMethods: branch.paymentMethods || ["cash", "paynow", "ecocash", "card"],
    acceptedCurrencies: branch.acceptedCurrencies || ["USD", "ZWG"],
    instructions: branch.instructions || "",
    searchTerms: normalizeSearchTerms(businessName, branchName, branch.city, branch.address),
    createdAt: branch.id ? branch.createdAt || serverTimestamp() : serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: actor?.uid || null
  }), { merge: true });
  if (isNew) {
    await setDoc(doc(db, "businesses", businessId), {
      branchIds: arrayUnion(branchRef.id),
      branchCount: increment(1),
      updatedAt: serverTimestamp()
    }, { merge: true });
  }
  await writeAuditLog({ action: branch.id ? "branch.updated" : "branch.created", entityType: "branch", entityId: branchRef.id, actorId: actor?.uid, actorEmail: actor?.email, metadata: { businessId } });
  return branchRef.id;
}

export function subscribeBusinessInvitations(businessId, callback, onError) {
  if (!businessId) return () => {};
  const { db } = sdk();
  return onSnapshot(query(collection(db, "businessInvitations"), where("businessId", "==", businessId), orderBy("createdAt", "desc"), limit(100)), (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), onError);
}

export async function inviteBusinessStaff(invitation, business, actor) {
  const { db } = sdk();
  const invitationRef = doc(collection(db, "businessInvitations"));
  await setDoc(invitationRef, clean({
    businessId: business.id,
    organizationId: business.organizationId || null,
    email: invitation.email.trim().toLowerCase(),
    name: invitation.name || "",
    role: invitation.role || "staff",
    branchIds: invitation.branchIds || [],
    permissions: invitation.permissions || [],
    status: "pending",
    invitedBy: actor.uid,
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }));
  await writeAuditLog({ action: "business_staff.invited", entityType: "businessInvitation", entityId: invitationRef.id, actorId: actor.uid, actorEmail: actor.email, metadata: { businessId: business.id, email: invitation.email } });
  return invitationRef.id;
}

export function subscribeBusinessClaimsForBusiness(businessId, callback, onError) {
  if (!businessId) return () => {};
  const { db } = sdk();
  return onSnapshot(query(collection(db, "businessClaims"), where("businessId", "==", businessId), orderBy("createdAt", "desc"), limit(20)), (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), onError);
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
  await writeAuditLog({ action: "business_finance.updated", entityType: "businessFinanceSettings", entityId: businessId, actorId: actor?.uid, actorEmail: actor?.email });
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
  const { db } = sdk();
  await setDoc(doc(db, "users", userId), clean({
    roles: access.roles || ["customer"],
    customPermissions: access.customPermissions || [],
    status: access.status || "active",
    privateBeta: Boolean(access.privateBeta),
    updatedAt: serverTimestamp(),
    updatedBy: actor?.uid || null
  }), { merge: true });
  await writeAuditLog({ action: "user_access.updated", entityType: "user", entityId: userId, actorId: actor?.uid, actorEmail: actor?.email, metadata: access });
}

export async function bootstrapSuperAdmin(user) {
  const { db } = sdk();
  await setDoc(doc(db, "users", user.uid), {
    roles: ["customer", "super_admin"],
    customPermissions: ["*"],
    status: "active",
    updatedAt: serverTimestamp(),
    updatedBy: user.uid
  }, { merge: true });
  await writeAuditLog({ action: "admin.bootstrap", entityType: "user", entityId: user.uid, actorId: user.uid, actorEmail: user.email });
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
  await writeAuditLog({ action: "partnership_lead.updated", entityType: "partnershipLead", entityId: id, actorId: actor?.uid, actorEmail: actor?.email, metadata: values });
}

export async function adminUpdateBusiness(id, values, actor) {
  const { db } = sdk();
  await setDoc(doc(db, "businesses", id), clean({
    ...values,
    searchTerms: normalizeSearchTerms(values.name, values.brandName, values.category, values.city, ...(values.aliases || [])),
    updatedAt: serverTimestamp(),
    updatedBy: actor?.uid || null
  }), { merge: true });
  await writeAuditLog({ action: "admin.business_updated", entityType: "business", entityId: id, actorId: actor?.uid, actorEmail: actor?.email, metadata: values });
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

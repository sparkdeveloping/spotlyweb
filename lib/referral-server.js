import "server-only";

import { randomBytes } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { referralCodeLooksValid } from "@/lib/customer-growth";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newCode(length = 8) {
  const bytes = randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i += 1) code += ALPHABET[bytes[i] % ALPHABET.length];
  return code;
}

function publicClaim(snapshot) {
  if (!snapshot?.exists) return null;
  const item = snapshot.data() || {};
  return {
    id: snapshot.id,
    code: item.code || "",
    status: item.status || "pending_first_purchase",
    claimedAt: item.claimedAt?.toDate?.().toISOString?.() || null,
    qualifiedAt: item.qualifiedAt?.toDate?.().toISOString?.() || null
  };
}

export async function ensureReferralProfile(db, userId) {
  const profileRef = db.collection("referralProfiles").doc(userId);
  const existing = await profileRef.get();
  if (existing.exists && referralCodeLooksValid(existing.data()?.code)) return { id: existing.id, ...existing.data() };

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = newCode(8);
    const codeRef = db.collection("referralCodes").doc(code);
    try {
      const created = await db.runTransaction(async (transaction) => {
        const [profileSnapshot, codeSnapshot] = await Promise.all([transaction.get(profileRef), transaction.get(codeRef)]);
        if (profileSnapshot.exists && referralCodeLooksValid(profileSnapshot.data()?.code)) return { id: profileSnapshot.id, ...profileSnapshot.data() };
        if (codeSnapshot.exists) throw Object.assign(new Error("Referral code collision."), { code: "REFERRAL_COLLISION" });
        const now = FieldValue.serverTimestamp();
        transaction.set(profileRef, { userId, code, createdAt: now, updatedAt: now }, { merge: true });
        transaction.create(codeRef, { userId, code, createdAt: now });
        return { id: userId, userId, code };
      });
      return created;
    } catch (error) {
      if (error?.code !== "REFERRAL_COLLISION") throw error;
    }
  }
  throw Object.assign(new Error("A referral code could not be created right now."), { status: 503 });
}

export async function claimReferral(db, { userId, code }) {
  const normalized = String(code || "").trim().toUpperCase();
  if (!referralCodeLooksValid(normalized)) throw Object.assign(new Error("Enter a valid Spotly referral code."), { status: 400 });
  const claimRef = db.collection("referralClaims").doc(userId);
  const codeRef = db.collection("referralCodes").doc(normalized);

  return db.runTransaction(async (transaction) => {
    const priorOrdersQuery = db.collection("orders").where("customerId", "==", userId).limit(50);
    const [claimSnapshot, codeSnapshot, priorOrdersSnapshot] = await Promise.all([transaction.get(claimRef), transaction.get(codeRef), transaction.get(priorOrdersQuery)]);
    if (claimSnapshot.exists) {
      const current = claimSnapshot.data() || {};
      if (current.code === normalized) return publicClaim(claimSnapshot);
      throw Object.assign(new Error("A referral code has already been attached to this account."), { status: 409 });
    }
    if (!codeSnapshot.exists) throw Object.assign(new Error("That referral code was not found."), { status: 404 });
    const hasPriorPaidPurchase = priorOrdersSnapshot.docs.some((doc) => ["paid", "refunded", "refund_pending"].includes(String(doc.data()?.paymentStatus || "").toLowerCase()));
    if (hasPriorPaidPurchase) throw Object.assign(new Error("Referral codes must be attached before your first completed Spotly purchase."), { status: 409 });
    const referrerUid = codeSnapshot.data()?.userId;
    if (!referrerUid || referrerUid === userId) throw Object.assign(new Error("You cannot use your own referral code."), { status: 409 });
    const now = FieldValue.serverTimestamp();
    transaction.create(claimRef, {
      refereeUid: userId,
      referrerUid,
      code: normalized,
      status: "pending_first_purchase",
      claimedAt: now,
      updatedAt: now
    });
    return { id: userId, code: normalized, status: "pending_first_purchase", claimedAt: null, qualifiedAt: null };
  });
}

export async function referralOverview(db, userId) {
  const [profile, claim, inbound, rewardSnapshot, settingsSnapshot] = await Promise.all([
    ensureReferralProfile(db, userId),
    db.collection("referralClaims").doc(userId).get(),
    db.collection("referralClaims").where("referrerUid", "==", userId).limit(100).get(),
    db.collection("referralRewards").where("userId", "==", userId).limit(100).get(),
    db.collection("platformSettings").doc("global").get()
  ]);
  const referrals = inbound.docs.map((doc) => {
    const item = doc.data() || {};
    return {
      id: doc.id,
      status: item.status || "pending_first_purchase",
      claimedAt: item.claimedAt?.toDate?.().toISOString?.() || null,
      qualifiedAt: item.qualifiedAt?.toDate?.().toISOString?.() || null
    };
  }).sort((a, b) => String(b.claimedAt || "").localeCompare(String(a.claimedAt || "")));
  const rewards = rewardSnapshot.docs.map((doc) => {
    const item = doc.data() || {};
    return {
      id: doc.id,
      role: item.role === "referrer" ? "referrer" : "referee",
      amount: Math.max(0, Number(item.amount || 0)),
      currency: String(item.currency || "USD").toUpperCase(),
      status: item.status || "pending_review",
      createdAt: item.createdAt?.toDate?.().toISOString?.() || null
    };
  }).filter((item) => item.amount > 0);
  const config = settingsSnapshot.data()?.growth?.referrals || {};
  const campaign = config.enabled === false || (!Number(config.referrerReward || 0) && !Number(config.refereeReward || 0)) ? null : {
    currency: String(config.currency || "USD").toUpperCase(),
    referrerReward: Math.max(0, Number(config.referrerReward || 0)),
    refereeReward: Math.max(0, Number(config.refereeReward || 0)),
    autoApprove: config.autoApprove === true
  };
  return {
    code: profile.code,
    claim: publicClaim(claim),
    campaign,
    rewards,
    stats: {
      invited: referrals.length,
      qualified: referrals.filter((item) => item.status === "qualified").length,
      pending: referrals.filter((item) => item.status === "pending_first_purchase").length
    },
    referrals
  };
}

export async function qualifyReferralForCustomer(db, customerId, orderId) {
  if (!customerId || !orderId) return { qualified: false, reason: "missing_context" };
  const claimRef = db.collection("referralClaims").doc(customerId);
  const orderRef = db.collection("orders").doc(orderId);
  const settingsRef = db.collection("platformSettings").doc("global");

  return db.runTransaction(async (transaction) => {
    const [claimSnapshot, orderSnapshot, settingsSnapshot] = await Promise.all([
      transaction.get(claimRef), transaction.get(orderRef), transaction.get(settingsRef)
    ]);
    if (!claimSnapshot.exists) return { qualified: false, reason: "no_claim" };
    const claim = claimSnapshot.data() || {};
    if (claim.status === "qualified") return { qualified: false, reason: "already_qualified" };
    if (!orderSnapshot.exists) return { qualified: false, reason: "order_missing" };
    const order = orderSnapshot.data() || {};
    if (order.customerId !== customerId || order.paymentStatus !== "paid") return { qualified: false, reason: "order_not_eligible" };

    const now = FieldValue.serverTimestamp();
    transaction.set(claimRef, { status: "qualified", qualifyingOrderId: orderId, qualifiedAt: now, updatedAt: now }, { merge: true });

    const config = settingsSnapshot.data()?.growth?.referrals || {};
    const currency = String(config.currency || order.currency || "USD").toUpperCase();
    const campaignEnabled = config.enabled !== false;
    const referrerAmount = campaignEnabled ? Math.max(0, Number(config.referrerReward || 0)) : 0;
    const refereeAmount = campaignEnabled ? Math.max(0, Number(config.refereeReward || 0)) : 0;
    const rewardStatus = config.autoApprove === true ? "approved" : "pending_review";
    if (referrerAmount > 0 && claim.referrerUid) {
      transaction.set(db.collection("referralRewards").doc(`${customerId}_referrer`), { userId: claim.referrerUid, role: "referrer", refereeUid: customerId, orderId, amount: referrerAmount, currency, status: rewardStatus, createdAt: now, updatedAt: now }, { merge: false });
    }
    if (refereeAmount > 0) {
      transaction.set(db.collection("referralRewards").doc(`${customerId}_referee`), { userId: customerId, role: "referee", referrerUid: claim.referrerUid || null, orderId, amount: refereeAmount, currency, status: rewardStatus, createdAt: now, updatedAt: now }, { merge: false });
    }
    return { qualified: true, referrerUid: claim.referrerUid || null };
  });
}

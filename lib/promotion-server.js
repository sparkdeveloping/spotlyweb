import "server-only";

import { normalizePromotionCode, promotionQuote, chooseBestAutomaticPromotion } from "@/lib/customer-growth";

function uniqueRefs(refs = []) {
  const seen = new Set();
  return refs.filter((ref) => {
    if (!ref?.path || seen.has(ref.path)) return false;
    seen.add(ref.path);
    return true;
  });
}

export async function promotionCandidateRefs(db, businessId, code = "") {
  const normalizedCode = normalizePromotionCode(code);
  const [businessSnapshot, platformSnapshot] = await Promise.all([
    db.collection("promotions").where("businessId", "==", businessId).limit(100).get(),
    db.collection("promotions").where("scope", "==", "platform").limit(100).get()
  ]);
  const docs = [...businessSnapshot.docs, ...platformSnapshot.docs];
  return uniqueRefs(docs
    .filter((doc) => {
      const data = doc.data() || {};
      const promotionCode = normalizePromotionCode(data.code);
      return normalizedCode ? promotionCode === normalizedCode : !promotionCode;
    })
    .slice(0, normalizedCode ? 20 : 80)
    .map((doc) => db.collection("promotions").doc(doc.id)));
}

export function resolvePromotionSnapshots(snapshots = [], context = {}) {
  const records = snapshots.filter((snapshot) => snapshot?.exists).map((snapshot) => ({ id: snapshot.id, ...(snapshot.data() || {}) }));
  const code = normalizePromotionCode(context.code);
  if (code) {
    for (const promotion of records) {
      const quote = promotionQuote(promotion, { ...context, code });
      if (quote.eligible) return { promotion, quote };
    }
    const matching = records.find((promotion) => normalizePromotionCode(promotion.code) === code);
    if (matching) return { promotion: matching, quote: promotionQuote(matching, { ...context, code }) };
    return { promotion: null, quote: { eligible: false, reason: "That promotion code is not available here." } };
  }
  return chooseBestAutomaticPromotion(records, context);
}

export async function quoteBusinessPromotion(db, { businessId, branchId, currency, lines, code = "", now = new Date(), isNewCustomer, privateBeta = false }) {
  const refs = await promotionCandidateRefs(db, businessId, code);
  if (!refs.length) return { promotion: null, quote: code ? { eligible: false, reason: "That promotion code was not found." } : null };
  const snapshots = await Promise.all(refs.map((ref) => ref.get()));
  return resolvePromotionSnapshots(snapshots, { businessId, branchId, currency, lines, code, now, isNewCustomer, privateBeta });
}

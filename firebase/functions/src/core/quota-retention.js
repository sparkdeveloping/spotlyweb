/**
 * C3 bounded cleanup of disposable, expired quota documents. Every pass
 * deletes its result set before querying again; no fragile cursor or unbounded
 * collection scan. This helper intentionally excludes audit/finance records.
 */
const QUOTA_COLLECTIONS = new Set(["rateLimits", "securityRateLimits"]);

export async function drainExpiredQuotaPages(firestore, {
  collection, cutoff, pageSize = 250, maxPages = 4
} = {}) {
  if (!QUOTA_COLLECTIONS.has(collection)) throw new Error("Only disposable quota collections may be drained.");
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 400) throw new Error("Invalid quota retention page size.");
  if (!Number.isSafeInteger(maxPages) || maxPages < 1 || maxPages > 12) throw new Error("Invalid quota retention budget.");
  if (!cutoff) throw new Error("Quota retention cutoff is required.");
  const query = firestore.collection(collection).where("expiresAt", "<", cutoff);
  let removed = 0;
  let pages = 0;
  let couldHaveBacklog = false;
  for (let i = 0; i < maxPages; i++) {
    const snapshot = await query.limit(pageSize).get();
    const docs = snapshot?.docs || [];
    if (!docs.length) { couldHaveBacklog = false; break; }
    const batch = firestore.batch();
    for (const doc of docs) batch.delete(doc.ref);
    await batch.commit();
    removed += docs.length;
    pages++;
    couldHaveBacklog = docs.length === pageSize;
    if (!couldHaveBacklog) break;
  }
  return { removed, pages, couldHaveBacklog };
}

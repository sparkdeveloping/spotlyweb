import { claimSafeUnpartnered } from "./assist-research-menu.js";

/** Pure safety gate for source-linked independent purchasing, used across APIs. */
export function independentStoreSafe(record = {}, canonical = null, branch = null) {
  if (record.status !== "published" || record.assistAccepting === false ||
      record.operationalReviewed !== true) return false;
  if (!record.directoryBusinessId) return !record.sourceResearchBatchId;
  if (!canonical || !claimSafeUnpartnered(canonical) || canonical.assistAccepting === false) return false;
  if (record.sourceResearchBatchId) {
    if (canonical.launchApproved !== true || canonical.source?.type !== "spotly_assist_research" ||
      canonical.source?.batchId !== record.sourceResearchBatchId ||
      canonical.source?.researchLocationId !== record.sourceResearchLocationId) return false;
    if (!branch || branch.businessId !== record.directoryBusinessId ||
      branch.public !== true || branch.assistAccepting === false ||
      ["archived","removed"].includes(branch.status)) return false;
  }
  return true;
}

/**
 * Canonical reads are independent of a public browse snapshot's 500-document cap.
 * getAll avoids a query per store. Any missing owner/branch record fails closed.
 */
export async function filterSafeIndependentStores(db, rawStores = []) {
  const refs = [...new Set(rawStores.flatMap(store =>
    [store.directoryBusinessId,store.sourceResearchBatchId ? store.directoryBranchId : null].filter(Boolean)))];
  if (refs.some(id => !/^[a-zA-Z0-9_-]{3,180}$/.test(id))) return [];
  const businessIds = [...new Set(rawStores.map(store => store.directoryBusinessId).filter(Boolean))];
  const branchIds = [...new Set(rawStores.filter(store=>store.sourceResearchBatchId).map(store=>store.directoryBranchId).filter(Boolean))];
  const [businessDocs,branchDocs] = await Promise.all([
    businessIds.length ? db.getAll(...businessIds.map(id=>db.collection("businesses").doc(id))) : [],
    branchIds.length ? db.getAll(...branchIds.map(id=>db.collection("branches").doc(id))) : []
  ]);
  const businessMap=new Map(businessDocs.filter(doc=>doc.exists).map(doc=>[doc.id,doc.data()]));
  const branchMap=new Map(branchDocs.filter(doc=>doc.exists).map(doc=>[doc.id,doc.data()]));
  return rawStores.filter(store=>independentStoreSafe(
    store,
    store.directoryBusinessId ? businessMap.get(store.directoryBusinessId) : null,
    store.directoryBranchId ? branchMap.get(store.directoryBranchId) : null
  ));
}

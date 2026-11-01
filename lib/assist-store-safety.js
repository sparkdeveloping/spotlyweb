import placeDataset from "./generated/open-marketplace-places.js";
import { SPOTLY_MENU_BUSINESSES } from "../data/spotly-restaurant-menus.js";
import { claimSafeUnpartnered } from "./assist-research-menu.js";
import { directoryShoppingEligible } from "./spotly-catalogue.js";

export function independentStoreRequestSafe(record = {}, canonical = null, branch = null) {
  if (record.catalogueMode !== "quote_first") return independentStoreSafe(record, canonical, branch);
  return record.status === "published" && record.assistAccepting !== false && Boolean(record.directoryBusinessId) &&
    Boolean(canonical && directoryShoppingEligible(canonical)) && !record.sourceResearchBatchId &&
    (!record.directoryBranchId || Boolean(branch && branch.businessId === record.directoryBusinessId && branch.public === true && branch.assistAccepting !== false && !["archived","removed","closed"].includes(branch.status)));
}

export function canonicalIndependentSource(snapshot, businessId) {
  return snapshot?.exists ? snapshot.data() : [...placeDataset.records, ...SPOTLY_MENU_BUSINESSES].find(item => item.id === businessId) || null;
}

/** Pure safety gate for source-linked independent purchasing, used across APIs. */
export function independentStoreSafe(record = {}, canonical = null, branch = null) {
  if (record.status !== "published" || record.assistAccepting === false ||
      record.operationalReviewed !== true) return false;
  if (record.catalogueMode === "quote_first") return independentStoreRequestSafe(record, canonical, branch) && record.collectionAddressVerified === true && Boolean(record.address?.trim());
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
    [store.directoryBusinessId,store.directoryBranchId || null].filter(Boolean)))];
  if (refs.some(id => !/^[a-zA-Z0-9_-]{3,180}$/.test(id))) return [];
  const businessIds = [...new Set(rawStores.map(store => store.directoryBusinessId).filter(Boolean))];
  const branchIds = [...new Set(rawStores.filter(store=>store.directoryBranchId).map(store=>store.directoryBranchId).filter(Boolean))];
  const [businessDocs,branchDocs] = await Promise.all([
    businessIds.length ? db.getAll(...businessIds.map(id=>db.collection("businesses").doc(id))) : [],
    branchIds.length ? db.getAll(...branchIds.map(id=>db.collection("branches").doc(id))) : []
  ]);
  const businessMap=new Map(businessDocs.map(doc=>[doc.id,canonicalIndependentSource(doc,doc.id)]));
  const branchMap=new Map(branchDocs.filter(doc=>doc.exists).map(doc=>[doc.id,doc.data()]));
  return rawStores.filter(store=>independentStoreSafe(
    store,
    store.directoryBusinessId ? businessMap.get(store.directoryBusinessId) : null,
    store.directoryBranchId ? branchMap.get(store.directoryBranchId) : null
  ));
}

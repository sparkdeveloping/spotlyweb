import "server-only";
import { directoryIntakeStore, directoryStoreId, refreshDirectoryCatalogue } from "./spotly-catalogue.js";
import { independentPublicStore } from "./independent-shopping.js";
import { independentStoreRequestSafe, canonicalIndependentSource } from "./assist-store-safety.js";
import { unclaimedPublicationEnabled } from "./directory-publication-server.js";
import { canShowDirectoryRecord } from "./nxt-policy.js";
import { regionalServicePolicy } from "./v9-assist-regions.js";
export { canonicalIndependentSource } from "./assist-store-safety.js";

export async function directoryShoppingStore(db, { businessId = "", branchId = "", storeId = "", settings = {}, source = null } = {}) {
  const parsed = storeId.startsWith("directory_") ? storeId.slice(10).split("__branch__") : [];
  const directoryId = businessId || parsed[0] || "";
  let selectedBranch = branchId || parsed[1] || "";
  if (selectedBranch === `${directoryId}-place`) selectedBranch = "";
  if (!/^[a-zA-Z0-9_-]{3,160}$/.test(directoryId) || selectedBranch && !/^[a-zA-Z0-9_-]{2,160}$/.test(selectedBranch)) return null;
  const raw = source || canonicalIndependentSource(await db.collection("businesses").doc(directoryId).get(), directoryId);
  if (!raw || !await unclaimedPublicationEnabled(db) || !canShowDirectoryRecord(raw, true)) return null;
  const seed = directoryIntakeStore(directoryId, raw);
  if (!seed) return null;
  let branch = null;
  if (selectedBranch) {
    const snap = await db.collection("branches").doc(selectedBranch).get();
    branch = snap.exists ? snap.data() : null;
    if (!branch || branch.businessId !== directoryId || branch.public !== true || branch.assistAccepting === false || ["archived", "removed", "closed"].includes(branch.status)) return null;
    Object.assign(seed, { id:directoryStoreId(directoryId,selectedBranch),directoryBranchId:selectedBranch,address:branch.address || "",area:branch.area || branch.suburb || "",city:branch.city || raw.city,country:raw.country || "ZW",branchName:branch.branchName || branch.name || branch.area || "",coordinates:branch.coordinates || branch.location || null });
  }
  if (!regionalServicePolicy(settings.assistCoverage || {}, seed, seed.assistService).available) return null;
  const ids = [...new Set([seed.id, raw.assistStoreId, `assistresearch_${directoryId}`].filter(Boolean))];
  const docs = await db.getAll(...ids.map(id=>db.collection("independentShoppingStores").doc(id)));
  const saved = docs.find(doc=>doc.id===seed.id&&doc.exists);
  // A paused location cannot be reactivated by falling back to a generated catalogue.
  if (saved && (saved.data().status !== "published" || saved.data().assistAccepting === false)) return null;
  if (saved) {
    const store = refreshDirectoryCatalogue({...saved.data(),id:saved.id},seed);
    if (store.directoryBusinessId !== directoryId || (store.directoryBranchId || "") !== selectedBranch || !independentStoreRequestSafe(store,raw,branch)) return null;
    return {raw:store,business:raw,store:independentPublicStore(store.id,store)};
  }
  const curated = docs.find(doc=>doc.exists&&doc.id!==seed.id);
  if (curated) {
    const old = {...curated.data(),id:curated.id};
    if ((!selectedBranch || old.directoryBranchId === selectedBranch) && (old.status !== "published" || old.assistAccepting === false)) return null;
    const oldBranch = old.directoryBranchId ? await db.collection("branches").doc(old.directoryBranchId).get() : null;
    if (old.directoryBusinessId === directoryId && (!selectedBranch || old.directoryBranchId === selectedBranch) && independentStoreRequestSafe(old,raw,oldBranch?.exists?oldBranch.data():null)) {
      const active = independentPublicStore(old.id,old);
      if (active) return {raw:old,business:raw,store:active};
      // Keep factual dishes when a price expires. They require a new branch quote.
      const references = (old.items || []).filter(item=>item.status !== "unavailable" && /^[a-zA-Z0-9_-]{2,80}$/.test(item.id || "") && typeof item.name === "string" && item.name.trim().length >= 2 && item.name.length <= 160)
        .map(item=>({id:item.id,name:item.name,category:item.category || "Menu",unit:item.unit || "",status:"requestable",catalogueKind:"menu_reference",priceEstimate:null,priceCheckedAt:null,priceStatus:"to_confirm"}));
      if (references.length) seed.items=references.slice(0,120);
    }
  }
  return {raw:seed,business:raw,store:independentPublicStore(seed.id,seed)};
}

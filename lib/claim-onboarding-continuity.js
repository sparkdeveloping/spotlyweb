// Temporary, origin-local continuity for the public Business application. Never put
// File/Blob contents in localStorage: pending evidence lives only in IndexedDB.
export const CLAIM_TRANSFER_KEY = "spotly-business-claim-resume-v1";
export const CLAIM_TRANSFER_MAX_AGE = 14 * 24 * 60 * 60 * 1000;
const EVIDENCE_DB = "spotly-business-claim-evidence-v1";
const EVIDENCE_STORE = "pending";

export function restoreGuestClaim(storage, now = Date.now()) {
  try {
    const saved = JSON.parse(storage?.getItem(CLAIM_TRANSFER_KEY) || "null");
    if (!saved || !saved.savedAt || now - Date.parse(saved.savedAt) > CLAIM_TRANSFER_MAX_AGE || Date.parse(saved.savedAt) > now + 60_000) return null;
    if (!saved.form || !Array.isArray(saved.selectedBranchIds)) return null;
    return saved;
  } catch { return null; }
}

export function preserveGuestClaim(storage, snapshot) {
  if (!storage) return false;
  try {
    storage.setItem(CLAIM_TRANSFER_KEY, JSON.stringify({ ...snapshot, savedAt: new Date().toISOString() }));
    return true;
  } catch { return false; }
}

export function forgetGuestClaim(storage) {
  try { storage?.removeItem(CLAIM_TRANSFER_KEY); } catch { /* Private-browsing storage limitations */ }
}

function evidenceDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("This browser cannot temporarily store documents. Sign in first to upload securely."));
    const request = indexedDB.open(EVIDENCE_DB, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(EVIDENCE_STORE)) request.result.createObjectStore(EVIDENCE_STORE, { keyPath: "id" }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Unable to prepare temporary document storage."));
  });
}

async function evidenceOperation(mode, operation) {
  const database = await evidenceDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(EVIDENCE_STORE, mode);
      const request = operation(transaction.objectStore(EVIDENCE_STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Could not access saved documents."));
      transaction.onabort = () => reject(transaction.error || new Error("Document storage was interrupted."));
    });
  } finally { database.close(); }
}

export async function stageClaimFile(draftId, file) {
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const record = { id, draftId, name: file.name, type: file.type, size: file.size, file, stagedAt: new Date().toISOString() };
  await evidenceOperation("readwrite", (store) => store.put(record));
  return { id, name: file.name, type: file.type, size: file.size, staged: true };
}

export async function stagedClaimFiles(draftId) {
  if (!draftId) return [];
  const all = await evidenceOperation("readonly", (store) => store.getAll());
  const now = Date.now();
  const expired = all.filter((item) => !item.stagedAt || !Number.isFinite(Date.parse(item.stagedAt)) || now - Date.parse(item.stagedAt) > CLAIM_TRANSFER_MAX_AGE);
  await Promise.allSettled(expired.map((item) => clearStagedClaimFile(item.id)));
  const expiredIds = new Set(expired.map((item) => item.id));
  return all.filter((item) => !expiredIds.has(item.id) && item.draftId === draftId);
}

export async function clearStagedClaimFile(id) {
  if (id) await evidenceOperation("readwrite", (store) => store.delete(id));
}

export async function clearAllStagedClaimFiles(draftId) {
  for (const item of await stagedClaimFiles(draftId)) await clearStagedClaimFile(item.id);
}

export function isCuratedVirtualBranch(branch = {}) {
  return branch.curated === true || /-place$/.test(String(branch.id || ""));
}

export function isClaimableExistingBranch(branch = {}) {
  return Boolean(branch.id && !isCuratedVirtualBranch(branch));
}

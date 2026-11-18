// Session-only continuation capability. Never store applicant contact data in the browser.
export const PENDING_REGISTRATION_KEY = "spotly-business-continuation-v1";
export function readPendingRegistration(storage) {
  try {
    const item = JSON.parse(storage.getItem(PENDING_REGISTRATION_KEY) || "null");
    if (!item || !/^br_[a-f0-9]{40}$/.test(item.registrationId || "") || !/^[0-9a-f-]{25,80}$/i.test(item.continuationKey || "")) return null;
    if (!Number.isFinite(item.savedAt) || Date.now() - item.savedAt > 14 * 86400000) {
      storage.removeItem(PENDING_REGISTRATION_KEY); return null;
    }
    return { registrationId: item.registrationId, continuationKey: item.continuationKey };
  } catch { return null; }
}
export function savePendingRegistration(storage, registrationId, continuationKey) {
  if (!/^br_[a-f0-9]{40}$/.test(registrationId || "") || !/^[0-9a-f-]{25,80}$/i.test(continuationKey || "")) return false;
  try { storage.setItem(PENDING_REGISTRATION_KEY, JSON.stringify({ registrationId, continuationKey, savedAt: Date.now() })); return true; } catch { return false; }
}
export function clearPendingRegistration(storage) { try { storage.removeItem(PENDING_REGISTRATION_KEY); } catch {} }

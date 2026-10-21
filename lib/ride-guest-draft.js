// The guest Ride draft stays in the current browser tab only, for 15 minutes.
// No account, payment, or contact information is retained here.
export const RIDE_GUEST_DRAFT_KEY = "spotly:ride-guest-draft:v1";
export const RIDE_GUEST_DRAFT_TTL_MS = 15 * 60 * 1000;

function validPoint(point) {
  return point && Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng)) &&
    Math.abs(Number(point.lat)) <= 90 && Math.abs(Number(point.lng)) <= 180 &&
    ["ZW", "MW"].includes(point.country);
}

export function saveRideGuestDraft(storage, { pickup, dropoff, serviceType }, now = Date.now()) {
  if (!storage || !validPoint(pickup) || !validPoint(dropoff)) return false;
  try {
    storage.setItem(RIDE_GUEST_DRAFT_KEY, JSON.stringify({
      savedAt: now, pickup, dropoff,
      serviceType: ["economy", "comfort", "xl"].includes(serviceType) ? serviceType : "economy"
    }));
    return true;
  } catch { return false; }
}

export function consumeRideGuestDraft(storage, now = Date.now()) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(RIDE_GUEST_DRAFT_KEY);
    if (!raw) return null;
    storage.removeItem(RIDE_GUEST_DRAFT_KEY);
    const draft = JSON.parse(raw);
    if (!Number.isFinite(draft.savedAt) || now - draft.savedAt > RIDE_GUEST_DRAFT_TTL_MS ||
      draft.savedAt > now + 30000 || !validPoint(draft.pickup) || !validPoint(draft.dropoff)) return null;
    return draft;
  } catch { return null; }
}

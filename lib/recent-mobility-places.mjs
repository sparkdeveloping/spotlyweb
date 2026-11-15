/** Session-only recent places. No Firestore writes, cross-device sync, persistent
 * tracking, background GPS history, or permanent browser location retention. */
const KEY = "spotly:mobility:recent:v1";
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ITEMS = 5;
const allowed = new Set(["ZW", "MW"]);
const valid = (point, country) => Boolean(point && allowed.has(country) && point.country === country &&
  Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng)) &&
  Math.abs(Number(point.lat)) <= 90 && Math.abs(Number(point.lng)) <= 180 &&
  typeof point.formattedAddress === "string" && point.formattedAddress.trim().length > 2 && point.formattedAddress.length <= 350);
const store = () => { try { return typeof sessionStorage === "undefined" ? null : sessionStorage; } catch { return null; } };

export function recentMobilityPlaces(country, now = Date.now()) {
  if (!allowed.has(country)) return [];
  const storage = store(); if (!storage) return [];
  try {
    const records = JSON.parse(storage.getItem(KEY) || "[]");
    return (Array.isArray(records) ? records : [])
      .filter(item => item?.at > now - TTL_MS && item?.at <= now && valid(item?.point, country))
      .slice(0, MAX_ITEMS).map(item => ({...item.point}));
  } catch { return []; }
}
export function rememberMobilityPlace(point, country, now = Date.now()) {
  const storage = store();
  if (!storage || !valid(point, country)) return false;
  const safe = {lat: Number(point.lat), lng: Number(point.lng),
    label: String(point.label || point.formattedAddress).slice(0, 120),
    formattedAddress: point.formattedAddress.slice(0, 350),
    city: String(point.city || "").slice(0, 120), area: String(point.area || "").slice(0, 120), country};
  try {
    const all = ["ZW", "MW"].flatMap(code => recentMobilityPlaces(code, now).map(item => ({point:item, at:now - 1})));
    const remaining = all.filter(entry => entry.point.country !== country ||
       Math.abs(entry.point.lat - safe.lat) > .00015 || Math.abs(entry.point.lng - safe.lng) > .00015);
    storage.setItem(KEY, JSON.stringify([{point:safe,at:now},...remaining].slice(0, MAX_ITEMS)));
    return true;
  } catch { return false; }
}
export function clearRecentMobilityPlaces() {
  try { store()?.removeItem(KEY); } catch { /* Private mode. */ }
}

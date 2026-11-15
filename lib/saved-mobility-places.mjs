/** LX11: Places explicitly saved by a person for later / offline selection.
 * Data remains in this browser's local storage, not Firebase. It includes
 * precise coordinates: never save automatically or sync across accounts.
 * A saved coordinate is NOT an approved pickup, verified entrance, road route,
 * fare, or dispatch authorization. All those checks still run on the server.
 */
const KEY = "spotly:mobility:offline-places:v1";
const MAX_ITEMS = 8;
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ENVELOPES = {
  ZW: {lat: [-22.5, -15.5], lng: [25, 34]},
  MW: {lat: [-17.25, -9.2], lng: [32.6, 36.1]}
};
const storage = () => { try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; } };
const short = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";
function project(point, country) {
  const envelope = ENVELOPES[country];
  if (!envelope || point?.country !== country ||
      typeof point?.formattedAddress !== "string" || point.formattedAddress.trim().length < 3 ||
      point.formattedAddress.length > 350 || !Number.isFinite(Number(point?.lat)) ||
      !Number.isFinite(Number(point?.lng))) return null;
  const lat = Number(point.lat), lng = Number(point.lng);
  if (lat < envelope.lat[0] || lat > envelope.lat[1] ||
      lng < envelope.lng[0] || lng > envelope.lng[1]) return null;
  return {lat, lng, country,
    label: short(point.label, 120) || short(point.formattedAddress, 120),
    formattedAddress: short(point.formattedAddress, 350),
    city: short(point.city, 120), area: short(point.area, 120)};
}
function records(now) {
  try {
    const raw = storage()?.getItem(KEY);
    if (!raw || raw.length > 6500) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {storage()?.removeItem(KEY); return [];}
    const current = parsed.slice(0, MAX_ITEMS)
      .filter(item => Number.isFinite(item?.savedAt) && item.savedAt <= now && item.savedAt > now - TTL_MS)
      .map(item => ({point: project(item?.point, item?.point?.country), savedAt: item.savedAt}))
      .filter(item => item.point);
    // Expired or malformed coordinates must not live indefinitely in device storage.
    // Cleanup is local-only and lazy (on the next use); never hits Firebase.
    if (current.length !== parsed.length) {
      if (current.length) put(current);
      else storage()?.removeItem(KEY);
    }
    return current;
  } catch { return []; }
}
const identity = place => `${place.country}:${place.lat.toFixed(5)}:${place.lng.toFixed(5)}`;
function put(items) {
  try { const db = storage(); if (!db) return false;
    db.setItem(KEY, JSON.stringify(items.slice(0, MAX_ITEMS))); return true;
  } catch { return false; }
}
export function savedMobilityPlaces(country, now = Date.now()) {
  if (!ENVELOPES[country]) return [];
  return records(now).filter(item => item.point.country === country).map(item => ({...item.point}));
}
export function saveMobilityPlace(point, country, now = Date.now()) {
  const safe = project(point, country);
  if (!safe || !Number.isFinite(now)) return false;
  const keep = records(now).filter(item => identity(item.point) !== identity(safe));
  return put([{point: safe, savedAt: now}, ...keep]);
}
export function isSavedMobilityPlace(point, country, now = Date.now()) {
  const safe = project(point, country);
  return Boolean(safe && records(now).some(item => identity(item.point) === identity(safe)));
}
export function forgetSavedMobilityPlace(point, country, now = Date.now()) {
  const safe = project(point, country);
  if (!safe) return false;
  return put(records(now).filter(item => identity(item.point) !== identity(safe)));
}
export function clearSavedMobilityPlaces() {
  try {storage()?.removeItem(KEY); return true;} catch {return false;}
}
export function findSavedMobilityPlaces(country, query, now = Date.now()) {
  const needle = short(query, 140).toLocaleLowerCase();
  if (needle.length < 3) return [];
  return savedMobilityPlaces(country, now).filter(item =>
    [item.formattedAddress, item.label, item.city, item.area].some(part => part.toLocaleLowerCase().includes(needle))
  ).slice(0, 5);
}

/**
 * LX3 public place-search contract. A geocoder match is an approximate place,
 * NOT an approved pickup or proof of a drivable route. Quote services still
 * enforce country/city and verified road-access constraints independently.
 */
import {pointWithinCountryEnvelope} from "./maptiler-geocoding.js";

const COUNTRY_CODES = new Set(["ZW", "MW"]);
const clean = (value, limit = 280) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, limit);
const finite = value => value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));

export function normalizePlaceIntent(candidate, {country, provider = "licensed"} = {}) {
  const code = clean(candidate?.country || country, 2).toUpperCase();
  const lat = Number(candidate?.lat), lng = Number(candidate?.lng);
  if (!COUNTRY_CODES.has(code) || (country && code !== country) ||
      !finite(candidate?.lat) || !finite(candidate?.lng) ||
      !pointWithinCountryEnvelope(code, lat, lng)) return null;
  const label = clean(candidate?.label, 300), city = clean(candidate?.city, 120);
  if (!label || !city) return null;
  const source = ["maptiler", "licensed", "apple_maps", "spotly_entrance", "map_pin"].includes(provider) ? provider : "licensed";
  // Only a separately reviewed Spotly entrance can claim verified status. A
  // provider saying 'address' means a geocoding category, not doorstep proof.
  const locationType = ["landmark", "business_entrance", "address", "map_pin"].includes(candidate?.locationType)
    ? candidate.locationType : "address";
  const verified = source === "spotly_entrance" && candidate?.isVerified === true;
  const precision = verified ? "verified_entrance" : source === "map_pin" ? "selected_pin" : "provider_estimate";
  return {
    id: clean(candidate?.id, 180) || `${source}:${lat.toFixed(6)}:${lng.toFixed(6)}`,
    label, lat, lng, area: clean(candidate?.area, 120), city, country: code,
    source, locationType, precision, isVerified: verified
  };
}

export function uniquePlaceIntents(candidates, {country, provider = "licensed", limit = 6} = {}) {
  const result = [], seen = new Set();
  for (const raw of Array.isArray(candidates) ? candidates : []) {
    const value = normalizePlaceIntent(raw, {country, provider});
    if (!value) continue;
    // Same-name entrances of a chain remain distinct if coordinates differ.
    // Dedup provider repeats at approximately 20 metres, not whole suburbs.
    const identity = `${value.label.split(",")[0].toLowerCase()}:${Math.round(value.lat * 5000)}:${Math.round(value.lng * 5000)}`;
    if (seen.has(identity)) continue;
    seen.add(identity); result.push(value);
    if (result.length >= Math.min(12, Math.max(1, limit))) break;
  }
  return result;
}

export function isSecondaryGeocoderEnabled(value = process.env.SPOTLY_MAP_GEOCODE_FALLBACK_ENABLED) {
  return String(value || "").toLowerCase() === "true";
}

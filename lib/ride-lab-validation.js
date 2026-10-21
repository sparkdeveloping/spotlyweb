import { insideCountryBounds } from "./ride-geography.js";

// Ride Lab is invitation-only shadow data, not an operational dispatch product.
// Keep route selection permissive for short test runs while disallowing the same pin.
export const RIDE_LAB_MIN_SEPARATION_KM = 0.02; // 20 metres straight-line
export const RIDE_LAB_MAX_SEPARATION_KM = 200;

export function rideLabStraightLineKm(a, b) {
  if (!a || !b) return NaN;
  const lat1 = Number(a.lat) * Math.PI / 180;
  const lat2 = Number(b.lat) * Math.PI / 180;
  const dLat = (Number(b.lat) - Number(a.lat)) * Math.PI / 180;
  const dLng = (Number(b.lng) - Number(a.lng)) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function validateRideLabLocations(pickup, dropoff) {
  if (!pickup || !dropoff) return { ok: false, error: "Choose both a pickup location and a destination." };
  if (pickup.country !== dropoff.country) {
    return { ok: false, error: "Ride Lab does not support cross-border test rides. Choose two locations in the same country." };
  }
  if (!insideCountryBounds(pickup, pickup.country) || !insideCountryBounds(dropoff, dropoff.country)) {
    return { ok: false, error: "Both test locations must be within Zimbabwe or Malawi. Check your selected country and pins." };
  }
  const separationKm = rideLabStraightLineKm(pickup, dropoff);
  if (!Number.isFinite(separationKm)) {
    return { ok: false, error: "One of the test pins is invalid. Choose both locations again." };
  }
  if (separationKm < RIDE_LAB_MIN_SEPARATION_KM) {
    return { ok: false, separationKm, error: "The two pins are effectively the same place. Move pickup or destination at least 20 metres apart." };
  }
  if (separationKm > RIDE_LAB_MAX_SEPARATION_KM) {
    return { ok: false, separationKm, error: "Ride Lab only supports test routes up to 200 km apart (straight-line distance). Move one pin closer." };
  }
  return { ok: true, error: "", separationKm };
}

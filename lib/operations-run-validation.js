export const OPERATIONS_RIDE_MIN_SEPARATION_KM = 0.02;

export function operationsRideStraightLineKm(a, b) {
  const lat1 = Number(a?.lat), lng1 = Number(a?.lng), lat2 = Number(b?.lat), lng2 = Number(b?.lng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return Number.NaN;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const p1 = lat1 * rad, p2 = lat2 * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function validateOperationsRideLocations(pickup, dropoff) {
  if (!pickup || !dropoff) return { ok: false, error: "Choose both pickup and destination." };
  if (pickup.country !== dropoff.country) return { ok: false, error: "Operations Ride does not support cross-border runs." };
  const separationKm = operationsRideStraightLineKm(pickup, dropoff);
  if (!Number.isFinite(separationKm) || separationKm < OPERATIONS_RIDE_MIN_SEPARATION_KM) return { ok: false, separationKm, error: "Choose two distinct locations at least 20 metres apart." };
  if (separationKm > 200) return { ok: false, separationKm, error: "Operations Ride only supports routes up to 200 km apart." };
  return { ok: true, separationKm };
}

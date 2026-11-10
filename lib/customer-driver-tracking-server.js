import "server-only";

function normalizeRealtimeLocation(value, expectedDriverId) {
  if (!value || typeof value !== "object") return null;
  if (expectedDriverId && value.driverId && String(value.driverId) !== String(expectedDriverId)) return null;
  const lat = Number(value.lat), lng = Number(value.lng), updatedAt = Number(value.updatedAt);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (!Number.isFinite(updatedAt) || Date.now() - updatedAt > 180_000 || updatedAt > Date.now() + 60_000) return null;
  return { lat, lng, ...(Number.isFinite(Number(value.accuracy)) ? { accuracy: Number(value.accuracy) } : {}), updatedAt: new Date(updatedAt).toISOString(), source: "realtime_active_work" };
}

export async function loadRealtimeDriverLocation(database, { workId, driverId } = {}) {
  if (!database || !workId || !driverId) return null;
  try {
    const snap = await database.ref(`activeTrips/${workId}/driverLocation`).get();
    return normalizeRealtimeLocation(snap.val(), driverId);
  } catch {
    return null;
  }
}

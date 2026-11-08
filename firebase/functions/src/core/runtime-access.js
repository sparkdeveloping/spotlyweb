import { spotlyAdmin } from "./admin.js";

export const RTDB_PATHS = Object.freeze({
  driverPresence: (uid) => `driverPresence/${uid}`,
  dispatchPresence: (country, area, uid) => `dispatchPresence/${country}/${area}/${uid}`,
  activeTrip: (tripId) => `activeTrips/${tripId}`,
  driverEligible: (uid) => `runtimeAccess/driverEligible/${uid}`,
  driverPresenceReaders: (uid) => `runtimeAccess/driverPresenceReaders/${uid}`,
  driverDispatchScope: (uid) => `runtimeAccess/driverDispatchScope/${uid}`,
  tripAccess: (tripId) => `runtimeAccess/activeTrips/${tripId}`
});

export async function setDriverRuntimeEligibility(uid, eligible) {
  if (!uid) throw new Error("Driver uid is required.");
  const { database } = spotlyAdmin();
  await database.ref(RTDB_PATHS.driverEligible(uid)).set(eligible === true ? true : null);
}

export async function setDriverPresenceReaders(uid, readerIds = []) {
  if (!uid) throw new Error("Driver uid is required.");
  const { database } = spotlyAdmin();
  const readers = Object.fromEntries([...new Set(readerIds.filter(Boolean))].map((readerId) => [readerId, true]));
  await database.ref(RTDB_PATHS.driverPresenceReaders(uid)).set(Object.keys(readers).length ? readers : null);
}

export async function setDriverDispatchScopes(uid, scopes = []) {
  if (!uid) throw new Error("Driver uid is required.");
  const { database } = spotlyAdmin();
  const value = {};
  for (const scope of scopes) {
    const country = String(scope?.country || "").trim().toUpperCase();
    const area = String(scope?.area || "").trim();
    if (!country || !area) continue;
    value[country] ||= {};
    value[country][area] = true;
  }
  await database.ref(RTDB_PATHS.driverDispatchScope(uid)).set(Object.keys(value).length ? value : null);
}

export async function authorizeActiveTrip({ tripId, driverId, readerIds = [] }) {
  if (!tripId || !driverId) throw new Error("Trip id and Driver id are required.");
  const { database } = spotlyAdmin();
  const readers = Object.fromEntries([...new Set([driverId, ...readerIds].filter(Boolean))].map((uid) => [uid, true]));
  await database.ref(RTDB_PATHS.tripAccess(tripId)).set({
    drivers: { [driverId]: true },
    readers
  });
}

export async function clearActiveTripRuntime(tripId) {
  if (!tripId) return;
  const { database } = spotlyAdmin();
  await Promise.all([
    database.ref(RTDB_PATHS.tripAccess(tripId)).remove(),
    database.ref(RTDB_PATHS.activeTrip(tripId)).remove()
  ]);
}

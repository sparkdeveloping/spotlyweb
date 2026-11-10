import * as logger from "firebase-functions/logger";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { spotlyAdmin } from "./admin.js";

export const DRIVER_LOCATION_RETENTION = Object.freeze({
  dispatchStaleMs: 10 * 60_000,
  presenceLocationMs: 30 * 60_000,
  activeTripMs: 24 * 60 * 60_000,
  firestoreLocationMs: 24 * 60 * 60_000
});

function number(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function millis(value) { return value?.toMillis?.() || (value instanceof Date ? value.getTime() : number(value)); }

export async function sweepDriverLocationRetention({ now = Date.now() } = {}) {
  const { database, firestore } = spotlyAdmin();
  const stats = { dispatchRemoved: 0, presenceLocationsRemoved: 0, activeTripsRemoved: 0, firestoreLocationsRemoved: 0 };

  const [dispatchSnapshot, presenceSnapshot, activeSnapshot, accessSnapshot] = await Promise.all([
    database.ref("dispatchPresence").get().catch(() => null),
    database.ref("driverPresence").get().catch(() => null),
    database.ref("activeTrips").get().catch(() => null),
    database.ref("runtimeAccess/activeTrips").get().catch(() => null)
  ]);
  const updates = {};

  const dispatch = dispatchSnapshot?.exists?.() ? dispatchSnapshot.val() || {} : {};
  for (const [country, areas] of Object.entries(dispatch)) for (const [area, drivers] of Object.entries(areas || {})) for (const [uid, row] of Object.entries(drivers || {})) {
    if (!number(row?.updatedAt) || now - number(row.updatedAt) > DRIVER_LOCATION_RETENTION.dispatchStaleMs) {
      updates[`dispatchPresence/${country}/${area}/${uid}`] = null; stats.dispatchRemoved += 1;
    }
  }

  const presence = presenceSnapshot?.exists?.() ? presenceSnapshot.val() || {} : {};
  for (const [uid, row] of Object.entries(presence)) {
    if (row?.location && (!number(row.updatedAt) || now - number(row.updatedAt) > DRIVER_LOCATION_RETENTION.presenceLocationMs || row.state === "offline")) {
      updates[`driverPresence/${uid}/location`] = null; stats.presenceLocationsRemoved += 1;
    }
  }

  const active = activeSnapshot?.exists?.() ? activeSnapshot.val() || {} : {};
  const access = accessSnapshot?.exists?.() ? accessSnapshot.val() || {} : {};
  for (const [tripId, row] of Object.entries(active)) {
    const locationUpdatedAt = number(row?.driverLocation?.updatedAt);
    if (!access?.[tripId] || !locationUpdatedAt || now - locationUpdatedAt > DRIVER_LOCATION_RETENTION.activeTripMs) {
      updates[`activeTrips/${tripId}`] = null;
      updates[`runtimeAccess/activeTrips/${tripId}`] = null;
      stats.activeTripsRemoved += 1;
    }
  }
  if (Object.keys(updates).length) await database.ref().update(updates);

  const cutoff = Timestamp.fromMillis(now - DRIVER_LOCATION_RETENTION.firestoreLocationMs);
  const stalePresence = await firestore.collection("driverPresence").where("locationUpdatedAt", "<", cutoff).limit(300).get().catch(() => null);
  if (stalePresence?.docs?.length) {
    const batch = firestore.batch();
    for (const doc of stalePresence.docs) {
      batch.set(doc.ref, { currentLocation: FieldValue.delete(), locationUpdatedAt: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      stats.firestoreLocationsRemoved += 1;
    }
    await batch.commit();
  }

  logger.info("Driver location retention sweep completed", stats);
  return stats;
}


async function deleteQueryBatch(firestore, query, limit = 300) {
  const snapshot = await query.limit(limit).get().catch(() => null);
  if (!snapshot?.docs?.length) return 0;
  const batch = firestore.batch();
  snapshot.docs.forEach((document) => batch.delete(document.ref));
  await batch.commit();
  return snapshot.docs.length;
}

export async function sweepSecurityRetention({ now = Date.now() } = {}) {
  const { firestore } = spotlyAdmin();
  const settingsSnapshot = await firestore.collection("platformSettings").doc("global").get().catch(() => null);
  const configuredDays = Number(settingsSnapshot?.data?.()?.security?.auditRetentionDays || 730);
  const auditRetentionDays = Math.min(Math.max(Number.isFinite(configuredDays) ? configuredDays : 730, 90), 2555);
  const expired = Timestamp.fromMillis(now);
  const auditCutoff = Timestamp.fromMillis(now - auditRetentionDays * 24 * 60 * 60_000);
  const stats = { rateLimitsRemoved: 0, securityRateLimitsRemoved: 0, auditLogsRemoved: 0, auditRetentionDays };

  stats.rateLimitsRemoved = await deleteQueryBatch(firestore, firestore.collection("rateLimits").where("expiresAt", "<", expired));
  stats.securityRateLimitsRemoved = await deleteQueryBatch(firestore, firestore.collection("securityRateLimits").where("expiresAt", "<", expired));
  stats.auditLogsRemoved = await deleteQueryBatch(firestore, firestore.collection("auditLogs").where("createdAt", "<", auditCutoff));

  logger.info("Spotly security retention sweep completed", stats);
  return stats;
}

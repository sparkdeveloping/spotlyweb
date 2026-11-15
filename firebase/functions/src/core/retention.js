import * as logger from "firebase-functions/logger";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { spotlyAdmin } from "./admin.js";
import { drainExpiredQuotaPages } from "./quota-retention.js";
import { summarizeDriverRetentionScan } from "./retention-scan-metrics.js";

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
  Object.assign(stats, summarizeDriverRetentionScan({ dispatch, presence, active, access }));
  // No additional RTDB query: these counts measure the current full-tree
  // approach, allowing a separately tested indexed/expiry migration later.
  if (stats.dispatchDriversScanned > 1_000 || stats.presenceDriversScanned > 2_000 || stats.activeTripsScanned > 500) {
    logger.warn("Driver retention sweep is reading large RTDB trees; review indexing before fleet growth", {
      dispatchDriversScanned: stats.dispatchDriversScanned,
      presenceDriversScanned: stats.presenceDriversScanned,
      activeTripsScanned: stats.activeTripsScanned
    });
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
  const snapshot = await query.limit(limit).get();
  if (!snapshot?.docs?.length) return 0;
  const batch = firestore.batch();
  snapshot.docs.forEach((document) => batch.delete(document.ref));
  await batch.commit();
  return snapshot.docs.length;
}

function retentionPageBudget() {
  const configured = Number(process.env.SPOTLY_RETENTION_QUOTA_MAX_PAGES || 4);
  return Number.isSafeInteger(configured) ? Math.min(Math.max(configured, 1), 12) : 4;
}

export async function sweepSecurityRetention({ now = Date.now() } = {}) {
  const { firestore } = spotlyAdmin();
  const settingsSnapshot = await firestore.collection("platformSettings").doc("global").get().catch(() => null);
  const configuredDays = Number(settingsSnapshot?.data?.()?.security?.auditRetentionDays || 730);
  const auditRetentionDays = Math.min(Math.max(Number.isFinite(configuredDays) ? configuredDays : 730, 90), 2555);
  const expired = Timestamp.fromMillis(now);
  const auditCutoff = Timestamp.fromMillis(now - auditRetentionDays * 24 * 60 * 60_000);
  const maxPages = retentionPageBudget();
  const stats = {
    rateLimitsRemoved: 0, securityRateLimitsRemoved: 0,
    rateLimitPages: 0, securityRateLimitPages: 0,
    rateLimitBacklogPossible: false, securityRateLimitBacklogPossible: false,
    quotaPageSize: 250, quotaMaxPages: maxPages,
    auditLogsRemoved: 0, auditRetentionDays
  };

  const rate = await drainExpiredQuotaPages(firestore, { collection: "rateLimits", cutoff: expired, pageSize: 250, maxPages });
  const security = await drainExpiredQuotaPages(firestore, { collection: "securityRateLimits", cutoff: expired, pageSize: 250, maxPages });
  stats.rateLimitsRemoved = rate.removed;
  stats.securityRateLimitsRemoved = security.removed;
  stats.rateLimitPages = rate.pages;
  stats.securityRateLimitPages = security.pages;
  stats.rateLimitBacklogPossible = rate.couldHaveBacklog;
  stats.securityRateLimitBacklogPossible = security.couldHaveBacklog;
  // Audit history is a separate policy. Do not accelerate or apply TTL to
  // auditLogs without a retention/legal review; preserve the existing cap.
  stats.auditLogsRemoved = await deleteQueryBatch(firestore, firestore.collection("auditLogs").where("createdAt", "<", auditCutoff));

  logger.info("Spotly security retention sweep completed", stats);
  return stats;
}

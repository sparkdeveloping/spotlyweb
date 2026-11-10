import "server-only";

import { getAdminServices } from "@/lib/firebase-admin";

function realtimePresenceRow(id, raw = {}) {
  const updatedAt = Number(raw.updatedAt || 0);
  const location = raw.location && Number.isFinite(Number(raw.location.lat)) && Number.isFinite(Number(raw.location.lng))
    ? { lat: Number(raw.location.lat), lng: Number(raw.location.lng), accuracy: Number(raw.location.accuracy || 0) }
    : null;
  return {
    id,
    data: {
      online: raw.state === "online",
      availabilityState: raw.state === "busy" ? "on_job" : raw.state === "online" ? "online" : "offline",
      currentJobId: raw.currentJobId || null,
      currentWorkType: raw.currentWorkType || null,
      currentLocation: location,
      locationUpdatedAt: updatedAt ? { toMillis: () => updatedAt } : null,
      vehicleId: raw.vehicleId || null,
      country: raw.country || null,
      area: raw.area || null,
      source: "rtdb"
    }
  };
}

// Migration bridge: RTDB is the new high-frequency source, while legacy web
// Driver sessions remain eligible until every client has moved off Firestore.
export async function loadDispatchPresence(dbOverride = null) {
  const { db, database } = getAdminServices();
  const firestore = dbOverride || db;
  const [legacy, realtime] = await Promise.all([
    firestore.collection("driverPresence").where("online", "==", true).limit(200).get().catch(() => ({ docs: [] })),
    database.ref("driverPresence").get().catch(() => null)
  ]);
  const merged = new Map();
  for (const item of legacy.docs || []) merged.set(item.id, { id: item.id, data: item.data() || {} });
  const raw = realtime?.exists?.() ? realtime.val() || {} : {};
  for (const [id, presence] of Object.entries(raw)) {
    if (presence?.state !== "online") {
      if (merged.get(id)?.data?.source === "rtdb") merged.delete(id);
      continue;
    }
    merged.set(id, realtimePresenceRow(id, presence));
  }
  return [...merged.values()];
}

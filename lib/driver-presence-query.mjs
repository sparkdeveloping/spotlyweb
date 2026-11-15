/**
 * C6 opt-in indexed RTDB dispatch candidate retrieval.
 * Queries all online entries (no limit) to preserve dispatch eligibility at
 * any fleet size. A missing index, transient error or unconfigured rollout
 * falls back to the original complete tree read.
 */
export async function getDriverPresenceSnapshot(database, {
  indexed = process.env.SPOTLY_RTDB_INDEXED_PRESENCE_READS === "true"
} = {}) {
  const root = database.ref("driverPresence");
  if (!indexed) return root.get();
  try {
    return await root.orderByChild("state").equalTo("online").get();
  } catch {
    return root.get();
  }
}

import "server-only";
import { canShowDirectoryRecord } from "@/lib/nxt-policy";
let cache = { until: 0, value: false };
export async function unclaimedPublicationEnabled(db) {
  // One cached read per warm function instance per minute reduces Firestore
  // billing for every homepage visit. Publishing changes propagate within 60s.
  if (cache.until > Date.now()) return cache.value;
  const doc = await db.collection("platformSettings").doc("global").get();
  const flag = doc.data()?.verification?.publishUnclaimed === true;
  cache = { until: Date.now() + 60_000, value: flag };
  return flag;
}
export async function publicDirectoryAllowed(db, source) {
  const enabled = await unclaimedPublicationEnabled(db);
  return canShowDirectoryRecord(source, enabled);
}

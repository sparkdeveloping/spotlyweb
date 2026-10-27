import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { randomInt } from "node:crypto";
import { normalizeAttribution } from "@/lib/first-access";

export function utcDateKey(now = new Date()) { return now.toISOString().slice(0, 10); }
export function acquisitionRollup(db, type, attribution, { interests = [], city = "", timeframe = "", audience = "" } = {}) {
  const channel = normalizeAttribution(attribution).channel;
  const day = utcDateKey();
  const field = { view: "views", signup_start: "starts", registration: "registrations" }[type];
  if (!field) throw new Error("Unsupported acquisition event.");
  const update = { [field]: FieldValue.increment(1), channels: { [channel]: FieldValue.increment(1) }, byEvent: { [field]: { [channel]: FieldValue.increment(1) } }, updatedAt: FieldValue.serverTimestamp() };
  if (type === "registration") {
    const normalizedCity = String(city).trim().toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").slice(0, 50);
    const knownCities = ["harare", "bulawayo", "chitungwiza", "mutare", "gweru", "masvingo", "victoria_falls", "other_city"];
    update.cities = { [knownCities.includes(normalizedCity) ? normalizedCity : normalizedCity ? "other" : "unspecified"]: FieldValue.increment(1) };
    if (["asap", "this_month", "exploring"].includes(timeframe)) update.timeframes = { [timeframe]: FieldValue.increment(1) };
    if (["customer", "business", "driver"].includes(audience)) update.audiences = { [audience]: FieldValue.increment(1) };
    for (const item of new Set(interests)) {
      if (["bite", "shopper", "ride", "send", "book", "live", "places", "business", "assist"].includes(item)) {
        update.interests ||= {};
        update.interests[item] = FieldValue.increment(1);
      }
    }
  }
  const batch = db.batch();
  // Shard hot launch-day counters to avoid writing every pageview to one Firestore document.
  const shard = String(randomInt(32)).padStart(2, "0");
  batch.set(db.collection("firstAccessMetrics").doc(`${day}_${shard}`), { date: day, ...update }, { merge: true });
  const campaign = String(attribution?.utm_campaign || "").toLowerCase().replace(/[^a-z0-9_-]/g, "-").slice(0, 70);
  if (campaign) batch.set(db.collection("firstAccessCampaignMetrics").doc(`${day}_${campaign}_${String(randomInt(16)).padStart(2, "0")}`), {
    day, campaign, channel, [field]: FieldValue.increment(1), byEvent: { [field]: { [channel]: FieldValue.increment(1) } }, updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return batch.commit();
}

import "server-only";
import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { driverAcquisitionAttribution, driverAcquisitionSlug, DRIVER_ACQUISITION_EVENTS } from "./driver-acquisition.js";

const EVENT_FIELDS = Object.freeze({
  view: "views",
  start: "starts",
  contact_complete: "contactCompletes",
  submission: "submissions",
  new_lead: "newLeads",
});

const cleanDimension = (value, max = 80) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "").slice(0, max);
const hash = (value) => createHash("sha256").update(String(value || "")).digest("hex");
export const driverAcquisitionDateKey = (date = new Date()) => date.toISOString().slice(0, 10);

export async function publicDriverCampaign(db, slug = "") {
  const clean = driverAcquisitionSlug(slug);
  if (!clean) return null;
  const snapshot = await db.collection("driverAcquisitionCampaigns").doc(clean).get();
  if (!snapshot.exists) return null;
  const value = snapshot.data() || {};
  if (value.status === "archived") return null;
  return { id: snapshot.id, ...value };
}

export async function recordDriverAcquisitionEvent(db, {
  event,
  campaign = null,
  campaignSlug = "",
  sessionId = "",
  attribution = {},
  country = "",
  city = "",
} = {}) {
  if (!DRIVER_ACQUISITION_EVENTS.includes(event)) throw new Error("Unsupported Driver acquisition event.");
  const field = EVENT_FIELDS[event];
  const slug = driverAcquisitionSlug(campaign?.id || campaign?.slug || campaignSlug) || "organic";
  const day = driverAcquisitionDateKey();
  const safeSession = String(sessionId || "").trim().slice(0, 120);
  if (!safeSession) return false;
  const sessionHash = hash(`${day}|${slug}|${safeSession}`);
  const sessionRef = db.collection("driverAcquisitionSessions").doc(sessionHash);
  const shard = String(Number.parseInt(sessionHash.slice(0, 2), 16) % 16).padStart(2, "0");
  const metricRef = db.collection("driverAcquisitionMetrics").doc(`${day}_${slug}_${shard}`);
  const normalized = driverAcquisitionAttribution(attribution);
  const channel = cleanDimension(normalized.channel || "direct", 40) || "direct";
  const countryKey = cleanDimension(country || campaign?.country, 12);
  const cityKey = cleanDimension(city || campaign?.city, 60);
  let recorded = false;
  await db.runTransaction(async (tx) => {
    const sessionSnap = await tx.get(sessionRef);
    const seen = sessionSnap.exists ? (sessionSnap.data()?.events || {}) : {};
    if (seen[field] === true) return;
    recorded = true;
    tx.set(sessionRef, {
      day,
      campaignSlug: slug,
      events: { [field]: true },
      updatedAt: FieldValue.serverTimestamp(),
      ...(sessionSnap.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    }, { merge: true });
    const update = {
      day,
      campaignSlug: slug,
      [field]: FieldValue.increment(1),
      channels: { [channel]: FieldValue.increment(1) },
      byEvent: { [field]: { [channel]: FieldValue.increment(1) } },
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (countryKey) update.countries = { [countryKey]: FieldValue.increment(1) };
    if (cityKey) update.cities = { [cityKey]: FieldValue.increment(1) };
    tx.set(metricRef, update, { merge: true });
  });
  return recorded;
}

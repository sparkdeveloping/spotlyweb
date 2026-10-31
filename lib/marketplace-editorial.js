import { approvedTheMenuPhoto } from "./themenu-source-policy.js";
import { businessPhotography, businessPhotoFamily } from "./business-photography.js";

function validPhoto(value) {
  if (typeof value !== "string" || !value.trim() || /\/marketplace\/(?:editorial|editorial-pack)\//i.test(value) || /\.(?:svg|gif)(?:[?#]|$)/i.test(value) || /(?:^|\/)(?:logos?|avatars?|icons?)(?:\/|[._-])/i.test(value)) return "";
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password ? value : ""; } catch { return ""; }
}

function merchantPhoto(record = {}) {
  const evidence = record.imageProvenance || {};
  const source = record.source || {};
  const url = validPhoto(record.coverImage || record.image || record.imageUrl || record.photoUrl || record.media?.cover || record.media?.hero);
  if (!url || url === record.logoUrl || url === record.logo) return "";
  if ((Number(evidence.width) > 0 && Number(evidence.width) < 640) || (Number(evidence.height) > 0 && Number(evidence.height) < 360)) return "";
  const directory = ["openstreetmap", "spotly_assist_research"].includes(source.type);
  if (directory && !["merchant_owned", "licensed"].includes(source.rightsStatus)) return "";
  // Fresh merchant uploads and explicitly approved, business-matched photos win.
  const hostedUpload = url.startsWith("https://firebasestorage.googleapis.com/") && !directory;
  const approved = evidence.approved === true && evidence.businessId === record.id && ["merchant_owned", "licensed"].includes(evidence.rightsStatus);
  const owned = source.rightsStatus === "merchant_owned" || (source.rightsStatus === "licensed" && evidence.locationMatched === true);
  return hostedUpload || approved || owned ? url : "";
}

export function marketplaceFallbackMedia(record = {}) { return businessPhotography(record); }

export function marketplaceMedia(record = {}) {
  const licensed = approvedTheMenuPhoto(record);
  if (licensed) return { ...licensed, generated: false, family: businessPhotoFamily(record) };
  const owned = merchantPhoto(record);
  if (owned) return { src: owned, kind: "merchant", label: "", generated: false, family: businessPhotoFamily(record), position: record.imageProvenance?.position || "50% 50%" };
  return marketplaceFallbackMedia(record);
}

export function marketplaceMediaSet(records = []) {
  // Never remove a picture because another business shares its category. Card and
  // profile must resolve the same subject regardless of list order or pagination.
  return new Map(records.map((record) => [record.id || [record.name, record.city, record.area].filter(Boolean).join("|"), marketplaceMedia(record)]));
}

export function marketplaceEditorialImage(record = {}) { return marketplaceMedia(record).src; }
export function shouldUseEditorialImage(record = {}) { return marketplaceMedia(record).kind === "editorial"; }
export function marketplaceEditorialPoolSize() { return 1; }

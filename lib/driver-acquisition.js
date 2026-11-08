import { normalizeAttribution } from "./first-access.js";

export const DRIVER_ACQUISITION_EVENTS = Object.freeze(["view", "start", "contact_complete", "submission", "new_lead"]);
export const DRIVER_ACQUISITION_MEDIA = Object.freeze(["qr_flyer", "qr_poster", "qr_card", "social", "referral", "direct", "other"]);

export function driverAcquisitionSlug(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

export function driverAcquisitionUrl(slug = "") {
  const clean = driverAcquisitionSlug(slug);
  return clean ? `https://driver.spotlyafrica.com/join/${clean}` : "https://driver.spotlyafrica.com/join";
}

export function driverAcquisitionAttribution(input = {}) {
  return normalizeAttribution(input);
}

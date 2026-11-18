// Pure, dependency-free rules shared by the Admin import gate and its tests.
// These records are outreach evidence, never registration or approval evidence.
export const FIELD_ARCHIVE_KEY = "spotly-field-outreach-2026-11-18";
export const OUTREACH_CLASSIFICATIONS = Object.freeze([
  "No reply", "Human engagement", "Automated only", "Declined", "Contact-source question", "Media-only reply"
]);
export function fieldArchiveProspectId(sourceId) {
  if (!/^OUT-\d{3,4}$/.test(sourceId || "")) throw new Error("Invalid archive source ID");
  return `field-2026-${sourceId.toLowerCase()}`;
}
export function fieldArchiveMessageId(sourceId, index) {
  if (!Number.isSafeInteger(index) || index < 0 || index > 1000) throw new Error("Invalid message index");
  return `${fieldArchiveProspectId(sourceId)}-${String(index).padStart(4, "0")}`;
}
export function fieldArchiveStatus(classification) {
  if (classification === "Declined" || classification === "Contact-source question") return "do_not_contact";
  return classification === "Human engagement" ? "contacted" : "attempted";
}
export function cleanHistoricalSnippet(value, limit = 4900) {
  return String(value || "").replace(/\u0000/g, "").slice(0, limit);
}
export function safeHistoricalDate(value) {
  if (!/^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.test(value || "")) return "";
  const parsed = new Date(value + "T12:00:00Z");
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? "" : value;
}

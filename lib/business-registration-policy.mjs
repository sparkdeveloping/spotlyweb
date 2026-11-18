import { createHash } from "node:crypto";
// No raw phone, email or other contact details are used in public document IDs.
export function normalizeRegistrationKey(value) {
  const key = String(value || "").trim();
  return /^[0-9a-f-]{25,80}$/i.test(key) ? key.toLowerCase() : "";
}
export function registrationDocumentId(key, country, phone) {
  const normalizedKey = normalizeRegistrationKey(key);
  if (!normalizedKey) return "";
  return "br_" + createHash("sha256").update([normalizedKey, String(country).toUpperCase(), String(phone).replace(/\D/g, "")].join(":"), "utf8").digest("hex").slice(0,40);
}
export function continuationProof(key, registrationId) {
  const normalized = normalizeRegistrationKey(key);
  if (!normalized || !/^br_[a-f0-9]{40}$/.test(String(registrationId || ""))) return "";
  return createHash("sha256").update(`spotly-business-registration-v1:${registrationId}:${normalized}`, "utf8").digest("hex");
}
export function safeRegistrationStatus(status) { return ["new","seen","contacted","qualified","verification_invited","closed"].includes(status) ? status : "new"; }
export function publicRegistrationReceipt(id) { return {ok:true, registrationId:id, status:"received", next:"Spotly will review your request. No account or listing has been approved."}; }

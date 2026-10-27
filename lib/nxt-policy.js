// NXT is a partner workspace, not a platform administrator. No NXT role
// grants publication, verified business ownership, payment or beta authority.
export const NXT_ROLES = Object.freeze({
  nxt_manager: { label: "NXT Lead", permissions: ["read", "prospects", "outreach", "handover", "evidence", "campaigns", "team", "import", "export", "visibility_preview"] },
  nxt_supervisor: { label: "Team supervisor", permissions: ["read", "prospects", "outreach", "handover", "evidence", "campaigns", "export"] },
  nxt_outreach: { label: "Outreach specialist", permissions: ["read", "prospects", "outreach", "evidence", "campaigns"] },
  nxt_analyst: { label: "Reporting analyst", permissions: ["read", "campaigns", "export"] }
});
export const NXT_STATUSES = ["new", "researching", "ready", "attempted", "contacted", "interested", "meeting", "onboarding", "converted", "not_interested", "do_not_contact"];
export const NXT_CHANNELS = ["call", "email", "whatsapp", "visit", "social", "meeting", "other"];
export const NXT_OUTCOMES = ["no_answer", "voicemail", "connected", "callback", "interested", "meeting_booked", "not_interested", "wrong_number", "opt_out", "sent", "replied"];
export function nxtRole(profile = {}) {
  const roles = Array.isArray(profile?.roles) ? profile.roles : [];
  return ["nxt_manager", "nxt_supervisor", "nxt_outreach", "nxt_analyst"].find(r => roles.includes(r)) || null;
}
export function hasNxtPermission(profile = {}, permission = "read") {
  if ((Array.isArray(profile?.roles) ? profile.roles : []).some(r => ["admin", "super_admin", "platform_admin"].includes(r))) return true;
  return NXT_ROLES[nxtRole(profile)]?.permissions.includes(permission) || false;
}
export function canDelegateNxtRole(actor, requested) {
  if (!Object.hasOwn(NXT_ROLES, requested)) return false;
  if ((Array.isArray(actor?.roles) ? actor.roles : []).some(r => ["admin", "super_admin", "platform_admin"].includes(r))) return true;
  return nxtRole(actor) === "nxt_manager" && requested !== "nxt_manager";
}
export function isVerifiedClaim(b = {}) {
  const ownership = b.claimStatus === "claimed" || (Array.isArray(b.ownerIds) && b.ownerIds.length > 0);
  return ownership && b.verificationStatus === "approved";
}
export function canShowDirectoryRecord(b = {}, showUnclaimed = false) {
  if (b.public !== true || b.suspension?.active || b.status === "suspended") return false;
  return isVerifiedClaim(b) || showUnclaimed === true;
}
export function cleanProspect(item = {}) {
  const fields = ["name", "category", "description", "city", "address", "phone", "email", "website", "contactName", "contactRole", "sourceNote", "priority", "nextAction"];
  return Object.fromEntries(fields.filter(k => typeof item[k] === "string").map(k => [k, item[k].trim().slice(0, k === "description" || k === "sourceNote" ? 1400 : 240)]));
}
export function csvSafe(value) {
  const raw = String(value ?? "");
  return '"' + (/^[=+\-@\t\r]/.test(raw) ? "'" : "") + raw.replaceAll('"', '""') + '"';
}

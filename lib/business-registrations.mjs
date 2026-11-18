// Business acquisition leads are not ownership grants or approved business claims.
export const REGISTRATION_STATUS_OPTIONS = Object.freeze([
  { id: "registered", label: "Registered business" },
  { id: "in_process", label: "Registration in progress" },
  { id: "not_registered", label: "Not yet registered" }
]);
export const REGISTRATION_STATUS_LABELS = Object.freeze(Object.fromEntries(REGISTRATION_STATUS_OPTIONS.map(x => [x.id,x.label])));
export const CONTACT_PREFERENCE_OPTIONS = Object.freeze([
  { id: "whatsapp", label: "WhatsApp" },
  { id: "phone", label: "Phone call" },
  { id: "email", label: "Email" }
]);
export const CONTACT_PREFERENCE_LABELS = Object.freeze(Object.fromEntries(CONTACT_PREFERENCE_OPTIONS.map(x=>[x.id,x.label])));
export const LEAD_STATUSES = Object.freeze(["new","seen","contacted","qualified","verification_invited","closed"]);
export function safeLeadStatus(status) { return LEAD_STATUSES.includes(status) ? status : "new"; }
export function leadSummary(record={}) { return {id:record.id, businessName:record.businessName || "", status:safeLeadStatus(record.status), country:record.country || "", city:record.city || ""}; }

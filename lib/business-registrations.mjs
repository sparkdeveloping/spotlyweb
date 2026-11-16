export const REGISTRATION_STATUS_OPTIONS = [
  {
    id: "registered",
    label: "Registered",
    description: "Officially registered with the relevant authorities."
  },
  {
    id: "in_process",
    label: "In the process",
    description: "Registration is currently underway or pending approval."
  },
  {
    id: "not_registered",
    label: "Not registered",
    description: "Operating or starting out, not formally registered yet."
  }
];

export const ROLE_AT_BUSINESS_OPTIONS = [
  { id: "owner", label: "Owner or director" },
  { id: "manager", label: "Manager" },
  { id: "authorized_representative", label: "Authorized representative" },
  { id: "other", label: "Other" }
];

export const CONTACT_PREFERENCE_OPTIONS = [
  { id: "whatsapp", label: "WhatsApp" },
  { id: "phone", label: "Phone call" },
  { id: "email", label: "Email" }
];

export const REGISTRATION_STATUS_LABELS = Object.fromEntries(
  REGISTRATION_STATUS_OPTIONS.map((item) => [item.id, item.label])
);

export const ROLE_AT_BUSINESS_LABELS = Object.fromEntries(
  ROLE_AT_BUSINESS_OPTIONS.map((item) => [item.id, item.label])
);

export const CONTACT_PREFERENCE_LABELS = Object.fromEntries(
  CONTACT_PREFERENCE_OPTIONS.map((item) => [item.id, item.label])
);

export const WORKFLOW_STATUS_LABELS = Object.freeze({
  new: "Unseen",
  seen: "Seen",
  contacted: "Contacted"
});

export function registrationStatusTone(status) {
  if (status === "registered") return "success";
  if (status === "in_process") return "warning";
  return "neutral";
}

export function workflowStatusTone(status, seen) {
  if (status === "contacted") return "success";
  if (seen || status === "seen") return "info";
  return "warning";
}

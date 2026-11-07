import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { DRIVER_CAPABILITIES, capabilitySupportsVehicle } from "./driver-capabilities.js";
import { normalizeDriverPhone, validCountry, validDriverContactPhone } from "./driver-regions.js";

export const LEAD_STAFF_ROLES = ["super_admin", "admin", "platform_admin", "operations_manager", "regional_operations_manager", "driver_operations_coordinator", "driver_recruiter"];
const PRIVILEGED = new Set(["super_admin", "admin", "platform_admin"]);
export function canManageDriverLeads(profile = {}) {
  const roles = new Set(profile.roles || []);
  return [...roles].some((role) => PRIVILEGED.has(role) || LEAD_STAFF_ROLES.includes(role)) || (profile.customPermissions || []).some((p) => ["*", "drivers.*", "drivers.leads.manage"].includes(p));
}
export function canOverrideDriverCountry(profile = {}) {
  const roles = new Set(profile.roles || []);
  return [...roles].some((role) => PRIVILEGED.has(role) || ["operations_manager", "regional_operations_manager"].includes(role)) || (profile.customPermissions || []).some((p) => ["*", "drivers.*", "drivers.country.override"].includes(p));
}
export const leadFieldsSchema = z.object({
  legalName: z.string().trim().min(2).max(160),
  email: z.union([z.literal(""), z.email().max(254)]).default(""),
  phone: z.string().max(40).default(""),
  country: z.string().length(2),
  city: z.string().trim().max(80).default(""),
  vehicleType: z.enum(["", "bicycle", "motorcycle", "car", "van"]).default(""),
  vehicleMake: z.string().trim().max(80).default(""),
  vehicleModel: z.string().trim().max(80).default(""),
  vehicleRegistration: z.string().trim().max(40).default(""),
  licenceReference: z.string().trim().max(100).default(""),
  preferredZones: z.array(z.string().trim().max(100)).max(30).default([]),
  requestedCapabilities: z.array(z.enum(Object.keys(DRIVER_CAPABILITIES))).max(8).default([]),
  notes: z.string().trim().max(1500).default("")
});
export function cleanLead(input) {
  const value = leadFieldsSchema.parse(input);
  if (!validCountry(value.country)) throw Object.assign(new Error("Select a supported country for this Driver record."), { status: 400 });
  value.email = value.email.toLowerCase();
  value.phone = normalizeDriverPhone(value.phone, value.country);
  if (!value.email && !value.phone) throw Object.assign(new Error("Add an email address or a phone number so the Driver can securely claim this profile."), { status: 400 });
  if (value.phone && !validDriverContactPhone(value.phone, value.country)) throw Object.assign(new Error("Add a valid phone number for the selected country."), { status: 400 });
  value.requestedCapabilities = [...new Set(value.requestedCapabilities)].filter((id) => capabilitySupportsVehicle(id, value.vehicleType));
  value.preferredZones = [...new Set(value.preferredZones.filter(Boolean))];
  value.vehicleRegistration = value.vehicleRegistration.toUpperCase();
  return value;
}
export const tokenHash = (token) => createHash("sha256").update(token).digest("hex");
export const contactKey = (kind, value) => tokenHash(`${kind}:${value}`);
export function issueDriverLeadToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: tokenHash(token), invitationExpiresAt: new Date(Date.now() + 30 * 86400000).toISOString() };
}
export function driverLeadInvitationUrl(token) {
  return `https://driver.spotlyafrica.com/complete?token=${encodeURIComponent(token)}`;
}
export function leadPublicData(value = {}, id) {
  // Internal-only projection: never include stored token hashes or internal audit data in the UI.
  const { invitationHash, ...details } = value;
  return { id, ...details };
}
export function authorizedClaim(user, lead) {
  const email = String(user.email || "").trim().toLowerCase();
  const phone = String(user.phone_number || "").trim();
  return Boolean((lead.email && user.email_verified === true && email === lead.email) ||
    (lead.phone && phone && phone === lead.phone));
}

const ALL_ADMIN_SECTIONS = ["home", "work", "marketplace", "mobility", "money", "growth", "team", "system"];

export const ADMIN_SECTION_ALIASES = Object.freeze({
  dashboard: "home", operations: "work", notifications: "work", organizations: "marketplace", businesses: "marketplace", customers: "marketplace",
  drivers: "mobility", finance: "money", content: "growth", people: "team", "platform-map": "system", platform: "system", settings: "system", audit: "system"
});
export function canonicalAdminSection(section = "home") { return ALL_ADMIN_SECTIONS.includes(section) ? section : ADMIN_SECTION_ALIASES[section] || "home"; }
const ROLE_SECTIONS = {
  super_admin: ALL_ADMIN_SECTIONS, admin: ALL_ADMIN_SECTIONS, platform_admin: ALL_ADMIN_SECTIONS,
  operations_manager: ["home","work","marketplace","mobility","team","system"], verification_officer: ["home","work","marketplace"],
  business_success: ["home","work","marketplace","growth"], business_success_manager: ["home","work","marketplace","growth"],
  finance_admin: ["home","work","marketplace","money","team","system"], support_manager: ["home","work","marketplace","team"],
  support_agent: ["home","work","marketplace"], driver_operations_coordinator: ["home","work","mobility"],
  regional_operations_manager: ["home","work","marketplace","mobility","team","system"], content_manager: ["home","marketplace","growth"],
  marketing_manager: ["home","marketplace","growth"], risk_compliance_officer: ["home","work","marketplace","mobility","money","team","system"],
  analytics_viewer: ["home","marketplace","money","growth","system"], data_import_manager: ["home","marketplace","system"],
  auditor: ["home","marketplace","money","team","system"], people_operations_admin: ["home","work","team","system"], people_admin: ["home","work","team","system"]
};
const PERMISSION_SECTIONS = {
  "businesses.":["marketplace","work"], "claims.":["work","marketplace"], "support.":["work","marketplace"], "operations.":["work","mobility"],
  "drivers.":["mobility"], "rides.":["mobility"], "send.":["mobility"], "finance.":["money"], "payments.":["money"], "settlements.":["money"],
  "content.":["growth"], "waitlist.":["growth"], "partnerships.":["growth"], "imports.":["marketplace","system"], "settings.":["system"],
  "admin.":["system"], "system.":["system"], "people.":["team"], "recruitment.":["team"], "payroll.":["team","money"], "audit.":["system"]
};
function hasMappedPermission(permissions=[]) { return permissions.some((permission)=>Object.keys(PERMISSION_SECTIONS).some((prefix)=>permission===prefix.slice(0,-1)||permission.startsWith(prefix)||permission===`${prefix}*`)); }
function hasExplicitAdminGrant(profile) { const roles=profile?.roles||[]; const permissions=profile?.customPermissions||[]; return roles.some((role)=>Boolean(ROLE_SECTIONS[role]))||permissions.includes("*")||hasMappedPermission(permissions); }
export function adminSectionsForProfile(profile) { const roles=profile?.roles||[]; const permissions=profile?.customPermissions||[]; if(!hasExplicitAdminGrant(profile))return new Set(); if(roles.includes("super_admin")||roles.includes("admin")||permissions.includes("*"))return new Set(ALL_ADMIN_SECTIONS); const sections=new Set(["home"]); roles.forEach((role)=>(ROLE_SECTIONS[role]||[]).forEach((section)=>sections.add(section))); permissions.forEach((permission)=>Object.entries(PERMISSION_SECTIONS).forEach(([prefix,values])=>{if(permission===prefix.slice(0,-1)||permission.startsWith(prefix)||permission===`${prefix}*`)values.forEach((section)=>sections.add(section));})); return sections; }
export function hasAdminAccess(profile){return hasExplicitAdminGrant(profile);} export function canAccessAdminSection(profile,section){return adminSectionsForProfile(profile).has(canonicalAdminSection(section));}

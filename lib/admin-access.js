const ALL_ADMIN_SECTIONS = ["dashboard", "operations", "businesses", "drivers", "customers", "finance", "content", "platform", "audit", "settings"];

const ROLE_SECTIONS = {
  super_admin: ALL_ADMIN_SECTIONS,
  admin: ALL_ADMIN_SECTIONS,
  platform_admin: ALL_ADMIN_SECTIONS,
  operations_manager: ["dashboard", "operations", "businesses", "customers", "audit"],
  verification_officer: ["dashboard", "operations", "businesses", "audit"],
  business_success: ["dashboard", "operations", "businesses", "customers", "content"],
  business_success_manager: ["dashboard", "operations", "businesses", "customers", "content"],
  finance_admin: ["dashboard", "businesses", "finance", "audit"],
  support_manager: ["dashboard", "operations", "businesses", "customers", "audit"],
  support_agent: ["dashboard", "operations", "businesses", "customers"],
  content_manager: ["dashboard", "businesses", "content"],
  marketing_manager: ["dashboard", "businesses", "content"],
  risk_compliance_officer: ["dashboard", "operations", "businesses", "finance", "audit"],
  analytics_viewer: ["dashboard", "businesses", "finance", "audit"],
  data_import_manager: ["dashboard", "businesses", "platform", "audit"],
  auditor: ["dashboard", "businesses", "finance", "audit"]
};

const PERMISSION_SECTIONS = {
  "businesses.": ["businesses", "operations"],
  "claims.": ["operations", "businesses"],
  "support.": ["operations", "businesses", "customers"],
  "finance.": ["finance"],
  "content.": ["content"],
  "waitlist.": ["content"],
  "partnerships.": ["content"],
  "imports.": ["businesses", "platform"],
  "settings.": ["settings", "platform"],
  "audit.": ["audit"]
};

export function adminSectionsForProfile(profile) {
  const roles = profile?.roles || [];
  const permissions = profile?.customPermissions || [];
  if (roles.includes("super_admin") || roles.includes("admin") || permissions.includes("*")) return new Set(ALL_ADMIN_SECTIONS);
  const sections = new Set(["dashboard"]);
  roles.forEach((role) => (ROLE_SECTIONS[role] || []).forEach((section) => sections.add(section)));
  permissions.forEach((permission) => {
    Object.entries(PERMISSION_SECTIONS).forEach(([prefix, values]) => {
      if (permission === prefix.slice(0, -1) || permission.startsWith(prefix) || permission === `${prefix}*`) values.forEach((section) => sections.add(section));
    });
  });
  return sections;
}

export function hasAdminAccess(profile) {
  return adminSectionsForProfile(profile).size > 1 || (profile?.roles || []).some((role) => role in ROLE_SECTIONS);
}

export function canAccessAdminSection(profile, section) {
  return adminSectionsForProfile(profile).has(section);
}

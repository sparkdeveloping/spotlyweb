const ADMIN_ROLES = new Set(["super_admin", "admin", "platform_admin"]);
const STAFF_ROLES = new Set([
  "staff", "support_agent", "support_manager", "verification_officer", "business_success_manager",
  "finance_admin", "finance_reviewer", "operations_manager", "regional_operations_manager",
  "driver_operations_coordinator", "people_operations_admin", "content_editor", "platform_admin"
]);
const DRIVER_ROLES = new Set(["driver", "fleet_driver", "fleet_manager", "dispatcher"]);

function active(items = []) {
  return items.filter((item) => !item.status || ["active", "probation", "preboarding"].includes(item.status));
}

export function workspaceAccess({ profile, memberships = [], staffProfile = null, driverProfile = null } = {}) {
  const roles = new Set(profile?.roles || []);
  const activeMemberships = active(memberships);
  const grants = new Set(profile?.workspaceAccess || []);
  const result = new Set(["customer"]);

  if (activeMemberships.length || profile?.businessIds?.length || profile?.organizationIds?.length || grants.has("business")) result.add("business");
  if (driverProfile || profile?.driverProfileId || profile?.driverStatus || [...roles].some((role) => DRIVER_ROLES.has(role)) || grants.has("driver")) result.add("driver");
  if (staffProfile || profile?.staffProfileId || profile?.employmentId || [...roles].some((role) => STAFF_ROLES.has(role)) || grants.has("staff")) result.add("staff");
  if ([...roles].some((role) => ADMIN_ROLES.has(role)) || profile?.customPermissions?.includes("*") || grants.has("admin")) result.add("admin");
  return result;
}

export const WORKSPACE_SETTINGS_ROUTES = Object.freeze({
  customer: "/account",
  business: "/business/settings",
  staff: "/staff/profile",
  driver: "/driver/profile",
  admin: "/admin/platform"
});

export function settingsRouteForWorkspace(workspace) {
  return WORKSPACE_SETTINGS_ROUTES[workspace] || null;
}

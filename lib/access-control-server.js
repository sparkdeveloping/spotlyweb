import "server-only";

const PLATFORM_ADMIN_ROLES = new Set(["super_admin", "admin", "platform_admin"]);
const BUSINESS_WIDE_ROLES = new Set(["organization_owner", "business_owner", "business_manager"]);
const ROLE_LEVEL = {
  organization_owner: 100,
  business_owner: 95,
  business_manager: 80,
  branch_manager: 65,
  finance_manager: 60,
  order_manager: 55,
  catalog_manager: 50,
  order_staff: 35,
  picker: 30,
  finance_viewer: 20
};

export function permissionMatches(granted, required) {
  if (!granted || !required) return false;
  if (granted === "*" || granted === required) return true;
  const [domain] = String(required).split(".");
  return granted === `${domain}.*`;
}

export function profileHasPermission(profile = {}, required) {
  return (profile.customPermissions || []).some((item) => permissionMatches(item, required));
}

export function isPlatformAdmin(user) {
  const roles = new Set(user?.profile?.roles || []);
  return [...roles].some((role) => PLATFORM_ADMIN_ROLES.has(role)) || profileHasPermission(user?.profile, "admin.*");
}

export function hasPlatformPermission(user, required) {
  if (isPlatformAdmin(user)) return true;
  return profileHasPermission(user?.profile, required);
}

export function requirePlatformPermission(user, required, { roles = [] } = {}) {
  const roleSet = new Set(user?.profile?.roles || []);
  if (isPlatformAdmin(user) || roles.some((role) => roleSet.has(role)) || hasPlatformPermission(user, required)) return true;
  throw Object.assign(new Error("Your account does not have permission for this action."), { status: 403 });
}

function membershipActive(membership) {
  if (!membership || membership.status !== "active") return false;
  if (!membership.expiresAt) return true;
  const expires = typeof membership.expiresAt?.toDate === "function" ? membership.expiresAt.toDate() : new Date(membership.expiresAt);
  return Number.isNaN(expires.getTime()) || expires.getTime() > Date.now();
}

export async function getBusinessContext(db, user, businessId) {
  if (!businessId) throw Object.assign(new Error("A business is required."), { status: 400 });
  const businessRef = db.collection("businesses").doc(businessId);
  const businessSnapshot = await businessRef.get();
  if (!businessSnapshot.exists) throw Object.assign(new Error("The business was not found."), { status: 404 });
  const business = { id: businessSnapshot.id, ...businessSnapshot.data() };

  if (isPlatformAdmin(user)) return { business, membership: null, platformAdmin: true, businessWide: true };

  const organizationId = business.organizationId || null;
  let membershipSnapshot = organizationId ? await db.collection("memberships").doc(`${organizationId}_${user.uid}`).get() : null;
  if (!membershipSnapshot?.exists) {
    const fallback = await db.collection("memberships")
      .where("userId", "==", user.uid)
      .where("businessIds", "array-contains", businessId)
      .limit(1)
      .get();
    membershipSnapshot = fallback.empty ? null : fallback.docs[0];
  }
  const membership = membershipSnapshot?.exists ? { id: membershipSnapshot.id, ...membershipSnapshot.data() } : null;
  if (!membershipActive(membership)) return { business, membership, platformAdmin: false, businessWide: false };

  const role = membership.role || "";
  const ownerIds = Array.isArray(business.ownerIds) ? business.ownerIds : [];
  const businessIds = Array.isArray(membership.businessIds) ? membership.businessIds : [];
  const scopeMatches = ownerIds.includes(user.uid) || role === "organization_owner" || membership.businessId === businessId || businessIds.includes(businessId);
  if (!scopeMatches) return { business, membership, platformAdmin: false, businessWide: false };

  return {
    business,
    membership,
    platformAdmin: false,
    businessWide: ownerIds.includes(user.uid) || BUSINESS_WIDE_ROLES.has(role)
  };
}

export function membershipHasPermission(membership, required) {
  return (membership?.permissions || []).some((item) => permissionMatches(item, required));
}

export async function requireBusinessPermission(db, user, businessId, required, { branchId = null, allowRoles = [] } = {}) {
  const context = await getBusinessContext(db, user, businessId);
  if (context.platformAdmin) return context;
  const { membership } = context;
  if (!membershipActive(membership)) throw Object.assign(new Error("Your business access is not active."), { status: 403 });

  const roleAllowed = allowRoles.includes(membership.role);
  const permitted = roleAllowed || membershipHasPermission(membership, required);
  if (!permitted) throw Object.assign(new Error("Your business role does not allow this action."), { status: 403 });

  if (branchId && !context.businessWide) {
    const branchIds = Array.isArray(membership.branchIds) ? membership.branchIds : [];
    if (!branchIds.includes(branchId)) throw Object.assign(new Error("This location is outside your assigned access."), { status: 403 });
  }
  return context;
}

export function roleLevel(role) {
  return ROLE_LEVEL[role] || 0;
}

export function canGrantRole(actorContext, targetRole) {
  if (actorContext.platformAdmin) return true;
  const actorRole = actorContext.membership?.role || "";
  if (actorRole === "organization_owner") return true;
  return roleLevel(targetRole) < roleLevel(actorRole);
}

export function assertGrantSubset(actorContext, { branchIds = [], permissions = [] } = {}) {
  if (actorContext.platformAdmin || actorContext.membership?.role === "organization_owner") return;
  const membership = actorContext.membership || {};
  const actorPermissions = membership.permissions || [];
  const actorBranches = membership.branchIds || [];
  const businessWide = actorContext.businessWide;

  if (!businessWide && branchIds.some((id) => !actorBranches.includes(id))) {
    throw Object.assign(new Error("You cannot grant access to a location outside your own scope."), { status: 403 });
  }
  if (permissions.some((permission) => !actorPermissions.some((granted) => permissionMatches(granted, permission)))) {
    throw Object.assign(new Error("You cannot grant a permission you do not hold."), { status: 403 });
  }
}

export const BUSINESS_ROLE_LEVEL = ROLE_LEVEL;

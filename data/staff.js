export const STAFF_ROLE_PACKS = {
  support_agent: {
    id: "support_agent",
    name: "Support Agent",
    department: "Customer Operations",
    summary: "Responds to customer and business conversations and escalates operational issues.",
    permissions: ["support.read", "support.respond", "users.read", "businesses.read"],
    training: ["Welcome to Spotly", "Security and privacy", "Customer care", "Incident handling"],
    equipment: ["Laptop", "Headset"],
    approvalLimit: 0,
    managerView: false
  },
  verification_officer: {
    id: "verification_officer",
    name: "Business Verification Officer",
    department: "Trust & Verification",
    summary: "Reviews business claims, ownership evidence, parent-company relationships, and publication readiness.",
    permissions: ["claims.read", "claims.review", "claims.approve", "documents.read"],
    training: ["Welcome to Spotly", "Security and privacy", "Business verification", "Data protection"],
    equipment: ["Laptop"],
    approvalLimit: 0,
    managerView: false
  },
  business_success_manager: {
    id: "business_success_manager",
    name: "Business Success Manager",
    department: "Business Operations",
    summary: "Guides merchants through onboarding, catalogue readiness, launch, and ongoing support.",
    permissions: ["businesses.read", "businesses.update", "support.read", "reports.read", "master_products.capture"],
    training: ["Welcome to Spotly", "Business onboarding", "Catalogue operations", "Customer care"],
    equipment: ["Laptop", "Phone", "SIM card"],
    approvalLimit: 0,
    managerView: true
  },
  finance_admin: {
    id: "finance_admin",
    name: "Finance Reviewer",
    department: "Finance",
    summary: "Reviews settlements, payout exceptions, refunds, reconciliation, and payroll preparation.",
    permissions: ["finance.read", "finance.review", "payouts.review", "reports.read"],
    training: ["Welcome to Spotly", "Security and privacy", "Payments operations", "Reconciliation"],
    equipment: ["Laptop"],
    approvalLimit: 5000,
    managerView: false
  },
  operations_manager: {
    id: "operations_manager",
    name: "Operations Manager",
    department: "Operations",
    summary: "Owns operating queues, staffing coverage, escalations, and launch readiness.",
    permissions: ["operations.*", "support.*", "claims.*", "people.approve", "reports.read", "master_products.capture", "master_products.review"],
    training: ["Leadership at Spotly", "Incident command", "Approvals", "People management"],
    equipment: ["Laptop", "Phone", "SIM card"],
    approvalLimit: 10000,
    managerView: true
  },
  driver_operations_coordinator: {
    id: "driver_operations_coordinator",
    name: "Driver Operations Coordinator",
    department: "Driver Operations",
    summary: "Coordinates driver onboarding, fleet documentation, availability, incidents, and field support.",
    permissions: ["drivers.read", "drivers.update", "fleets.read", "incidents.read", "support.read"],
    training: ["Driver operations", "Safety escalation", "Document verification", "Field support"],
    equipment: ["Laptop", "Phone", "SIM card"],
    approvalLimit: 0,
    managerView: false
  },
  regional_operations_manager: {
    id: "regional_operations_manager",
    name: "Regional Operations Manager",
    department: "Operations",
    summary: "Oversees assigned provinces or cities, staffing coverage, business readiness, escalations, and service performance.",
    permissions: ["operations.read", "businesses.read", "support.read", "people.approve", "reports.read"],
    training: ["Regional operations", "People management", "Incident command", "Business readiness"],
    equipment: ["Laptop", "Phone", "SIM card"],
    approvalLimit: 10000,
    managerView: true
  },
  content_editor: {
    id: "content_editor",
    name: "Content Editor",
    department: "Growth & Content",
    summary: "Maintains public content, help resources, training materials, announcements, and translations.",
    permissions: ["content.read", "content.write", "help.write", "announcements.write", "master_products.capture", "master_products.review"],
    training: ["Spotly brand", "Content operations", "Translation workflow", "Publishing controls"],
    equipment: ["Laptop"],
    approvalLimit: 0,
    managerView: false
  },
  people_operations_admin: {
    id: "people_operations_admin",
    name: "People Operations Administrator",
    department: "People Operations",
    summary: "Runs recruitment, onboarding, employee records, leave, payroll preparation, assets, and offboarding.",
    permissions: ["people.*", "recruitment.*", "payroll.prepare", "assets.*", "training.*"],
    training: ["People Operations", "Data protection", "Payroll preparation", "Employee support"],
    equipment: ["Laptop", "Phone"],
    approvalLimit: 0,
    managerView: true
  },
  platform_admin: {
    id: "platform_admin",
    name: "Platform Administrator",
    department: "Technology & Platform",
    summary: "Runs platform configuration, access, incidents, audit, and cross-functional administration.",
    permissions: ["*"],
    training: ["Platform administration", "Security operations", "Audit and access", "Incident command"],
    equipment: ["Laptop", "Phone", "Security key"],
    approvalLimit: 25000,
    managerView: true
  }
};

export const STAFF_ROLE_ALIASES = {
  super_admin: "platform_admin",
  admin: "platform_admin",
  platform_admin: "platform_admin",
  operations_manager: "operations_manager",
  verification_officer: "verification_officer",
  business_success: "business_success_manager",
  business_success_manager: "business_success_manager",
  finance_admin: "finance_admin",
  support_manager: "operations_manager",
  support_agent: "support_agent",
  driver_operations_coordinator: "driver_operations_coordinator",
  regional_operations_manager: "regional_operations_manager",
  content_editor: "content_editor",
  content_manager: "content_editor",
  marketing_manager: "content_editor",
  risk_compliance_officer: "verification_officer",
  people_operations_admin: "people_operations_admin",
  people_admin: "people_operations_admin"
};

export const STAFF_EMPLOYMENT_TYPES = [
  "Permanent",
  "Fixed-term",
  "Contractor",
  "Intern",
  "Part-time",
  "Casual"
];

export const STAFF_DEPARTMENTS = [
  "Business Operations",
  "Customer Operations",
  "Trust & Verification",
  "Driver Operations",
  "Finance",
  "People Operations",
  "Technology & Platform",
  "Growth & Content",
  "Executive"
];

export const LEAVE_TYPES = [
  "Annual leave",
  "Sick leave",
  "Compassionate leave",
  "Maternity leave",
  "Paternity leave",
  "Study leave",
  "Unpaid leave"
];

export function rolePackFor(profile = {}, staffProfile = null) {
  const explicit = staffProfile?.rolePackId || staffProfile?.role;
  if (explicit && STAFF_ROLE_PACKS[explicit]) return STAFF_ROLE_PACKS[explicit];
  const roles = profile?.roles || [];
  const mapped = roles.map((role) => STAFF_ROLE_ALIASES[role]).find(Boolean);
  return STAFF_ROLE_PACKS[mapped] || null;
}

export function hasStaffAccess(profile = {}, staffProfile = null) {
  if (staffProfile?.status === "active" || staffProfile?.status === "probation" || staffProfile?.status === "preboarding") return true;
  return Boolean(rolePackFor(profile, staffProfile));
}

export function isPeopleManager(profile = {}, staffProfile = null) {
  const pack = rolePackFor(profile, staffProfile);
  const permissions = new Set([...(profile?.customPermissions || []), ...(staffProfile?.permissions || []), ...(pack?.permissions || [])]);
  return Boolean(pack?.managerView || permissions.has("*") || permissions.has("people.*") || permissions.has("people.approve"));
}

export function isPeopleAdministrator(profile = {}, staffProfile = null) {
  const pack = rolePackFor(profile, staffProfile);
  const roles = new Set(profile?.roles || []);
  const permissions = new Set([...(profile?.customPermissions || []), ...(staffProfile?.permissions || []), ...(pack?.permissions || [])]);
  return Boolean(
    roles.has("super_admin") || roles.has("admin") || roles.has("platform_admin") ||
    roles.has("people_operations_admin") || roles.has("people_admin") ||
    pack?.id === "platform_admin" || pack?.id === "people_operations_admin" ||
    permissions.has("*") || permissions.has("people.*") || permissions.has("people.write")
  );
}

export function staffDisplayName(record = {}, fallback = "Spotly staff member") {
  return record.displayName || record.fullName || record.name || record.email || fallback;
}

// Keep live Firestore subscriptions restricted to the data actually used by the
// current admin area. This is UI-fetch policy, not an authorization boundary;
// Firestore rules and server permissions remain authoritative.
export const ADMIN_DATA_SOURCES = Object.freeze([
  "businesses", "claims", "users", "support", "waitlist", "partnerships",
  "audit", "help", "announcements", "roles", "tasks", "payouts"
]);

const sourcePlans = {
  all: ADMIN_DATA_SOURCES,
  home: ["businesses", "claims", "users", "support", "tasks", "payouts"],
  work: [], // Work Inbox and Support Console fetch their own operational data.
  marketplace: ["businesses", "claims", "users", "tasks"],
  mobility: [], // Driver Operations has its own authenticated operational endpoint.
  money: ["businesses", "payouts"],
  growth: ["businesses", "waitlist", "partnerships", "help", "announcements"],
  team: ["users", "roles"],
  system: ["businesses", "users", "tasks", "audit"],
  // Legacy admin routes still render directly and need their own data plans.
  dashboard: ["businesses", "claims", "users", "support", "waitlist", "audit", "tasks", "payouts"],
  operations: ["businesses", "claims", "support", "tasks"],
  notifications: [],
  organizations: ["businesses", "claims", "tasks"],
  businesses: ["businesses"],
  people: [],
  drivers: [],
  customers: ["users"],
  finance: ["businesses", "payouts"],
  content: ["businesses", "waitlist", "partnerships", "help", "announcements"],
  "platform-map": ["businesses", "users", "tasks"],
  platform: [],
  audit: ["audit"],
  settings: ["roles"]
};
Object.values(sourcePlans).forEach(Object.freeze);

export function adminDataSourcesFor(section = "all") {
  // Unrecognized areas use the legacy full plan, never silently hide data.
  return Object.hasOwn(sourcePlans, section) ? sourcePlans[section] : ADMIN_DATA_SOURCES;
}

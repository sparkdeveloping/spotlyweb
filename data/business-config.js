import { getBusinessLifecycle } from "@/lib/business-lifecycle";

export const businessCategories = [
  "Groceries",
  "Restaurants",
  "Retail",
  "Beauty",
  "Wellness",
  "Health",
  "Pharmacy",
  "Professional Services",
  "Events",
  "Activities",
  "Accommodation",
  "Education",
  "Fashion",
  "Home & Living",
  "Hardware",
  "Agriculture",
  "Other"
];

export const zimbabweCities = [
  "Harare",
  "Bulawayo",
  "Mutare",
  "Gweru",
  "Masvingo",
  "Kwekwe",
  "Chitungwiza",
  "Victoria Falls",
  "Kadoma",
  "Chinhoyi",
  "Marondera",
  "Zvishavane",
  "Gwanda",
  "Bindura",
  "Other"
];

export const paymentMethods = [
  { id: "cash", label: "Cash at pickup", description: "Customer pays at collection." },
  { id: "paynow", label: "Paynow checkout", description: "Hosted Paynow payment page." },
  { id: "ecocash", label: "EcoCash", description: "Mobile money through Paynow." },
  { id: "onemoney", label: "OneMoney", description: "Mobile money through Paynow." },
  { id: "card", label: "Card", description: "Visa, Mastercard, or supported local card through Paynow." },
  { id: "bank_transfer", label: "Bank transfer", description: "Business confirms the transfer before preparation." }
];

export const businessRoleTemplates = [
  {
    id: "organization_owner",
    name: "Organization owner",
    description: "Full access to every assigned brand and branch.",
    permissions: ["organization.*", "businesses.*", "branches.*", "catalog.*", "orders.*", "staff.*", "finance.*"]
  },
  {
    id: "business_manager",
    name: "Business manager",
    description: "Runs the business profile, customer activity, locations, offerings, and team.",
    permissions: ["business.update", "branches.*", "catalog.*", "orders.*", "staff.read", "reports.read"]
  },
  {
    id: "branch_manager",
    name: "Branch manager",
    description: "Runs assigned locations and the day-to-day customer operation there.",
    permissions: ["branches.update", "catalog.read", "inventory.*", "orders.*", "staff.read"]
  },
  {
    id: "catalog_manager",
    name: "Catalog manager",
    description: "Maintains customer-facing offerings, prices, availability, and supporting details.",
    permissions: ["catalog.*", "inventory.*", "branches.read"]
  },
  {
    id: "order_staff",
    name: "Operations team",
    description: "Handles customer activity assigned to their location, from acceptance through completion.",
    permissions: ["orders.read", "orders.update", "orders.pick", "inventory.read"]
  },
  {
    id: "finance_viewer",
    name: "Finance viewer",
    description: "Views payments, settlements, and reports without changing settings.",
    permissions: ["finance.read", "reports.read"]
  },
  {
    id: "custom",
    name: "Custom access",
    description: "Choose branch access and permissions manually.",
    permissions: []
  }
];

export const businessPermissions = [
  { id: "business.update", label: "Edit business profile" },
  { id: "branches.read", label: "View branches" },
  { id: "branches.update", label: "Edit branches" },
  { id: "catalog.read", label: "View catalog" },
  { id: "catalog.update", label: "Edit catalog" },
  { id: "inventory.update", label: "Update stock" },
  { id: "orders.read", label: "View orders" },
  { id: "orders.update", label: "Manage orders" },
  { id: "staff.read", label: "View team" },
  { id: "staff.manage", label: "Invite and manage team" },
  { id: "finance.read", label: "View finance" },
  { id: "finance.configure", label: "Edit finance settings" },
  { id: "reports.read", label: "View reports" },
  { id: "support.manage", label: "Manage support conversations" }
];

export const defaultOperationalSettings = {
  orderNotifications: true,
  lowStockNotifications: true,
  supportNotifications: true,
  dailySummary: true,
  defaultCurrency: "USD",
  inventoryMode: "business_choice",
  substitutionsEnabled: true,
  cancellationPolicy: "before_preparation",
  autoAcceptOrders: false,
  minimumOrder: 0,
  preparationMinutes: 45,
  pickupInstructions: "Bring your order number and collect from the pickup desk.",
  contactlessPickup: false
};

export const emptyProduct = {
  name: "",
  description: "",
  category: "Groceries",
  price: "",
  currency: "USD",
  compareAtPrice: "",
  stockStatus: "in_stock",
  stockQuantity: 0,
  stockMode: "status",
  active: true,
  pickupEligible: true,
  substitutionAllowed: true,
  sku: "",
  barcode: "",
  image: ""
};

export const defaultBranch = {
  name: "",
  city: "Harare",
  address: "",
  phone: "",
  email: "",
  location: null,
  public: true,
  status: "active",
  fulfilment: ["pickup"],
  acceptedCurrencies: ["USD", "ZWG"],
  paymentMethods: ["cash", "paynow", "ecocash", "onemoney", "card", "bank_transfer"],
  pickup: { enabled: true, slotMinutes: 30, slotCapacity: 12, preparationMinutes: 45 },
  openingHours: {
    monday: { open: "08:00", close: "17:00", closed: false },
    tuesday: { open: "08:00", close: "17:00", closed: false },
    wednesday: { open: "08:00", close: "17:00", closed: false },
    thursday: { open: "08:00", close: "17:00", closed: false },
    friday: { open: "08:00", close: "17:00", closed: false },
    saturday: { open: "08:00", close: "14:00", closed: false },
    sunday: { open: "", close: "", closed: true }
  }
};

export function getBusinessReadiness(input = {}) {
  const lifecycle = input.lifecycle || getBusinessLifecycle(input);
  const checks = [lifecycle.access, ...lifecycle.launchChecks].map((item) => ({
    ...item,
    done: item.state === "complete" || item.state === "not_required",
    optional: !item.required,
    primary: lifecycle.nextAction?.id === item.id
  }));
  const required = checks.filter((item) => item.required);
  const requiredComplete = required.filter((item) => item.done).length;
  return {
    checks,
    complete: checks.filter((item) => item.done).length,
    total: checks.length,
    requiredComplete,
    requiredTotal: required.length,
    percent: lifecycle.merchantProgress,
    ready: lifecycle.canSubmitLaunchReview,
    lifecycle,
    nextAction: lifecycle.nextAction,
    externalReviews: lifecycle.externalReviews
  };
}

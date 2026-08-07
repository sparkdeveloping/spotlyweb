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

export function getBusinessReadiness({ business, branches = [], products = [], finance, operations, invitations = [], archetype }) {
  const capabilities = business?.capabilities || archetype?.capabilities || [];
  const setupComplete = business?.onboardingStatus === "complete" || Boolean(business?.setupCompletedAt || business?.onboarding?.completedAt);
  const needsOfferings = capabilities.some((item) => ["catalog", "menu", "tickets", "appointments", "bookings"].includes(item));
  const needsPayments = capabilities.some((item) => ["pickup_orders", "orders", "tickets", "appointments", "bookings", "reservations"].includes(item));
  const needsPickup = capabilities.includes("pickup_orders");
  const offeringNoun = archetype?.nouns?.item || (business?.businessType === "ticketing_events" ? "ticket" : business?.businessType === "appointments_services" ? "service" : "item");
  const locationNoun = archetype?.nouns?.branch || "location";

  const checks = [
    {
      id: "setup",
      label: "Business setup confirmed",
      description: "Confirm the business type, operating model, first location, and customer actions.",
      done: setupComplete,
      href: "/business/setup",
      primary: !setupComplete
    },
    {
      id: "ownership",
      label: "Ownership or authority recorded",
      description: "Spotly has an approved owner, authorized representative, or an active verification review.",
      done: ["approved", "pending"].includes(business?.verificationStatus) || ["claimed", "claimed_pending_verification", "claim_pending"].includes(business?.claimStatus),
      href: "/business/settings"
    },
    {
      id: "profile",
      label: "Customer-facing profile complete",
      description: "Name, category, description, and a central contact method are ready. Location details are checked separately.",
      done: Boolean(business?.name && business?.category && business?.description && (business?.phone || business?.email)),
      href: "/business/settings"
    },
    {
      id: "location",
      label: `${locationNoun[0].toUpperCase()}${locationNoun.slice(1)} ready`,
      description: `At least one visible ${locationNoun} has a confirmed address or service area, contact method, and opening hours.`,
      done: branches.some((branch) => branch.status === "active" && branch.public !== false && (branch.address || branch.city) && (branch.phone || branch.email)),
      href: branches.length > 1 || business?.operatingModel === "physical_multi" ? "/business/branches" : "/business/setup"
    },
    ...(needsOfferings ? [{
      id: "catalog",
      label: `First ${offeringNoun} ready`,
      description: `Add at least one active ${offeringNoun} with the information a customer needs to act.`,
      done: products.some((product) => product.active !== false && (Number(product.price || product.prices?.USD || 0) > 0 || product.requiresBusinessReview || product.itemType === "listing")),
      href: "/business/catalog"
    }] : []),
    ...(needsPickup ? [{
      id: "operations",
      label: "Pickup workflow confirmed",
      description: "Preparation time, pickup instructions, substitutions, and notifications match the way the team works.",
      done: Boolean(operations?.preparationMinutes && operations?.pickupInstructions),
      href: "/business/settings"
    }] : []),
    ...(needsPayments ? [{
      id: "finance",
      label: "Payment approach selected",
      description: "Choose accepted methods and currencies. Payout details can be completed before taking live online payments.",
      done: Boolean(finance?.acceptedCurrencies?.length && finance?.paymentMethods?.length && finance?.paymentRecipient),
      href: "/business/finance"
    }] : []),
    {
      id: "team",
      label: "Team access reviewed",
      description: "Confirm who should have access. Inviting another teammate is optional for owner-operated businesses.",
      done: Boolean(business?.teamReviewedAt || invitations.some((item) => ["pending", "accepted"].includes(item.status))),
      href: "/business/staff",
      optional: true
    }
  ];

  const required = checks.filter((item) => !item.optional);
  const complete = checks.filter((item) => item.done).length;
  const requiredComplete = required.filter((item) => item.done).length;
  return {
    checks,
    complete,
    total: checks.length,
    requiredComplete,
    requiredTotal: required.length,
    percent: required.length ? Math.round((requiredComplete / required.length) * 100) : 100,
    ready: requiredComplete === required.length
  };
}

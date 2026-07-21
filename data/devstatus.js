export const statusSnapshot = {
  label: "Integrated MVP build",
  stage: 3,
  stageCount: 6,
  updated: "July 2026",
  experienceProgress: 88,
  productionReadiness: 42,
  clientInputsOpen: 48,
  launchBlockers: 7,
  summary:
    "The complete four-portal Spotly experience is designed and implemented as a responsive web platform. The current build is strong enough for stakeholder review and pilot preparation, but production launch still depends on backend services, commercial decisions, compliance, live integrations, and end-to-end testing."
};

export const productAreas = [
  {
    id: "customer",
    name: "Spotly Customer",
    route: "/",
    logo: "/brand/spotly.png",
    accent: "#6657D9",
    status: "Experience ready",
    progress: 92,
    complete: [
      "Discovery, search, saved places, bookings, orders, events, and account views",
      "Responsive desktop and mobile interaction design",
      "Unified navigation, motion, dark mode, empty states, and demo data"
    ],
    next: [
      "Live catalog, availability, checkout, payment, messaging, and account APIs",
      "Maps, location permissions, push notifications, and production analytics"
    ]
  },
  {
    id: "business",
    name: "Spotly Business",
    route: "/business",
    logo: "/brand/spotly-business.png",
    accent: "#147A4A",
    status: "Experience ready",
    progress: 89,
    complete: [
      "Dashboard, activity, catalog, promotions, staff, finance, insights, and settings",
      "Order and booking management workflows",
      "Operational metrics, charts, status states, and business controls"
    ],
    next: [
      "Business onboarding, verification, bank details, commission, tax, and payout APIs",
      "Live inventory, booking rules, opening hours, staff permissions, and exports"
    ]
  },
  {
    id: "driver",
    name: "Spotly Driver",
    route: "/driver",
    logo: "/brand/spotly-driver.png",
    accent: "#2563EB",
    status: "Experience ready",
    progress: 86,
    complete: [
      "Jobs, active delivery, earnings, history, profile, safety, and support views",
      "Offer acceptance, route status, proof-of-delivery, and payout concepts",
      "Mobile-first responsive workflow"
    ],
    next: [
      "Driver KYC, vehicle records, background checks, location tracking, and dispatch APIs",
      "Live navigation, customer communication, earnings rules, and payout integration"
    ]
  },
  {
    id: "admin",
    name: "Spotly Admin",
    route: "/admin",
    logo: "/brand/spotly-admin.png",
    accent: "#28466F",
    status: "Experience ready",
    progress: 88,
    complete: [
      "Operations, businesses, drivers, customers, finance, content, audit, and settings",
      "Risk, incident, verification, payout hold, and access-control workflows",
      "Platform-level metrics and operational oversight"
    ],
    next: [
      "Real role-based access, immutable audit logging, moderation, fraud, and incident APIs",
      "Production reporting, finance reconciliation, permissions, and support tooling"
    ]
  }
];

export const workstreams = [
  {
    group: "Product & experience",
    items: [
      { name: "Brand system and four app identities", status: "Complete", progress: 100, owner: "Spotly + Product" },
      { name: "Unified web information architecture", status: "Complete", progress: 100, owner: "Product" },
      { name: "Customer portal experience", status: "Review ready", progress: 92, owner: "Product" },
      { name: "Business portal experience", status: "Review ready", progress: 89, owner: "Product" },
      { name: "Driver portal experience", status: "Review ready", progress: 86, owner: "Product" },
      { name: "Admin portal experience", status: "Review ready", progress: 88, owner: "Product" },
      { name: "Accessibility and responsive QA", status: "In progress", progress: 68, owner: "Engineering" }
    ]
  },
  {
    group: "Platform engineering",
    items: [
      { name: "Next.js application shell and shared component system", status: "Complete", progress: 100, owner: "Engineering" },
      { name: "Authentication and account recovery", status: "Integration required", progress: 30, owner: "Engineering + Client" },
      { name: "Role and permission enforcement", status: "Integration required", progress: 25, owner: "Engineering + Client" },
      { name: "Production database and API model", status: "Architecture required", progress: 20, owner: "Engineering" },
      { name: "File storage and media processing", status: "Planned", progress: 10, owner: "Engineering" },
      { name: "Search, geolocation, and maps", status: "Partner decision", progress: 15, owner: "Client + Engineering" },
      { name: "Email, SMS, WhatsApp, and push notifications", status: "Partner decision", progress: 10, owner: "Client + Engineering" }
    ]
  },
  {
    group: "Commerce & operations",
    items: [
      { name: "Checkout and customer payment collection", status: "Provider required", progress: 15, owner: "Client + Finance" },
      { name: "Business settlement and payout flow", status: "Commercial rules required", progress: 10, owner: "Client + Finance" },
      { name: "Driver earnings and payout flow", status: "Commercial rules required", progress: 10, owner: "Client + Finance" },
      { name: "Refunds, cancellations, disputes, and chargebacks", status: "Policy required", progress: 10, owner: "Client + Operations" },
      { name: "Business onboarding and verification", status: "Requirements needed", progress: 20, owner: "Client + Operations" },
      { name: "Driver onboarding and verification", status: "Requirements needed", progress: 20, owner: "Client + Operations" },
      { name: "Customer support and incident escalation", status: "Operating model required", progress: 15, owner: "Client + Operations" }
    ]
  },
  {
    group: "Launch readiness",
    items: [
      { name: "Automated testing and regression suite", status: "Planned", progress: 20, owner: "Engineering" },
      { name: "Security review and threat assessment", status: "Planned", progress: 15, owner: "Engineering + Security" },
      { name: "Privacy, terms, marketplace, and driver agreements", status: "Client counsel required", progress: 5, owner: "Client + Legal" },
      { name: "Production hosting, domain, monitoring, and backups", status: "Decision required", progress: 25, owner: "Client + Engineering" },
      { name: "Analytics, conversion tracking, and reporting definitions", status: "Requirements needed", progress: 20, owner: "Client + Product" },
      { name: "Pilot businesses, drivers, and test customers", status: "Recruitment required", progress: 10, owner: "Client + Partnerships" }
    ]
  }
];

export const clientRequirementGroups = [
  {
    id: "commercial",
    title: "Commercial and finance model",
    owner: "Founder / Finance",
    priority: "Launch blocker",
    description: "These decisions define how money moves through Spotly and must be approved before payment and payout engineering begins.",
    requirements: [
      "Primary operating currency or supported currencies",
      "Customer service fees, delivery fees, booking fees, and minimum order rules",
      "Business commission structure by category and contract tier",
      "Driver pay formula, incentives, waiting time, distance, and cancellation compensation",
      "Business and driver payout schedules, minimum payout, reserves, and hold rules",
      "Tax, VAT, invoicing, withholding, refund, dispute, and chargeback treatment",
      "Approved payment partners for cards, bank transfer, mobile money, and payouts",
      "Who carries transaction, fraud, refund, and chargeback liability"
    ]
  },
  {
    id: "supply",
    title: "Businesses, inventory, and partnerships",
    owner: "Partnerships / Operations",
    priority: "Pilot blocker",
    description: "A marketplace requires real supply. The pilot cohort should be confirmed before backend onboarding is finalized.",
    requirements: [
      "Initial launch city, service area, and neighborhood boundaries",
      "Priority verticals: restaurants, grocery, events, beauty, health, activities, or others",
      "Named pilot list of approximately 20–50 businesses with decision-maker contacts",
      "Merchant onboarding process, required documents, verification standard, and approval owner",
      "Catalog ownership: business-managed, Spotly-managed, or hybrid",
      "Availability, booking capacity, order preparation, cancellation, and no-show rules",
      "Strategic partnerships for venues, events, delivery fleets, healthcare, tourism, or local commerce",
      "Service-level expectations and commercial agreements for pilot partners"
    ]
  },
  {
    id: "driver-ops",
    title: "Driver and delivery operations",
    owner: "Operations / Risk",
    priority: "Pilot blocker",
    description: "The driver product cannot become operational until qualification, dispatch, safety, and earnings policies are approved.",
    requirements: [
      "Driver relationship model: employee, contractor, fleet partner, or combination",
      "Required identity, license, vehicle, insurance, inspection, and background documents",
      "Vehicle types and delivery eligibility rules",
      "Dispatch model, job acceptance window, batching, reassignment, and cancellation rules",
      "Real-time location policy, location retention, privacy, and customer visibility",
      "Safety escalation, accidents, lost items, harassment, fraud, and emergency process",
      "Proof-of-delivery requirements and cash-handling policy, if any",
      "Driver support hours, contact channels, suspension, appeal, and reactivation process"
    ]
  },
  {
    id: "legal",
    title: "Legal, privacy, and compliance",
    owner: "Founder / Legal",
    priority: "Launch blocker",
    description: "Spotly needs approved legal terms and compliance boundaries before real users, payments, location data, or identity documents are processed.",
    requirements: [
      "Legal entity name, registration details, addresses, and authorized signatory",
      "Customer terms, privacy notice, cookie notice, and acceptable-use rules",
      "Business marketplace agreement and commercial schedule",
      "Driver agreement, safety terms, and independent-contractor or employment position",
      "Data retention, deletion, export, consent, and account-closure requirements",
      "Applicable KYC, AML, consumer, marketplace, employment, tax, and payments obligations",
      "Age limits and special requirements for healthcare, alcohol, tickets, or regulated categories",
      "Insurance coverage and allocation of liability across Spotly, businesses, drivers, and partners"
    ]
  },
  {
    id: "technology",
    title: "Technology and third-party providers",
    owner: "Founder / Engineering",
    priority: "Integration blocker",
    description: "Provider choices affect architecture, cost, delivery dates, data residency, and operational risk.",
    requirements: [
      "Final production domain, DNS owner, and official email addresses",
      "Cloud hosting, database region, file storage, backup, and recovery preference",
      "Authentication provider and required login methods",
      "Maps, geocoding, routing, and address-validation provider",
      "Email, SMS, WhatsApp, and push-notification providers",
      "Payment gateway, mobile-money, bank-transfer, and payout providers",
      "Identity verification, business verification, background check, and fraud partners",
      "Monitoring, analytics, customer support, CRM, and incident-management tools"
    ]
  },
  {
    id: "brand-content",
    title: "Brand, content, and communications",
    owner: "Marketing / Product",
    priority: "Required before pilot",
    description: "Production content must replace demonstration names, imagery, prices, locations, and policies.",
    requirements: [
      "Final company description, value proposition, launch messaging, and approved terminology",
      "Official logo source files, color values, brand guidelines, and usage approvals",
      "Support, legal, privacy, press, partnership, and billing contact details",
      "Approved city, category, venue, business, event, service, and driver content",
      "Photography rights, image licensing, moderation standards, and prohibited content rules",
      "Transactional email, SMS, notification, onboarding, and support copy",
      "App store and social accounts, handles, screenshots, descriptions, and release ownership",
      "Language, localization, accessibility, and tone-of-voice requirements"
    ]
  }
];

export const decisions = [
  { id: "d1", decision: "Confirm launch city and pilot service boundary", owner: "Founder + Operations", due: "Before pilot recruitment", severity: "Critical" },
  { id: "d2", decision: "Approve commission, fee, driver pay, refund, and payout model", owner: "Founder + Finance", due: "Before commerce integration", severity: "Critical" },
  { id: "d3", decision: "Select payment and payout providers", owner: "Founder + Finance", due: "Before commerce integration", severity: "Critical" },
  { id: "d4", decision: "Provide initial business and partnership pipeline", owner: "Partnerships", due: "Before merchant onboarding build", severity: "High" },
  { id: "d5", decision: "Approve driver qualification and operating model", owner: "Operations + Legal", due: "Before driver onboarding build", severity: "High" },
  { id: "d6", decision: "Select maps, messaging, identity, and hosting providers", owner: "Founder + Engineering", due: "Before integration sprint", severity: "High" },
  { id: "d7", decision: "Provide legal entity details and appoint counsel/reviewer", owner: "Founder + Legal", due: "Before external pilot", severity: "Critical" },
  { id: "d8", decision: "Name client owners for product, operations, finance, legal, and partnerships", owner: "Founder", due: "Immediately", severity: "High" }
];

export const launchStages = [
  {
    number: 1,
    title: "Discovery and scope",
    status: "Complete",
    description: "Four product audiences, portal boundaries, primary workflows, and the unified web direction established."
  },
  {
    number: 2,
    title: "Brand and product experience",
    status: "Complete",
    description: "Final icon family, color systems, responsive experience direction, and shared design language established."
  },
  {
    number: 3,
    title: "Integrated MVP build",
    status: "Current stage",
    description: "All four responsive portals are implemented with realistic flows and demo data. Client decisions and technical integrations are now the main path forward."
  },
  {
    number: 4,
    title: "Backend and partner integrations",
    status: "Next",
    description: "Authentication, data, maps, payments, payouts, notifications, verification, storage, and operational APIs."
  },
  {
    number: 5,
    title: "Controlled pilot and hardening",
    status: "Planned",
    description: "Real pilot businesses, drivers, and customers; security, performance, accessibility, support, and operational testing."
  },
  {
    number: 6,
    title: "Production launch",
    status: "Planned",
    description: "Approved legal documents, production infrastructure, live support, monitoring, launch communications, and measured rollout."
  }
];

export const launchGates = [
  { name: "Product experience approved by client", status: "In review" },
  { name: "Commercial and finance model approved", status: "Blocked by client input" },
  { name: "Pilot business cohort contracted", status: "Not started" },
  { name: "Pilot driver cohort verified", status: "Not started" },
  { name: "Production backend and access control complete", status: "Not started" },
  { name: "Payments, payouts, maps, messaging, and verification live", status: "Not started" },
  { name: "Legal documents and insurance approved", status: "Not started" },
  { name: "Security, privacy, performance, and accessibility sign-off", status: "Not started" },
  { name: "Support, incident, dispute, and fraud operations ready", status: "Not started" },
  { name: "Monitoring, backups, analytics, and rollback verified", status: "Not started" }
];

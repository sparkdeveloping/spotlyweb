export const statusSnapshot = {
  label: "Firebase integration and pilot preparation",
  stage: 4,
  stageCount: 6,
  updated: "August 2026",
  experienceProgress: 94,
  productionReadiness: 68,
  clientInputsOpen: 18,
  launchBlockers: 6,
  summary:
    "Spotly now has a JavaScript-only Next.js platform connected to Firebase architecture for shared accounts, business claiming, branch operations, grocery pickup, administration, support, notifications, and Paynow-ready payments. External credentials, production rules, approved legal terms, real merchant verification, and controlled pilot testing remain before public transactions should begin."
};

export const productAreas = [
  {
    id: "customer",
    name: "Spotly Customer",
    route: "/",
    logo: "/brand/spotly.png",
    accent: "#6657D9",
    status: "Private beta ready",
    progress: 94,
    complete: [
      "Light-mode coming-soon website, launch waitlist, partnerships, business directory, and claim entry points",
      "Admin-controlled private marketplace with Firebase businesses, favorites, product catalogues, pickup cart, checkout, and order history",
      "Shared Firebase identity, linked sign-in providers, notifications, payment recovery, and contextual empty states"
    ],
    next: [
      "Enable and verify production Firebase authentication providers, VAPID/App Check, Paynow, and transactional email credentials",
      "Run real merchant, catalogue, pricing, inventory, pickup-slot, payment, and accessibility pilot tests"
    ]
  },
  {
    id: "business",
    name: "Spotly Business",
    route: "/business",
    logo: "/brand/spotly-business.png",
    accent: "#147A4A",
    status: "Integrated beta",
    progress: 93,
    complete: [
      "Search-first business claiming, evidence upload, verification status, readiness guidance, and multi-brand/branch data model",
      "Realtime profiles, branches, products, inventory availability, pickup orders, staff invitations, finance preferences, and support",
      "Autosave-oriented forms, success/error feedback, useful empty states, and admin-managed platform defaults"
    ],
    next: [
      "Verify imported records and media rights with each merchant, then load approved catalogues and operational data",
      "Pilot branch-level permissions, payout details, reconciliation, refunds, exports, and service-level procedures"
    ]
  },
  {
    id: "driver",
    name: "Spotly Driver",
    route: "/driver",
    logo: "/brand/spotly-driver.png",
    accent: "#2563EB",
    status: "Dormant by decision",
    progress: 55,
    complete: [
      "Existing responsive driver interface preserved for future delivery expansion",
      "Portal navigation and shared identity architecture remain available",
      "Admin clearly communicates that grocery pickup is the current launch focus"
    ],
    next: [
      "No launch-critical implementation is scheduled while pickup remains the confirmed transaction model",
      "Future delivery phase will require KYC, dispatch, location, safety, earnings, and payout policy"
    ]
  },
  {
    id: "admin",
    name: "Spotly Admin",
    route: "/admin",
    logo: "/brand/spotly-admin.png",
    accent: "#28466F",
    status: "Integrated beta",
    progress: 95,
    complete: [
      "Realtime claims, verification, business records, support queue, user access, roles, content, finance, platform settings, and audit history",
      "Server-protected first-admin bootstrap, secure data seeding, feature flags, private-beta controls, and support-view policy configuration",
      "Editable support, integrations, commerce, verification, legal, language, announcement, and help-centre controls"
    ],
    next: [
      "Complete role-by-role production rules tests, support-view session UI, reconciliation tooling, and operational reports",
      "Configure legal identity, official support contacts, external credentials, merchant approval owners, and launch policies"
    ]
  }
];

export const workstreams = [
  {
    group: "Product and experience",
    items: [
      { name: "Four-brand visual system and responsive shared UI", status: "Complete", progress: 100, owner: "Product" },
      { name: "Light public website and admin-controlled private beta", status: "Complete", progress: 100, owner: "Product + Engineering" },
      { name: "Customer grocery-pickup marketplace", status: "Review ready", progress: 92, owner: "Product + Engineering" },
      { name: "Business onboarding and operating portal", status: "Review ready", progress: 93, owner: "Product + Engineering" },
      { name: "Administrator control plane", status: "Review ready", progress: 95, owner: "Engineering + Operations" },
      { name: "English, ChiShona, and isiNdebele content coverage", status: "In progress", progress: 55, owner: "Content + Community" },
      { name: "Formal accessibility and device QA", status: "In progress", progress: 60, owner: "Engineering + QA" }
    ]
  },
  {
    group: "Firebase and platform engineering",
    items: [
      { name: "Firebase Web and Admin SDK architecture", status: "Complete", progress: 100, owner: "Engineering" },
      { name: "Shared email/password identity and provider linking", status: "Review ready", progress: 90, owner: "Engineering" },
      { name: "Firestore service layer, realtime listeners, and data model", status: "Review ready", progress: 92, owner: "Engineering" },
      { name: "Cloud Storage upload paths and production draft rules", status: "Review ready", progress: 85, owner: "Engineering" },
      { name: "Firestore composite indexes and emulator configuration", status: "Complete", progress: 100, owner: "Engineering" },
      { name: "Production rules tests and App Check enforcement", status: "Needs action", progress: 45, owner: "Engineering + Security" },
      { name: "Vercel environment and deployment verification", status: "Needs credentials", progress: 60, owner: "Founder + Engineering" }
    ]
  },
  {
    group: "Commerce and operations",
    items: [
      { name: "Server-validated pickup order creation", status: "Review ready", progress: 90, owner: "Engineering" },
      { name: "Paynow web, EcoCash, and OneMoney initiation and polling", status: "Needs credentials", progress: 75, owner: "Finance + Engineering" },
      { name: "USD and ZiG, cash, card, mobile money, and bank-transfer configuration", status: "Review ready", progress: 88, owner: "Finance + Operations" },
      { name: "Business recipient, commission, settlement, and payout controls", status: "In progress", progress: 70, owner: "Founder + Finance" },
      { name: "Refunds, disputes, reconciliation, and fiscal documents", status: "Policy required", progress: 35, owner: "Finance + Legal" },
      { name: "Real merchant onboarding and data verification", status: "Pilot partners required", progress: 35, owner: "Partnerships + Operations" },
      { name: "Realtime public and authenticated support chat", status: "Review ready", progress: 90, owner: "Support + Engineering" }
    ]
  },
  {
    group: "Launch readiness",
    items: [
      { name: "JavaScript syntax and project structure validation", status: "Complete", progress: 100, owner: "Engineering" },
      { name: "Dependency install, lint, and production build on Vercel", status: "Needs action", progress: 55, owner: "Engineering" },
      { name: "Authentication, rules, payment, and permissions regression suite", status: "In progress", progress: 40, owner: "Engineering + QA" },
      { name: "Privacy, terms, merchant agreement, refund policy, and data terms", status: "Client counsel required", progress: 10, owner: "Founder + Legal" },
      { name: "Monitoring, backups, analytics definitions, and incident response", status: "In progress", progress: 45, owner: "Engineering + Operations" },
      { name: "Controlled merchant and customer pilot", status: "Pilot partners required", progress: 15, owner: "Partnerships + Product" }
    ]
  }
];

export const clientRequirementGroups = [
  {
    id: "commercial",
    title: "Commercial and settlement decisions",
    owner: "Founder / Finance",
    priority: "Launch blocker",
    description: "The platform exposes adjustable defaults, but Spotly still needs approved real-world money-flow rules before live payments and payouts.",
    requirements: [
      "Choose whether Spotly or each merchant is the default payment recipient, with category or contract overrides",
      "Approve commission, service fees, payout cadence, minimum payout, reserves, holds, and reconciliation ownership",
      "Provide Paynow integration credentials for USD and ZiG and confirm settlement accounts",
      "Approve refund, partial refund, cancellation, dispute, chargeback, cash-at-pickup, and bank-transfer procedures",
      "Confirm tax, fiscal invoice, receipt, VAT, withholding, and accounting requirements with Zimbabwean advisers"
    ]
  },
  {
    id: "supply",
    title: "Verified merchant and catalogue supply",
    owner: "Partnerships / Operations",
    priority: "Pilot blocker",
    description: "Provisional real-world listings make claiming easier, but only approved businesses and accurate catalogues should transact.",
    requirements: [
      "Recruit an initial cross-city grocery pickup merchant cohort and identify organization owners and branch managers",
      "Confirm source rights and accuracy for imported names, locations, logos, photographs, contacts, and descriptions",
      "Collect branch hours, pickup instructions, payment methods, catalogue ownership, pricing, stock model, and preparation capacity",
      "Assign claim-verification officers and document the adaptive low-risk/manual approval thresholds",
      "Approve merchant service levels, substitutions, out-of-stock, cancellation, no-show, support, and escalation procedures"
    ]
  },
  {
    id: "driver-ops",
    title: "Future delivery scope",
    owner: "Operations / Risk",
    priority: "Deferred",
    description: "Driver functionality is intentionally not a launch dependency. These inputs are preserved for a later delivery phase.",
    requirements: [
      "Confirm when delivery should be activated after grocery pickup proves operationally stable",
      "Define driver relationship, KYC, vehicles, insurance, dispatch, safety, location, proof, cash handling, and earnings",
      "Approve a separate controlled driver pilot before enabling the dormant portal"
    ]
  },
  {
    id: "legal",
    title: "Legal identity, policies, and compliance",
    owner: "Founder / Legal",
    priority: "Launch blocker",
    description: "Admin fields are ready, but the actual legal entity and approved policy documents are not yet available.",
    requirements: [
      "Provide legal entity name, trading name, registration number, registered address, tax number, and authorized contacts",
      "Approve privacy, terms, merchant agreement, refund/cancellation, acceptable-use, cookie, and data-processing documents",
      "Define retention, deletion, consent, account closure, identity-document handling, and incident notification procedures",
      "Confirm consumer, payment, tax, data, marketplace, insurance, and regulated-category obligations in Zimbabwe"
    ]
  },
  {
    id: "technology",
    title: "External credentials and production services",
    owner: "Founder / Engineering",
    priority: "Integration blocker",
    description: "The code paths exist, but Vercel and provider consoles require production configuration and verification.",
    requirements: [
      "Configure the Vercel project, production domain, preview domain, DNS, and all server/public environment variables",
      "Provide Firebase Admin service-account values and enable Email/Password, Google, Apple, Phone, and Anonymous authentication",
      "Authorize Vercel domains, configure Apple OAuth details, SMS billing/quotas, Web Push VAPID, and App Check reCAPTCHA Enterprise",
      "Provide Paynow, Resend, and verified sending-domain credentials; choose monitoring and error-reporting services",
      "Deploy indexes and tested production Firestore/Storage rules only after emulator and pilot validation"
    ]
  },
  {
    id: "brand-content",
    title: "Support, language, and launch content",
    owner: "Marketing / Support",
    priority: "Required before pilot",
    description: "The admin can manage these details; official content and owners are still required.",
    requirements: [
      "Provide support email, phone, WhatsApp, hours, escalation contacts, response targets, and agent roster",
      "Provide unlisted YouTube orientation video IDs and approve role-specific help-centre structure",
      "Review English copy and supply professional ChiShona and isiNdebele translations for critical journeys",
      "Approve launch tagline, public FAQs, notification templates, transactional email copy, and business onboarding guidance"
    ]
  }
];

export const decisions = [
  { id: "d1", decision: "Provide the first super-admin email and Firebase Admin credentials in Vercel", owner: "Founder + Engineering", due: "Before first deployed admin login", severity: "Critical" },
  { id: "d2", decision: "Configure and test Firebase Auth providers, authorized domains, VAPID, and App Check", owner: "Engineering", due: "Before private beta", severity: "Critical" },
  { id: "d3", decision: "Provide Paynow credentials and approve the default recipient, commission, and payout model", owner: "Founder + Finance", due: "Before live payment testing", severity: "Critical" },
  { id: "d4", decision: "Recruit and verify the first grocery pickup businesses and branches", owner: "Partnerships + Operations", due: "Before controlled pilot", severity: "High" },
  { id: "d5", decision: "Provide legal entity details and approve customer and merchant policies", owner: "Founder + Legal", due: "Before public transactions", severity: "Critical" },
  { id: "d6", decision: "Provide official support channels, hours, escalation owner, and YouTube resources", owner: "Support + Marketing", due: "Before pilot onboarding", severity: "High" },
  { id: "d7", decision: "Run production build, emulator rules tests, payment sandbox tests, and browser/device QA", owner: "Engineering + QA", due: "Before pilot release", severity: "High" },
  { id: "d8", decision: "Approve imported business-data sources and provisional image-use policy", owner: "Founder + Legal + Partnerships", due: "Before public directory promotion", severity: "High" }
];

export const launchStages = [
  { number: 1, title: "Discovery and scope", status: "Complete", description: "Four audiences, portal boundaries, Zimbabwe-wide direction, grocery pickup focus, and admin-controlled behavior established." },
  { number: 2, title: "Brand and product experience", status: "Complete", description: "Four icon identities, light public experience, responsive design system, motion, and intentional interaction patterns established." },
  { number: 3, title: "Integrated application build", status: "Complete", description: "Customer, business, admin, dormant driver, support, claim, account, marketplace, and development-status experiences implemented." },
  { number: 4, title: "Firebase and provider integration", status: "Current stage", description: "Firebase clients and server routes, shared identity, Firestore models, Storage paths, notifications, seeding, Paynow-ready flows, and Vercel configuration are implemented; credentials and production verification remain." },
  { number: 5, title: "Controlled pilot and hardening", status: "Next", description: "Verified businesses and customers, real catalogues, sandbox payments, role/rules tests, accessibility, performance, security, support, reconciliation, and operating procedures." },
  { number: 6, title: "Production release", status: "Planned", description: "Approved legal documents, production credentials and rules, monitoring, backups, launch communications, measured rollout, and incident-ready operations." }
];

export const launchGates = [
  { name: "Product and portal experience approved", status: "In review" },
  { name: "Vercel deployment and production environment verified", status: "Configuration required" },
  { name: "Firebase Auth, Admin SDK, indexes, rules, App Check, and push tested", status: "Testing required" },
  { name: "Paynow sandbox and live settlement model approved", status: "Blocked by credentials and finance input" },
  { name: "Pilot merchants, branches, catalogues, and pickup procedures verified", status: "Recruitment required" },
  { name: "Legal entity and customer/merchant policies approved", status: "Blocked by client input" },
  { name: "Support contacts, agents, hours, escalation, and orientation resources ready", status: "Client input required" },
  { name: "Security, privacy, accessibility, performance, and recovery sign-off", status: "Testing required" },
  { name: "Monitoring, analytics, backups, reconciliation, and rollback verified", status: "Configuration required" },
  { name: "Controlled pilot completed without critical defects", status: "Not started" }
];

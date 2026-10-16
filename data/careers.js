export const CAREER_STAGES = ["new", "screening", "interview", "reference_check", "offer", "hired", "rejected", "withdrawn"];

export const CAREER_STAGE_LABELS = {
  new: "New",
  screening: "Screening",
  interview: "Interview",
  reference_check: "Reference check",
  offer: "Offer",
  hired: "Hired",
  rejected: "Not moving forward",
  withdrawn: "Withdrawn"
};

export const CAREER_OPENINGS = [
  {
    id: "customer-support-associate",
    title: "Customer Support Associate",
    department: "Customer Operations",
    location: "Harare, Zimbabwe",
    arrangement: "Hybrid",
    employmentType: "Full-time",
    rolePackId: "support_agent",
    status: "published",
    featured: true,
    summary: "Help customers and businesses get unstuck quickly, clearly, and respectfully across Spotly.",
    description: "You will be one of the people customers and merchants rely on when something needs attention. This role combines customer care, platform knowledge, careful written communication, and strong judgement about when to escalate an issue.",
    responsibilities: [
      "Respond to customer and business support conversations across Spotly.",
      "Investigate account, order, booking, payment, and marketplace issues using internal tools.",
      "Escalate safety, money, fraud, or platform incidents to the right operating team.",
      "Keep notes and handoffs clear enough that another teammate can continue the work immediately."
    ],
    requirements: [
      "Clear written and spoken English; Shona or Ndebele is useful.",
      "Comfort using web-based tools and learning new software quickly.",
      "Calm, practical judgement when a customer is frustrated or information is incomplete.",
      "Reliable availability for the agreed support schedule."
    ],
    niceToHave: ["Previous customer support, hospitality, retail, banking, telecoms, or marketplace experience."]
  },
  {
    id: "business-success-associate",
    title: "Business Success Associate",
    department: "Business Operations",
    location: "Harare, Zimbabwe",
    arrangement: "Hybrid + field visits",
    employmentType: "Full-time",
    rolePackId: "business_success_manager",
    status: "published",
    featured: true,
    summary: "Help Zimbabwean businesses get claimed, configured, launched, and successful on Spotly.",
    description: "You will guide merchants from their first Spotly conversation through verification, setup, catalogue readiness, launch, and ongoing operating questions. The job is part relationship management and part hands-on problem solving.",
    responsibilities: [
      "Guide businesses through claim, verification, setup, and launch readiness.",
      "Help merchants structure locations, products, services, menus, bookings, and fulfilment correctly.",
      "Spot blockers early and coordinate with verification, support, finance, and catalogue teams.",
      "Follow up with merchants after launch and turn recurring friction into product feedback."
    ],
    requirements: [
      "Strong communication and follow-through.",
      "Comfort explaining software to people with very different levels of technical confidence.",
      "Ability to move between desk work and in-person merchant visits when required.",
      "Good judgement with business information and customer data."
    ],
    niceToHave: ["Experience in merchant acquisition, account management, retail operations, hospitality, or SME support."]
  },
  {
    id: "business-verification-officer",
    title: "Business Verification Officer",
    department: "Trust & Verification",
    location: "Harare, Zimbabwe",
    arrangement: "Hybrid",
    employmentType: "Full-time",
    rolePackId: "verification_officer",
    status: "published",
    featured: false,
    summary: "Review business claims and evidence so Spotly can be open to growth without becoming careless about trust.",
    description: "You will review ownership claims, business relationships, verification evidence, and launch readiness. The work rewards consistency, documentation, and the ability to make careful decisions without creating unnecessary friction for legitimate businesses.",
    responsibilities: [
      "Review business claims, evidence, ownership relationships, and requested access.",
      "Document decisions and request specific changes when evidence is incomplete.",
      "Escalate unusual risk patterns or potential impersonation.",
      "Help improve verification guidance and internal review standards."
    ],
    requirements: [
      "Strong attention to detail and comfort following decision frameworks.",
      "Clear written reasoning and accurate record keeping.",
      "Respect for privacy and confidential business information.",
      "Ability to make consistent decisions under a queue-based workload."
    ],
    niceToHave: ["Experience in KYC, compliance, banking operations, insurance, trust and safety, or document review."]
  },
  {
    id: "driver-operations-coordinator",
    title: "Driver Operations Coordinator",
    department: "Driver Operations",
    location: "Harare, Zimbabwe",
    arrangement: "Operations / shift based",
    employmentType: "Full-time",
    rolePackId: "driver_operations_coordinator",
    status: "published",
    featured: true,
    summary: "Keep Ride, Send, and delivery operations moving when real-world conditions do not follow the happy path.",
    description: "You will support active driver operations, dispatch exceptions, incidents, availability, and driver questions. This is an operating role for someone who likes fast feedback loops and can stay organised while several things are happening at once.",
    responsibilities: [
      "Monitor active mobility and delivery work and respond to exceptions.",
      "Support drivers with job, handoff, route, payment, and account issues.",
      "Escalate safety incidents and document operational decisions.",
      "Track recurring dispatch problems and help improve operating playbooks."
    ],
    requirements: [
      "Calm judgement and good communication during time-sensitive work.",
      "Comfort using maps, dashboards, queues, and messaging tools.",
      "Reliable availability for the agreed operating schedule.",
      "Ability to document incidents and handoffs accurately."
    ],
    niceToHave: ["Experience in logistics, dispatch, delivery, transport, fleet operations, call centres, or field operations."]
  },
  {
    id: "catalogue-content-associate",
    title: "Catalogue & Content Associate",
    department: "Growth & Content",
    location: "Harare, Zimbabwe",
    arrangement: "Hybrid + field capture",
    employmentType: "Full-time",
    rolePackId: "content_editor",
    status: "published",
    featured: false,
    summary: "Make Spotly's marketplace accurate, useful, and visually clear one business, product, and service at a time.",
    description: "You will work on the information customers rely on when deciding what to buy, book, or visit. That includes structured catalogue data, imagery, categorisation, merchant content, and field capture when online information is not enough.",
    responsibilities: [
      "Create and review structured business, product, menu, service, and event content.",
      "Capture catalogue information in the field when required.",
      "Check names, categories, availability, media, and customer-facing details for accuracy.",
      "Help define repeatable content quality standards as the marketplace grows."
    ],
    requirements: [
      "Excellent attention to detail.",
      "Comfort working with structured forms, spreadsheets, images, and repetitive quality checks.",
      "Good written English and strong visual judgement.",
      "Willingness to do field capture when the role requires it."
    ],
    niceToHave: ["Retail, merchandising, photography, e-commerce, data entry, editorial, or catalogue experience."]
  }
];

export function careerOpeningById(id) {
  return CAREER_OPENINGS.find((item) => item.id === id) || null;
}

import { SETUP_STEPS, businessArchetype, inferBusinessType } from "@/data/business-archetypes";
import { businessHref } from "@/lib/business-routing";

export const BUSINESS_LIFECYCLE_STAGES = [
  { id: "access", number: 1, label: "Verify access", shortLabel: "Access" },
  { id: "basics", number: 2, label: "Set up the business", shortLabel: "Basics" },
  { id: "prepare", number: 3, label: "Prepare for launch", shortLabel: "Prepare" },
  { id: "review", number: 4, label: "Spotly launch review", shortLabel: "Review" },
  { id: "live", number: 5, label: "Live", shortLabel: "Live" }
];

export const BUSINESS_LIFECYCLE_STATES = new Set(["complete", "incomplete", "in_review", "action_required", "blocked", "not_required"]);

const OFFERING_CAPABILITIES = new Set(["catalog", "menu", "events", "services", "listings", "tickets", "appointments", "bookings"]);
const PAYMENT_CAPABILITIES = new Set(["pickup_orders", "orders", "tickets", "appointments", "bookings", "reservations"]);
const NON_CASH_METHODS = new Set(["paynow", "ecocash", "onemoney", "card", "bank_transfer"]);

function text(value) { return String(value || "").trim(); }
function list(value) { return Array.isArray(value) ? value : []; }
function number(value) { const result = Number(value); return Number.isFinite(result) ? result : 0; }
function status(value) { return String(value || "").trim().toLowerCase(); }
function capital(value) { const word = String(value || ""); return word ? word[0].toUpperCase() + word.slice(1) : word; }

function hasOpeningHours(branch = {}) {
  const hours = branch.openingHours || {};
  return Object.values(hours).some((day) => day && (day.closed === true || (text(day.open) && text(day.close))));
}

function priceFor(product = {}) {
  if (number(product.price) > 0) return number(product.price);
  const values = Object.values(product.prices || {}).map(number).filter((value) => value > 0);
  return values[0] || 0;
}

function productReady(product = {}) {
  if (product.active === false) return false;
  if (product.itemType === "listing" || product.requiresBusinessReview) return true;
  return priceFor(product) > 0;
}

function imageReviewNeeded(product = {}) {
  const rights = status(product.imageRightsStatus);
  return Boolean(product.image) && ["reference_only", "permission_pending", "unknown", "needs_review"].includes(rights);
}

export function activeSetupSteps(business = {}) {
  const archetype = businessArchetype(business);
  return SETUP_STEPS.filter((item) => archetype.setup.includes(item.id)).map((item) => ({ ...item, required: item.id !== "starter" }));
}

export function evaluateSetupSteps({ business = {}, branches = [], products = [], operations = {} } = {}) {
  const type = inferBusinessType(business);
  const capabilities = list(business.capabilities);
  const noPublicLocation = ["online_only", "mobile_service"].includes(business.operatingModel);
  const persisted = new Set(list(business.onboarding?.completedSteps));
  const completedAt = business.onboarding?.completedAt || business.setupCompletedAt;

  const validators = {
    identity: () => Boolean(text(business.brandName || business.name) && type && text(business.category || business.categories?.[0])),
    operation: () => Boolean(text(business.operatingModel)),
    location: () => branches.some((branch) => Boolean(
      text(branch.branchName || branch.name)
      && text(branch.city)
      && (noPublicLocation || text(branch.address) || text(branch.city))
    )),
    offering: () => capabilities.length > 0 || persisted.has("offering"),
    starter: () => persisted.has("starter"),
    review: () => Boolean(completedAt || persisted.has("review"))
  };

  const steps = activeSetupSteps({ ...business, businessType: type }).map((step) => {
    const complete = Boolean(validators[step.id]?.());
    return {
      ...step,
      complete,
      state: complete ? "complete" : "incomplete"
    };
  });
  const required = steps.filter((step) => step.required);
  const requiredComplete = required.filter((step) => step.complete).length;
  const percent = required.length ? Math.round((requiredComplete / required.length) * 100) : 100;
  const firstIncomplete = required.find((step) => !step.complete) || null;
  return {
    steps,
    requiredTotal: required.length,
    requiredComplete,
    percent,
    complete: requiredComplete === required.length,
    firstIncomplete,
    firstIncompleteId: firstIncomplete?.id || null,
    persistedCompletedSteps: [...persisted],
    diagnostic: { operationsConfigured: Boolean(operations && Object.keys(operations).length), productCount: products.length }
  };
}

export function resolveSetupStep({ requestedStep = "", business = {}, branches = [], products = [], operations = {} } = {}) {
  const evaluation = evaluateSetupSteps({ business, branches, products, operations });
  const activeIds = evaluation.steps.map((step) => step.id);
  const requestedIndex = activeIds.indexOf(requestedStep);
  const firstIncompleteIndex = evaluation.firstIncompleteId ? activeIds.indexOf(evaluation.firstIncompleteId) : -1;
  if (evaluation.complete) return { ...evaluation, stepId: null, redirectToLaunch: true };
  if (requestedIndex >= 0 && (firstIncompleteIndex < 0 || requestedIndex <= firstIncompleteIndex)) {
    return { ...evaluation, stepId: requestedStep, redirectToLaunch: false };
  }
  return { ...evaluation, stepId: evaluation.firstIncompleteId || activeIds[0] || "identity", redirectToLaunch: false };
}

export function getLaunchRequirements({ business = {}, archetype, operations = {}, platformSettings = {} } = {}) {
  const resolvedArchetype = archetype || businessArchetype(business);
  const capabilities = new Set(list(business.capabilities).length ? list(business.capabilities) : resolvedArchetype.capabilities);
  const paymentMethods = list(business.moneySetup?.paymentMethods || business.paymentMethods);
  const hasCustomerPaymentsConfigured = Boolean(business.moneySetup?.customerSettingsConfigured);
  const usesOnlineSettlement = paymentMethods.some((method) => NON_CASH_METHODS.has(method));
  const commerceEnabled = platformSettings.commerce?.enabled !== false;
  const launchEnabled = platformSettings.launch?.businessLaunchEnabled !== false;
  const launchReviewEnabled = platformSettings.launch?.businessLaunchReviewEnabled !== false;
  return {
    profile: "required",
    location: business.operatingModel === "online_only" ? "optional" : "required",
    catalog: [...capabilities].some((item) => OFFERING_CAPABILITIES.has(item)) ? "required" : "not_required",
    pickup: capabilities.has("pickup_orders") ? "required" : "not_required",
    customerPayments: commerceEnabled && [...capabilities].some((item) => PAYMENT_CAPABILITIES.has(item)) ? "required" : "not_required",
    settlement: commerceEnabled && [...capabilities].some((item) => PAYMENT_CAPABILITIES.has(item)) && hasCustomerPaymentsConfigured && usesOnlineSettlement ? "required" : "not_required",
    team: "optional",
    commerceEnabled,
    launchEnabled,
    launchReviewEnabled,
    operationsConfigured: Boolean(operations)
  };
}

function accessCheck({ business = {}, membership = null, claims = [], businessId = "" } = {}) {
  const claim = claims.find((item) => !businessId || item.businessId === businessId) || null;
  const claimStatus = status(claim?.status || business.claimStatus);
  const verification = status(business.verificationStatus);
  const accessApproved = Boolean(membership) || verification === "approved" || claimStatus === "approved" || ["claimed", "verified"].includes(claimStatus);
  const needsInfo = ["information_requested", "needs_information", "changes_requested", "claim_needs_information"].includes(claimStatus);
  const inReview = ["submitted", "under_review", "claim_pending", "claimed_pending_verification", "parent_approval_required", "pending"].includes(claimStatus) || verification === "pending";
  return {
    id: "access",
    group: "access",
    label: "Business access",
    state: accessApproved ? "complete" : needsInfo ? "action_required" : inReview ? "in_review" : "incomplete",
    owner: accessApproved ? "none" : needsInfo ? "merchant" : inReview ? "spotly" : "merchant",
    description: accessApproved ? "Business access approved." : needsInfo ? "Spotly needs more information before access can be approved." : inReview ? "Your business claim is waiting on Spotly." : "Verify that you are allowed to manage this business.",
    actionLabel: accessApproved ? "View access" : needsInfo ? "Review claim" : inReview ? "View claim status" : "Verify access",
    href: claim?.id ? `/claim/status/${claim.id}` : "/business/claims",
    required: true,
    blocksLaunch: !accessApproved,
    merchantDone: accessApproved || inReview
  };
}

function profileCheck({ business = {}, branches = [], businessId = "" } = {}) {
  const contact = text(business.phone || business.email || business.whatsapp) || branches.some((branch) => text(branch.phone || branch.email));
  const missing = [];
  if (!text(business.brandName || business.name)) missing.push("business name");
  if (!text(business.category || business.categories?.[0])) missing.push("category");
  if (!text(business.description)) missing.push("public description");
  if (!contact) missing.push("customer contact");
  const complete = missing.length === 0;
  return {
    id: "profile",
    group: "customer",
    label: "Customer-facing profile",
    state: complete ? "complete" : "action_required",
    owner: complete ? "none" : "merchant",
    description: complete ? "Your public business profile has the required customer information." : `Add ${missing.join(", ")}.`,
    details: { missing },
    actionLabel: complete ? "Review profile" : "Complete profile",
    href: businessHref("/business/settings", { businessId, tab: "profile" }),
    required: true,
    blocksLaunch: !complete,
    merchantDone: complete
  };
}

function locationCheck({ business = {}, branches = [], businessId = "", requirement = "required", archetype } = {}) {
  if (requirement === "not_required") return { id: "location", group: "customer", label: "Location", state: "not_required", owner: "none", description: "A customer location is not required for this operating model.", required: false, blocksLaunch: false, merchantDone: true, href: businessHref("/business/branches", { businessId }) };
  const noun = archetype?.nouns?.branch || "location";
  const candidate = branches.find((branch) => branch.status !== "removed" && branch.status !== "archived") || branches[0] || null;
  const missing = [];
  if (!candidate) missing.push(`${noun} record`);
  else {
    if (!text(candidate.branchName || candidate.name)) missing.push(`${noun} name`);
    if (!text(candidate.address || candidate.city)) missing.push("address or service area");
    if (!text(candidate.phone || candidate.email || business.phone || business.email)) missing.push("customer contact");
    if (!hasOpeningHours(candidate) && !["online_only", "mobile_service"].includes(business.operatingModel)) missing.push("opening hours");
  }
  const complete = missing.length === 0 || requirement === "optional";
  const label = `${capital(noun)} readiness`;
  return {
    id: "location",
    group: "customer",
    label,
    state: complete ? (missing.length ? "incomplete" : "complete") : "action_required",
    owner: missing.length ? "merchant" : "none",
    description: !missing.length ? `${capital(noun)} details are ready for customers.` : `${candidate?.branchName || candidate?.name || `Main ${noun}`}: add ${missing.join(", ")}.`,
    details: { missing, branchId: candidate?.id || null },
    actionLabel: missing.length ? `Complete ${noun}` : `Review ${noun}`,
    href: businessHref(branches.length > 1 || business.operatingModel === "physical_multi" ? "/business/branches" : "/business/setup", { businessId, ...(branches.length > 1 || business.operatingModel === "physical_multi" ? {} : { step: "location" }) }),
    required: requirement === "required",
    blocksLaunch: requirement === "required" && missing.length > 0,
    merchantDone: missing.length === 0 || requirement !== "required"
  };
}

function catalogCheck({ products = [], businessId = "", requirement = "required", archetype } = {}) {
  const noun = archetype?.nouns?.items || "items";
  if (requirement === "not_required") return { id: "catalog", group: "customer", label: capital(archetype?.nouns?.catalog || "Catalogue"), state: "not_required", owner: "none", description: `A customer ${noun} catalogue is not required for this business type.`, required: false, blocksLaunch: false, merchantDone: true, href: businessHref("/business/catalog", { businessId }) };
  const active = products.filter((item) => item.active !== false);
  const ready = active.filter(productReady);
  const missingPrice = active.filter((item) => !productReady(item) && item.itemType !== "listing");
  const imageReview = active.filter(imageReviewNeeded);
  const complete = ready.length > 0 && missingPrice.length === 0 && imageReview.length === 0;
  let description = `${ready.length} ready`;
  const details = [];
  if (missingPrice.length) details.push(`${missingPrice.length} need prices or required customer details`);
  if (imageReview.length) details.push(`${imageReview.length} need image-rights review`);
  if (!active.length) description = `Add the first ${archetype?.nouns?.item || "item"}.`;
  else if (!complete) description = details.join(" · ") || `No ${noun} are ready for customers yet.`;
  else if (details.length) description = `${description} · ${details.join(" · ")}`;
  else description = `${ready.length} ${ready.length === 1 ? archetype?.nouns?.item || "item" : noun} ready for launch.`;
  return {
    id: "catalog",
    group: "customer",
    label: archetype?.nouns?.catalog || "Products",
    state: complete ? "complete" : "action_required",
    owner: complete ? "none" : "merchant",
    description,
    details: { total: products.length, active: active.length, ready: ready.length, missingPrice: missingPrice.length, imageReview: imageReview.length },
    actionLabel: complete ? `Review ${noun}` : `Continue with ${noun}`,
    href: businessHref("/business/catalog", { businessId }),
    required: requirement === "required",
    blocksLaunch: requirement === "required" && !complete,
    merchantDone: complete || requirement !== "required"
  };
}

function operationsCheck({ operations = {}, businessId = "", requirement = "required" } = {}) {
  if (requirement === "not_required") return { id: "operations", group: "customer", label: "Pickup workflow", state: "not_required", owner: "none", description: "Pickup configuration is not required for this business.", required: false, blocksLaunch: false, merchantDone: true, href: businessHref("/business/settings", { businessId, tab: "operations" }) };
  const missing = [];
  if (!number(operations.preparationMinutes)) missing.push("preparation time");
  if (!text(operations.pickupInstructions)) missing.push("pickup instructions");
  const complete = missing.length === 0;
  return {
    id: "operations",
    group: "customer",
    label: "Pickup workflow",
    state: complete ? "complete" : "action_required",
    owner: complete ? "none" : "merchant",
    description: complete ? "Pickup preparation and customer instructions are configured." : `Add ${missing.join(" and ")}.`,
    details: { missing },
    actionLabel: complete ? "Review pickup settings" : "Complete pickup settings",
    href: businessHref("/business/settings", { businessId, tab: "operations" }),
    required: requirement === "required",
    blocksLaunch: requirement === "required" && !complete,
    merchantDone: complete || requirement !== "required"
  };
}

function paymentChecks({ business = {}, businessId = "", requirements = {} } = {}) {
  const money = business.moneySetup || {};
  const methods = list(money.paymentMethods || business.paymentMethods);
  const customerRequired = requirements.customerPayments === "required";
  const customerConfigured = !customerRequired || Boolean(money.customerSettingsConfigured);
  const customer = {
    id: "customer_payments",
    group: "money",
    label: "Customer payment methods",
    state: customerRequired ? (customerConfigured ? "complete" : "action_required") : "not_required",
    owner: customerRequired && !customerConfigured ? "merchant" : "none",
    description: customerRequired ? (customerConfigured ? `${methods.length ? methods.join(", ") : "Payment methods"} configured.` : "Choose how customers can pay.") : "Customer payment setup is not required for this business type.",
    actionLabel: customerConfigured ? "Review payment methods" : "Configure payment methods",
    href: businessHref("/business/finance", { businessId, tab: "setup" }),
    required: customerRequired,
    blocksLaunch: customerRequired && !customerConfigured,
    merchantDone: customerConfigured
  };

  const settlementRequired = requirements.settlement === "required";
  const settlementStatus = status(money.settlementStatus);
  const verified = settlementStatus === "verified";
  const inReview = ["details_submitted", "submitted", "under_review", "pending", "review"].includes(settlementStatus);
  const needsAction = ["action_required", "rejected", "changes_requested"].includes(settlementStatus);
  const settlement = {
    id: "settlement",
    group: "money",
    label: "Settlement account",
    state: !settlementRequired ? "not_required" : verified ? "complete" : inReview ? "in_review" : needsAction ? "action_required" : "action_required",
    owner: !settlementRequired || verified ? "none" : inReview ? "spotly" : "merchant",
    description: !settlementRequired ? "Online settlement is not required for the selected payment methods." : verified ? "Spotly has verified the settlement account." : inReview ? "Spotly is verifying where eligible business funds can be settled." : needsAction ? "Spotly needs updated settlement details." : "Submit a settlement account for verification.",
    details: { settlementStatus: settlementStatus || "not_started", last4: money.settlementLast4 || money.last4 || "" },
    actionLabel: inReview ? "View settlement status" : verified ? "Review settlement account" : "Complete settlement details",
    href: businessHref("/business/finance", { businessId, tab: "setup" }),
    required: settlementRequired,
    blocksLaunch: settlementRequired && !verified,
    merchantDone: !settlementRequired || verified || inReview
  };
  return [customer, settlement];
}

function teamCheck({ business = {}, invitations = [], members = [], businessId = "" } = {}) {
  const reviewed = Boolean(business.teamReviewedAt || members.length || invitations.some((item) => ["pending", "accepted"].includes(status(item.status))));
  return {
    id: "team",
    group: "team",
    label: "Team access",
    state: reviewed ? "complete" : "incomplete",
    owner: reviewed ? "none" : "merchant",
    description: reviewed ? `${members.length || 1} person${(members.length || 1) === 1 ? "" : "s"} currently have access.` : "Review who should be able to operate this business. Inviting another person is optional for owner-operated businesses.",
    actionLabel: "Review team access",
    href: businessHref("/business/staff", { businessId }),
    required: false,
    blocksLaunch: false,
    merchantDone: true
  };
}

function launchReviewState(business = {}) {
  const explicit = status(business.launchReview?.status || business.lifecycle?.launchReviewStatus);
  if (explicit) return explicit;
  if (status(business.status) === "pending_publication_review") return "submitted";
  if (status(business.status) === "active" && business.public === true) return "approved";
  return "not_ready";
}

function publicationState(business = {}, reviewStatus = "") {
  const explicit = status(business.lifecycleStatus || business.lifecycle?.state);
  if (explicit) return explicit;
  const legacy = status(business.status);
  if (["suspended", "removed"].includes(legacy)) return "suspended";
  if (legacy === "paused") return "paused";
  if ((legacy === "active" && business.public === true) || reviewStatus === "approved") return "live";
  if (["submitted", "in_review", "assigned", "re_review_submitted", "re_review_in_review"].includes(reviewStatus) || legacy === "pending_publication_review") return "launch_review";
  return "preparing";
}

export function lifecycleStatusLabel(lifecycle = {}) {
  if (lifecycle.businessState === "suspended") return "Suspended";
  if (lifecycle.businessState === "paused") return "Live · Temporarily paused";
  if (lifecycle.stage === "live") {
    if (lifecycle.launchReview?.status === "re_review_required") return "Live · Review update required";
    if (["re_review_submitted", "re_review_in_review"].includes(lifecycle.launchReview?.status)) return "Live · Changes waiting on Spotly";
    return "Live";
  }
  if (lifecycle.stage === "review") return lifecycle.launchReview?.state === "action_required" ? "Launch review · Changes need attention" : "Waiting on Spotly launch review";
  if (lifecycle.stage === "basics") return "Setting up business basics";
  if (lifecycle.stage === "access") return lifecycle.access?.state === "in_review" ? "Waiting on Spotly business access" : "Verify business access";
  return "Preparing for launch";
}

export function getBusinessLifecycle(input = {}) {
  const {
    business = {}, branches = [], products = [], operations = {}, invitations = [], members = [], claims = [], membership = null,
    selectedBusinessId = business.id || "", archetype: providedArchetype, platformSettings = {}
  } = input;
  const businessId = selectedBusinessId || business.id || "";
  const archetype = providedArchetype || businessArchetype(business);
  const setup = evaluateSetupSteps({ business, branches, products, operations });
  const requirements = getLaunchRequirements({ business, archetype, operations, platformSettings });
  const access = accessCheck({ business, membership, claims, businessId });
  const checks = [
    {
      id: "basics",
      group: "basics",
      label: "Business basics",
      state: setup.complete ? "complete" : "action_required",
      owner: setup.complete ? "none" : "merchant",
      description: setup.complete ? "Business type, operating model and foundational details are confirmed." : `${setup.requiredTotal - setup.requiredComplete} required basic step${setup.requiredTotal - setup.requiredComplete === 1 ? "" : "s"} remain.`,
      actionLabel: setup.complete ? "Review business details" : "Continue setup",
      href: businessHref("/business/setup", { businessId, ...(setup.firstIncompleteId ? { step: setup.firstIncompleteId } : {}) }),
      required: true,
      blocksLaunch: !setup.complete,
      merchantDone: setup.complete
    },
    profileCheck({ business, branches, businessId }),
    locationCheck({ business, branches, businessId, requirement: requirements.location, archetype }),
    catalogCheck({ products, businessId, requirement: requirements.catalog, archetype }),
    operationsCheck({ operations, businessId, requirement: requirements.pickup }),
    ...paymentChecks({ business, businessId, requirements }),
    {
      id: "platform_launch",
      group: "system",
      label: "Spotly business launches",
      state: requirements.launchEnabled && requirements.launchReviewEnabled ? "complete" : "blocked",
      owner: requirements.launchEnabled && requirements.launchReviewEnabled ? "none" : "system",
      description: requirements.launchEnabled && requirements.launchReviewEnabled ? "Spotly is accepting final business launch reviews." : "Spotly has temporarily paused new business launch decisions at platform level.",
      actionLabel: "View launch status",
      href: businessHref("/business/launch", { businessId }),
      required: true,
      blocksLaunch: !(requirements.launchEnabled && requirements.launchReviewEnabled),
      merchantDone: true
    },
    teamCheck({ business, invitations, members, businessId })
  ];

  const requiredMerchantChecks = checks.filter((item) => item.required && item.owner !== "spotly" && item.id !== "settlement" && item.id !== "platform_launch");
  const settlement = checks.find((item) => item.id === "settlement");
  if (settlement?.required) requiredMerchantChecks.push(settlement);
  const merchantCompleteCount = requiredMerchantChecks.filter((item) => item.merchantDone).length;
  const merchantProgress = requiredMerchantChecks.length ? Math.round((merchantCompleteCount / requiredMerchantChecks.length) * 100) : 100;
  const merchantWorkComplete = requiredMerchantChecks.every((item) => item.merchantDone);
  const launchBlockers = [access, ...checks].filter((item) => item.required && item.blocksLaunch);
  const externalReviews = [access, ...checks].filter((item) => item.owner === "spotly" && ["in_review", "blocked"].includes(item.state));

  const reviewStatus = launchReviewState(business);
  const businessState = publicationState(business, reviewStatus);
  const reviewChanges = list(business.launchReview?.requestedChanges);
  const launchReview = {
    id: "launch_review",
    label: "Final launch review",
    state: reviewStatus === "approved" ? "complete"
      : ["submitted", "in_review", "assigned", "re_review_submitted", "re_review_in_review"].includes(reviewStatus) ? "in_review"
        : ["changes_requested", "action_required", "rejected", "resubmission_required", "re_review_required"].includes(reviewStatus) ? "action_required"
          : access.state !== "complete" || !setup.complete || launchBlockers.length ? "blocked" : "incomplete",
    owner: reviewStatus === "approved" ? "none"
      : ["submitted", "in_review", "assigned", "re_review_submitted", "re_review_in_review"].includes(reviewStatus) ? "spotly"
        : "merchant",
    status: reviewStatus,
    description: reviewStatus === "approved" ? "Spotly approved this business for launch."
      : ["re_review_submitted", "re_review_in_review"].includes(reviewStatus) ? "Your business remains live while Spotly reviews the launch-critical changes you submitted."
        : ["submitted", "in_review", "assigned"].includes(reviewStatus) ? "Your launch setup is submitted. Spotly is completing the final customer-readiness review."
          : reviewStatus === "re_review_required" ? "A launch-critical business detail changed. Your business stays live, but the change needs Spotly review."
            : reviewStatus === "resubmission_required" ? "A launch-critical detail changed after submission. Review the current setup and resubmit it for final launch review."
              : ["changes_requested", "action_required", "rejected"].includes(reviewStatus) ? `${reviewChanges.length || "Some"} launch review change${reviewChanges.length === 1 ? "" : "s"} need your attention.`
                : launchBlockers.length ? "Complete the required launch items before submitting for final Spotly review." : "Your launch setup is ready to submit for Spotly's final review.",
    actionLabel: reviewStatus === "re_review_required" ? "Submit changes for review"
      : reviewStatus === "resubmission_required" ? "Resubmit for Spotly review"
        : ["changes_requested", "action_required", "rejected"].includes(reviewStatus) ? "Review requested changes"
          : ["submitted", "in_review", "assigned", "re_review_submitted", "re_review_in_review"].includes(reviewStatus) ? "View review status"
            : launchBlockers.length ? "View launch checklist" : "Submit for Spotly review",
    href: businessHref("/business/launch", { businessId, section: "review" }),
    requestedChanges: reviewChanges,
    submittedAt: business.launchReview?.submittedAt || business.publicationReviewRequestedAt || null,
    approvedAt: business.launchReview?.approvedAt || null,
    required: true,
    blocksLaunch: reviewStatus !== "approved"
  };

  let stage = "access";
  if (access.state === "complete") stage = setup.complete ? "prepare" : "basics";
  if (businessState === "launch_review" || launchReview.state === "in_review") stage = "review";
  if (businessState === "live" || businessState === "paused" || businessState === "suspended") stage = "live";
  if (launchReview.state === "action_required" && access.state === "complete" && setup.complete && !["live", "paused", "suspended"].includes(businessState)) stage = "review";
  const stageDef = BUSINESS_LIFECYCLE_STAGES.find((item) => item.id === stage) || BUSINESS_LIFECYCLE_STAGES[0];

  const merchantActions = [access, ...checks]
    .filter((item) => item.owner === "merchant" && ["action_required", "incomplete"].includes(item.state) && item.required)
    .sort((a, b) => {
      const priority = { access: 0, basics: 1, profile: 2, location: 3, catalog: 4, operations: 5, customer_payments: 6, settlement: 7 };
      return (priority[a.id] ?? 99) - (priority[b.id] ?? 99);
    });

  let nextAction = merchantActions[0] ? {
    id: merchantActions[0].id,
    label: merchantActions[0].description,
    actionLabel: merchantActions[0].actionLabel,
    href: merchantActions[0].href
  } : null;
  if (!nextAction && launchReview.state === "action_required") nextAction = { id: "launch_review_changes", label: launchReview.description, actionLabel: launchReview.actionLabel, href: launchReview.href };
  if (!nextAction && !launchBlockers.length && !["in_review", "complete"].includes(launchReview.state)) nextAction = { id: "submit_launch_review", label: "Your required launch setup is complete.", actionLabel: "Submit for Spotly review", href: launchReview.href };

  const canOperate = stage === "live" && businessState === "live";
  const lifecycle = {
    stage,
    stageNumber: stageDef.number,
    stageCount: BUSINESS_LIFECYCLE_STAGES.length,
    stageLabel: stageDef.label,
    businessState,
    access,
    setup,
    requirements,
    launchChecks: checks,
    launchReview,
    merchantProgress,
    merchantWorkComplete,
    merchantActionCount: merchantActions.length,
    externalReviews,
    externalReviewCount: externalReviews.length + (launchReview.owner === "spotly" ? 1 : 0),
    launchBlockers,
    nextAction,
    navigationMode: businessState === "suspended" ? "suspended" : stage === "live" ? "live" : stage === "access" ? "access" : stage === "basics" ? "basics" : "prelaunch",
    canOperate,
    canTakeOrders: canOperate,
    canUseKiosk: canOperate,
    canUseInsights: canOperate,
    canUsePromotions: canOperate,
    canSubmitLaunchReview: access.state === "complete" && setup.complete && launchBlockers.length === 0 && !["in_review", "complete"].includes(launchReview.state),
    canGoLive: launchReview.state === "complete" && launchBlockers.length === 0,
    operationalWarnings: [
      ...(reviewStatus === "re_review_required" ? [{ id: "launch_re_review", label: "Business review update required", description: launchReview.description, href: launchReview.href, owner: "merchant" }] : []),
      ...(["re_review_submitted", "re_review_in_review"].includes(reviewStatus) ? [{ id: "launch_re_review", label: "Business changes waiting on Spotly", description: launchReview.description, href: launchReview.href, owner: "spotly" }] : [])
    ]
  };
  lifecycle.statusLabel = lifecycleStatusLabel(lifecycle);
  lifecycle.defaultHref = businessState === "suspended" ? businessHref("/business/launch", { businessId }) : stage === "live" ? businessHref("/business/today", { businessId }) : businessHref("/business/launch", { businessId });
  return lifecycle;
}

export function lifecycleSummaryForPortfolio({ business = {}, businessId = business.id || "" } = {}) {
  const reviewStatus = launchReviewState(business);
  const state = publicationState(business, reviewStatus);
  if (state === "live") return { stage: "live", label: "Live", merchantProgress: 100, href: businessHref("/business/today", { businessId }), actionLabel: "Open business" };
  if (state === "paused") return { stage: "live", label: "Live · Temporarily paused", merchantProgress: 100, href: businessHref("/business/today", { businessId }), actionLabel: "Open business" };
  if (state === "suspended") return { stage: "live", label: "Suspended", merchantProgress: 100, href: businessHref("/business/launch", { businessId }), actionLabel: "View status" };
  if (state === "launch_review") return { stage: "review", label: "Waiting on Spotly launch review", merchantProgress: number(business.lifecycleSummary?.merchantProgress) || 100, href: businessHref("/business/launch", { businessId }), actionLabel: "View Spotly review" };
  const setupComplete = Boolean(business.onboarding?.completedAt || business.onboardingStatus === "complete");
  return {
    stage: setupComplete ? "prepare" : "basics",
    label: setupComplete ? "Preparing for launch" : "Set up business basics",
    merchantProgress: number(business.lifecycleSummary?.merchantProgress) || (setupComplete ? number(business.launchProgress) : number(business.onboarding?.percent)),
    href: setupComplete ? businessHref("/business/launch", { businessId }) : businessHref("/business/setup", { businessId, step: business.onboarding?.lastVisitedStep || business.onboarding?.currentStep || "identity" }),
    actionLabel: setupComplete ? "Continue preparation" : "Continue setup"
  };
}

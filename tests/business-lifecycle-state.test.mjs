import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function loadLifecycleModule() {
  let source = readFileSync(join(process.cwd(), "lib/business-lifecycle.js"), "utf8");
  source = source
    .replace(/^import[^;]+;\n/gm, "")
    .replace(/export const /g, "const ")
    .replace(/export function /g, "function ");

  const setupSteps = [
    { id: "identity", label: "Confirm the business", short: "Business" },
    { id: "operation", label: "Choose how it operates", short: "Model" },
    { id: "location", label: "Set the first location", short: "Location" },
    { id: "offering", label: "Choose what customers do", short: "Experience" },
    { id: "starter", label: "Start with useful content", short: "Starter" },
    { id: "review", label: "Review and open the workspace", short: "Review" }
  ];
  const archetype = {
    id: "grocery_retail",
    setup: setupSteps.map((step) => step.id),
    capabilities: ["catalog", "pickup_orders"],
    nouns: { item: "product", items: "products", activity: "orders", catalog: "Products", branch: "location" }
  };
  const context = {
    SETUP_STEPS: setupSteps,
    businessArchetype: () => archetype,
    inferBusinessType: (business = {}) => business.businessType || "grocery_retail",
    businessHref: (path, params = {}) => {
      const query = new URLSearchParams();
      if (params.businessId) query.set("business", params.businessId);
      for (const [key, value] of Object.entries(params)) if (key !== "businessId" && value !== undefined && value !== null && value !== "") query.set(key, String(value));
      return query.size ? `${path}?${query.toString()}` : path;
    },
    URLSearchParams,
    Set,
    Map,
    Math,
    Number,
    String,
    Boolean,
    Object,
    Array,
    Date
  };
  source += "\nglobalThis.__lifecycle = { evaluateSetupSteps, resolveSetupStep, normalizeBusinessLifecycleInput, getBusinessLifecycle };";
  vm.runInNewContext(source, context, { filename: "business-lifecycle.js" });
  return context.__lifecycle;
}

const lifecycleModule = loadLifecycleModule();

function completedBusiness(overrides = {}) {
  return {
    id: "b1",
    brandName: "Monomutapa",
    category: "Groceries",
    description: "Local grocery store",
    phone: "+263700000000",
    businessType: "grocery_retail",
    operatingModel: "physical_single",
    capabilities: ["catalog", "pickup_orders"],
    moneySetup: { customerSettingsConfigured: true, paymentMethods: ["cash"] },
    onboardingStatus: "complete",
    onboarding: {
      completedAt: "2026-08-10T12:00:00.000Z",
      completedSteps: ["identity", "operation", "location", "offering", "starter", "review"]
    },
    ...overrides
  };
}

function readyBranch(overrides = {}) {
  return {
    id: "branch-main",
    businessId: "b1",
    branchName: "Main location",
    city: "Harare",
    address: "1 Samora Machel Avenue",
    phone: "+263700000000",
    status: "active",
    public: true,
    openingHours: { monday: { open: "08:00", close: "17:00", closed: false } },
    ...overrides
  };
}

function readyInput(overrides = {}) {
  return {
    business: completedBusiness(),
    branches: [readyBranch()],
    products: [{ id: "p1", businessId: "b1", active: true, price: 3 }],
    operations: { preparationMinutes: 30, pickupInstructions: "Bring your order number." },
    membership: { role: "business_owner", status: "active", businessId: "b1", userId: "u1" },
    claims: [],
    invitations: [],
    members: [{ role: "business_owner", status: "active", businessId: "b1", userId: "u1" }],
    selectedBusinessId: "b1",
    platformSettings: { commerce: { enabled: true }, launch: { businessLaunchEnabled: true, businessLaunchReviewEnabled: true } },
    ...overrides
  };
}

test("a fully prepared business has one consistent pre-review lifecycle result", () => {
  const lifecycle = lifecycleModule.getBusinessLifecycle(readyInput());
  assert.equal(lifecycle.stage, "prepare");
  assert.equal(lifecycle.navigationMode, "prelaunch");
  assert.equal(lifecycle.merchantProgress, 100);
  assert.equal(lifecycle.canSubmitLaunchReview, true);
  assert.equal(lifecycle.launchBlockers.length, 0);
  assert.equal(lifecycle.setup.foundationEstablished, true);
  assert.equal(lifecycle.setup.requiredBasicsComplete, true);
  assert.equal(lifecycle.canonicalLocation.id, "branch-main");
});

test("a degraded launch location does not throw an already-completed business back into Stage 2", () => {
  const lifecycle = lifecycleModule.getBusinessLifecycle(readyInput({
    branches: [readyBranch({ address: "", phone: "", openingHours: {} })],
    business: completedBusiness({ phone: "", email: "", whatsapp: "" })
  }));
  assert.equal(lifecycle.setup.foundationEstablished, true);
  assert.equal(lifecycle.stage, "prepare");
  assert.equal(lifecycle.navigationMode, "prelaunch");
  assert.equal(lifecycle.launchChecks.find((check) => check.id === "basics").state, "complete");
  assert.equal(lifecycle.launchChecks.find((check) => check.id === "location").state, "action_required");
  assert.equal(lifecycle.canSubmitLaunchReview, false);
  assert.equal(lifecycle.nextAction.id, "profile");
});

test("canonical location ignores a stale incomplete first branch", () => {
  const lifecycle = lifecycleModule.getBusinessLifecycle(readyInput({
    business: completedBusiness({ primaryBranchId: "stale" }),
    branches: [
      { id: "stale", businessId: "b1", branchName: "Old draft", city: "", status: "active" },
      readyBranch({ id: "valid" })
    ]
  }));
  assert.equal(lifecycle.canonicalLocation.id, "valid");
  assert.equal(lifecycle.setup.canonicalBranchId, "valid");
  assert.equal(lifecycle.launchChecks.find((check) => check.id === "location").state, "complete");
});

test("Review is not counted in the foundational completion percentage", () => {
  const business = completedBusiness({
    onboardingStatus: "in_progress",
    onboarding: { completedSteps: ["identity", "operation", "offering", "starter"] }
  });
  const setup = lifecycleModule.evaluateSetupSteps({ business, branches: [], products: [], operations: {} });
  assert.equal(setup.requiredTotal, 5);
  assert.equal(setup.requiredComplete, 4);
  assert.equal(setup.percent, 80);
  assert.equal(setup.foundationEstablished, false);
  assert.equal(setup.steps.find((step) => step.id === "review").required, false);
});

test("explicit Review can aggregate an earlier blocker while ordinary future steps remain prerequisite-gated", () => {
  const business = completedBusiness({
    onboardingStatus: "in_progress",
    onboarding: { completedSteps: ["identity", "operation", "offering", "starter"] }
  });
  const review = lifecycleModule.resolveSetupStep({ requestedStep: "review", business, branches: [] });
  assert.equal(review.stepId, "review");
  const starter = lifecycleModule.resolveSetupStep({ requestedStep: "starter", business, branches: [] });
  assert.equal(starter.stepId, "location");
});

test("published pickup business without a persisted location is operationally blocked instead of falsely 100% live", () => {
  const lifecycle = lifecycleModule.getBusinessLifecycle({
    business: completedBusiness({ status: "active", public: true, operatingModel: "online_only" }),
    branches: [],
    products: [{ id: "p1", active: true, price: 2 }],
    operations: { preparationMinutes: 20, pickupInstructions: "Collect at desk" },
    membership: { role: "business_owner", status: "active" },
    platformSettings: {}
  });
  const location = lifecycle.launchChecks.find((item) => item.id === "location");
  assert.equal(location.required, true);
  assert.equal(location.blocksLaunch, true);
  assert.equal(lifecycle.operationallyBlocked, true);
  assert.equal(lifecycle.canOperate, false);
  assert.equal(lifecycle.navigationMode, "prelaunch");
  assert.equal(lifecycle.statusLabel, "Live · Action required");
  assert.match(lifecycle.defaultHref, /\/business\/launch/);
});

test("online-only non-fulfilment business can still treat a physical location as optional", () => {
  const lifecycle = lifecycleModule.getBusinessLifecycle({
    business: completedBusiness({ operatingModel: "online_only", capabilities: ["profile"], status: "draft", public: false }),
    branches: [],
    products: [],
    operations: {},
    membership: { role: "business_owner", status: "active" },
    platformSettings: {}
  });
  const location = lifecycle.launchChecks.find((item) => item.id === "location");
  assert.equal(location.required, false);
  assert.equal(location.blocksLaunch, false);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { businessHref } from "../lib/business-routing.js";

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), "utf8");

test("business lifecycle has exactly five merchant-facing stages", () => {
  const source = read("lib/business-lifecycle.js");
  for (const stage of ["Verify access", "Set up the business", "Prepare for launch", "Spotly launch review", "Live"]) assert.match(source, new RegExp(stage));
  assert.match(source, /BUSINESS_LIFECYCLE_STAGES\.length/);
});

test("setup completion is data-derived and progress is based on completed required steps", () => {
  const source = read("lib/business-lifecycle.js");
  assert.match(source, /evaluateSetupSteps/);
  assert.match(source, /requiredComplete \/ required\.length/);
  assert.match(source, /firstIncompleteId/);
  assert.doesNotMatch(source, /currentPosition \/.*steps\.length/);
});

test("setup location completion canonicalizes valid saved locations instead of trusting array order", () => {
  const source = read("lib/business-lifecycle.js");
  assert.match(source, /normalizeBusinessLifecycleInput/);
  assert.match(source, /branchSetupValid/);
  assert.match(source, /location: \(\) => branches\.some\(\(branch\) => branchSetupValid\(branch, business\)\)/);
  assert.doesNotMatch(source, /const firstBranch = branches\[0\]/);
});

test("setup resume validates prerequisites but Review aggregates blockers instead of silently bouncing", () => {
  const source = read("lib/business-lifecycle.js");
  assert.match(source, /resolveSetupStep/);
  assert.match(source, /requestedStep === "review"/);
  assert.match(source, /requestedIndex <= firstIncompleteIndex/);
  assert.match(source, /redirectToLaunch: true/);
  const setup = read("components/business/setup.js");
  assert.match(setup, /searchParams\.get\("step"\)/);
  assert.match(setup, /router\.replace\(businessHref\("\/business\/launch"/);
  assert.match(setup, /lastVisitedStep/);
});

test("businessHref preserves explicit business context and extra deep-link parameters", () => {
  assert.equal(businessHref("/business/catalog", { businessId: "b 1", product: "p/2" }), "/catalog?business=b+1&product=p%2F2");
  assert.equal(businessHref("/business/setup?foo=bar", { businessId: "abc", step: "location" }), "/setup?foo=bar&business=abc&step=location");
});

test("persistent business layout owns auth provider and portal shell", () => {
  const layout = read("app/business/layout.js");
  const client = read("components/business/business-layout-client.js");
  const workspace = read("components/business/business-workspace.js");
  assert.match(layout, /BusinessLayoutClient/);
  assert.match(client, /BusinessDataProvider/);
  assert.match(client, /PortalShell/);
  assert.match(client, /stableNavigation/);
  assert.doesNotMatch(workspace, /<BusinessDataProvider/);
  assert.doesNotMatch(workspace, /<PortalShell/);
});

test("pre-live navigation is lifecycle-gated instead of setup-complete gated", () => {
  const nav = read("data/business-archetypes.js");
  const workspace = read("components/business/business-workspace.js");
  assert.match(nav, /navigationMode/);
  assert.match(nav, /Launch checklist/);
  assert.match(nav, /Business details/);
  assert.match(workspace, /navigationMode === "basics"/);
  // recoverable null lifecycle must not crash workspace navigation while lifecycle loads/fails
  assert.match(workspace, /if \(!lifecycle\) return/);
  assert.match(workspace, /LockedBusinessFeature/);
  assert.doesNotMatch(nav, /onboardingStatus === "complete"/);
});

test("pre-live Today cannot render operational mode through normal workspace gating", () => {
  const workspace = read("components/business/business-workspace.js");
  assert.match(workspace, /return \["launch", "setup", "catalog", "branches", "staff", "finance", "support", "settings"\]\.includes\(section\)/);
  assert.match(workspace, /!allowed \? <LockedBusinessFeature/);
});

test("merchant progress and Spotly review state are shown separately", () => {
  const lifecycle = read("lib/business-lifecycle.js");
  const launch = read("components/business/launch.js");
  assert.match(lifecycle, /merchantProgress/);
  assert.match(lifecycle, /externalReviewCount/);
  assert.match(launch, /This does not reduce your setup percentage/);
  assert.match(launch, /Waiting on Spotly/);
});

test("final launch review is server-authoritative for merchant submission and Admin decision", () => {
  const submit = read("app/api/business/launch-review/submit/route.js");
  const decision = read("app/api/admin/business-launch-reviews/decision/route.js");
  assert.match(submit, /requireBusinessPermission/);
  assert.match(submit, /loadBusinessLifecycleData/);
  assert.match(submit, /businessLaunchReviews/);
  assert.match(submit, /launch_review_submitted/);
  assert.match(submit, /runTransaction/);
  assert.match(submit, /transaction\.get\(businessRef\)/);
  assert.match(submit, /A final launch review is already active/);
  assert.match(decision, /requirePlatformPermission/);
  assert.match(decision, /request_changes/);
  assert.match(decision, /launch_review_approved/);
  assert.match(decision, /public: reviewType === "re_review" \? business\.public !== false : true/);
  assert.match(decision, /runTransaction/);
  assert.match(decision, /transaction\.get\(reviewRef\)/);
  assert.match(decision, /transaction\.get\(businessRef\)/);
});

test("Firestore blocks browser authority over launch publication and direct launch reviews", () => {
  const rules = read("firestore.rules");
  const businessBlock = rules.slice(rules.indexOf("match /businesses/{businessId}"), rules.indexOf("match /organizations/{organizationId}"));
  assert.doesNotMatch(businessBlock, /"public"/);
  assert.doesNotMatch(businessBlock, /"status"/);
  assert.match(rules, /match \/businessLaunchReviews\/\{reviewId\}/);
  assert.match(rules, /allow create, update, delete: if false/);
});

test("settlement verification is explicitly separate from access and launch review", () => {
  const finance = read("components/business/finance.js");
  const launch = read("components/business/launch.js");
  assert.match(finance, /separate from your business-access approval/);
  assert.match(finance, /separate from the final Spotly launch review/);
  assert.match(launch, /separate from business-access approval, settlement verification/);
});

test("catalogue preparation explains that products remain private before live", () => {
  const catalog = read("components/business/catalog.js");
  assert.match(catalog, /remain private to customers until this business completes the final Spotly launch review and becomes live/);
});

test("Admin queue distinguishes final launch review and records structured requested changes", () => {
  const ui = read("components/admin-queue-app.js");
  const api = read("app/api/admin/queues/route.js");
  assert.match(ui, /Final launch reviews/);
  assert.match(ui, /Approve for launch/);
  assert.match(ui, /Request changes/);
  assert.match(ui, /requestedChanges/);
  assert.match(api, /business_launch_review/);
});



test("suspended businesses stay out of onboarding and restrict operational workspace", () => {
  const lifecycle = read("lib/business-lifecycle.js");
  const workspace = read("components/business/business-workspace.js");
  const nav = read("data/business-archetypes.js");
  assert.match(lifecycle, /businessState === "suspended" \? "suspended"/);
  assert.match(workspace, /navigationMode === "suspended"/);
  assert.match(nav, /mode === "suspended"/);
  assert.match(nav, /Business status/);
});

test("platform launch controls block submission without changing merchant progress ownership", () => {
  const lifecycle = read("lib/business-lifecycle.js");
  const admin = read("components/admin-app.js");
  assert.match(lifecycle, /businessLaunchEnabled/);
  assert.match(lifecycle, /businessLaunchReviewEnabled/);
  assert.match(lifecycle, /id !== "platform_launch"/);
  assert.match(admin, /Accept final business launch reviews/);
  assert.match(admin, /Allow approved businesses to go live/);
});

test("environment contract documents server-only image and finance secrets without values", () => {
  const env = read(".env.example");
  assert.match(env, /^OPENAI_API_KEY=$/m);
  assert.match(env, /^OPENAI_IMAGE_MODEL=gpt-image-2$/m);
  assert.match(env, /^OPENAI_TRANSPARENT_IMAGE_MODEL=gpt-image-1\.5$/m);
  assert.match(env, /^SPOTLY_FINANCE_ENCRYPTION_KEY=$/m);
});

test("launch-critical edits invalidate pre-live review but keep live businesses operational during re-review", () => {
  const lifecycle = read("lib/business-lifecycle.js");
  const invalidate = read("app/api/business/launch-review/invalidate/route.js");
  const submit = read("app/api/business/launch-review/submit/route.js");
  const decision = read("app/api/admin/business-launch-reviews/decision/route.js");
  const setup = read("components/business/setup.js");
  const settings = read("components/business/settings.js");
  const branches = read("components/business/branches.js");

  assert.match(lifecycle, /re_review_required/);
  assert.match(lifecycle, /re_review_submitted/);
  assert.match(lifecycle, /operationalWarnings/);
  assert.match(invalidate, /launch_review_invalidated/);
  assert.match(invalidate, /launch_re_review_required/);
  assert.match(invalidate, /mode: "live_re_review"/);
  assert.match(invalidate, /stage: "live"/);
  assert.match(submit, /reviewType: isLiveReReview \? "re_review" : "initial_launch"/);
  assert.match(decision, /reviewType === "re_review"/);
  assert.match(decision, /must not throw that business back into onboarding/);
  assert.match(setup, /markLaunchCriticalBusinessChange/);
  assert.match(settings, /launch-critical business identity information/);
  assert.match(branches, /primary launch location/);
});

test("trusted Admin lifecycle controls suspend/resume without reopening onboarding", () => {
  const route = read("app/api/admin/business-lifecycle/route.js");
  const admin = read("components/admin-app.js");
  assert.match(route, /action: z\.enum\(\["suspend", "resume"\]\)/);
  assert.match(route, /previousStatus/);
  assert.match(route, /business_suspended/);
  assert.match(route, /business_suspension_cleared/);
  assert.doesNotMatch(route, /onboardingStatus/);
  assert.match(admin, /Trusted business state/);
  assert.match(admin, /generic brand editor cannot mark a business approved, live, or public/);
  assert.match(admin, /\/api\/admin\/business-lifecycle/);
});

test("suspended businesses resolve to launch status rather than an operational Today destination", () => {
  const lifecycle = read("lib/business-lifecycle.js");
  assert.match(lifecycle, /businessState === "suspended" \? businessHref\("\/business\/launch"/);
  assert.match(lifecycle, /state === "suspended"\) return \{ stage: "live", label: "Suspended"[^\n]+\/business\/launch/);
});

test("Admin brand creation cannot bypass final launch review by creating an active business", () => {
  const route = read("app/api/admin/businesses/route.js");
  assert.match(route, /status: z\.enum\(\["provisional", "draft"\]\)/);
  assert.doesNotMatch(route.slice(0, route.indexOf("const TYPE_CAPABILITIES")), /pending_publication_review|"active"/);
  assert.match(route, /claimStatus: "unclaimed"/);
  assert.match(route, /verificationStatus: "unverified"/);
});

test("re-review approval preserves a paused live business instead of silently resuming it", () => {
  const route = read("app/api/admin/business-launch-reviews/decision/route.js");
  assert.match(route, /reviewType === "re_review" && business\.status === "paused" \? "paused" : "active"/);
  assert.match(route, /reviewType === "re_review" && business\.lifecycleStatus === "paused" \? "paused" : "live"/);
});


test("location structure uses a trusted server route and kiosk remains safe merchant configuration", () => {
  const branchApi = read("app/api/business/branches/route.js");
  const firebaseServices = read("lib/firebase-services.js");
  const businessServices = read("lib/business-services.js");
  const rules = read("firestore.rules");
  assert.match(branchApi, /requireBusinessPermission/);
  assert.match(branchApi, /Only a business-wide owner or manager can add or remove locations/);
  assert.match(branchApi, /FieldValue\.arrayUnion/);
  assert.match(branchApi, /FieldValue\.arrayRemove/);
  assert.match(branchApi, /runTransaction/);
  assert.match(firebaseServices, /authenticatedFetch\("\/api\/business\/branches"/);
  assert.match(businessServices, /authenticatedFetch\("\/api\/business\/branches"/);
  const branchRules = rules.slice(rules.indexOf("match /branches/{branchId}"), rules.indexOf("match /memberships/{membershipId}"));
  assert.match(branchRules, /allow create, update, delete: if false/);
  const businessRules = rules.slice(rules.indexOf("match /businesses/{businessId}"), rules.indexOf("match /organizations/{organizationId}"));
  assert.match(businessRules, /"kiosk"/);
});

test("partial business profile saves do not erase search terms", () => {
  const source = read("lib/firebase-services.js");
  const block = source.slice(source.indexOf("export async function saveBusinessProfile"), source.indexOf("export function subscribeMemberships"));
  assert.match(block, /searchableKeys/);
  assert.match(block, /updatesSearch/);
  assert.match(block, /currentSnapshot/);
  assert.match(block, /\.\.\.\(updatesSearch \? \{ searchTerms \} : \{\}\)/);
  assert.doesNotMatch(block, /searchTerms: normalizeSearchTerms\(values\.name/);
});


test("setup saves do not silently complete future steps from archetype defaults", () => {
  const lifecycle = read("lib/business-lifecycle.js");
  const setup = read("components/business/setup.js");
  assert.match(lifecycle, /offering: \(\) => capabilities\.length > 0 \|\| persisted\.has\("offering"\)/);
  assert.match(lifecycle, /starter: \(\) => persisted\.has\("starter"\)/);
  const identitySave = setup.slice(setup.indexOf('if (step.id === "identity")'), setup.indexOf('if (step.id === "operation")'));
  assert.doesNotMatch(identitySave, /capabilities: draft\.capabilities/);
  assert.match(setup, /if \(step\.id === "offering"\) profileChanges\.capabilities = draft\.capabilities/);
  assert.doesNotMatch(setup, /step\.id === "offering" \|\| finish/);
  assert.doesNotMatch(setup, /step\.id === "location" \|\| \(finish/);
  assert.match(setup, /setOptimisticBusiness\(projectedBusiness\)/);
});


test("pre-live branch visibility cannot bypass the business publication gate", () => {
  const rules = read("firestore.rules");
  const branches = read("components/business/branches.js");
  const branchRules = rules.slice(rules.indexOf("match /branches/{branchId}"), rules.indexOf("match /memberships/{membershipId}"));
  assert.match(branchRules, /resource\.data\.public == true && publicBusiness\(resource\.data\.businessId\)/);
  assert.match(branches, /Location setup is active/);
  assert.match(branches, /Ready when live/);
});


test("customer marketplace discovery and public child records require an actually live business", () => {
  const services = read("lib/firebase-services.js");
  const marketplace = read("components/marketplace-app.js");
  const rules = read("firestore.rules");
  assert.match(services, /export function isCustomerLiveBusiness/);
  assert.match(services, /export async function searchLiveBusinesses/);
  assert.match(marketplace, /searchLiveBusinesses/);
  assert.doesNotMatch(marketplace, /await searchBusinesses\(query,100\)/);
  assert.match(rules, /function publicBusiness\(businessId\) \{ return business\(businessId\)\.public == true &&/);
  assert.match(rules, /status in \["active", "paused"\]/);
});


test("customer order creation rechecks live business state inside the transaction", () => {
  const source = read("app/api/orders/create/route.js");
  assert.match(source, /businessLive/);
  assert.match(source, /businessData\?\.status === "active" \|\| businessData\?\.lifecycleStatus === "live"/);
  assert.match(source, /transaction\.get\(businessRef\)/);
  assert.match(source, /This business is no longer accepting customer orders/);
});


test("selected Business lifecycle is server authoritative with no client readiness fallback", () => {
  const context = read("components/business/business-context.js");
  const route = read("app/api/business/lifecycle/route.js");
  assert.match(context, /\/api\/business\/lifecycle\?businessId=/);
  assert.match(context, /const lifecycle = lifecycleBusinessId === selectedBusinessId \? authoritativeLifecycle : null/);
  assert.doesNotMatch(context, /getBusinessLifecycle\(/);
  const workspace = read("components/business/business-workspace.js");
  assert.match(workspace, /Spotly will not guess your setup or launch state/);
  assert.match(route, /loadBusinessLifecycleData/);
  assert.match(route, /publicLifecycleSnapshot/);
  assert.match(route, /Cache-Control.*no-store/);
  assert.match(route, /"custom"/);
});

test("authoritative lifecycle refresh synchronizes the selected Portfolio card", () => {
  const context = read("components/business/business-context.js");
  assert.match(context, /setBusinessChoices\(\(current\) => current\.map/);
  for (const field of ["lifecycleStage", "lifecycleLabel", "merchantProgress", "defaultHref", "launchReviewStatus", "externalReviewCount", "merchantActionCount"]) {
    assert.match(context, new RegExp(field));
  }
});

test("server lifecycle and Portfolio both merge protected settlement status", () => {
  const server = read("lib/business-lifecycle-server.js");
  const portfolio = read("lib/business-portfolio-server.js");
  assert.match(server, /businessSettlementAccounts/);
  assert.match(server, /settlementStatus/);
  assert.match(portfolio, /businessSettlementAccounts/);
  assert.match(portfolio, /mergeLifecycleBusinessState/);
});

test("setup-created first location becomes the canonical primary location", () => {
  const setup = read("components/business/setup.js");
  const service = read("lib/firebase-services.js");
  const route = read("app/api/business/branches/route.js");
  assert.match(setup, /makePrimary: true/);
  assert.match(service, /makePrimary: Boolean\(options\.makePrimary\)/);
  assert.match(route, /body\.makePrimary \|\| !currentPrimary/);
  assert.match(route, /primaryBranchId: branchRef\.id/);
  assert.match(route, /primaryLocationId: branchRef\.id/);
});

test("Review is confirmation rather than a required progress unit", () => {
  const lifecycle = read("lib/business-lifecycle.js");
  assert.match(lifecycle, /required: item\.id !== "review"/);
  assert.match(lifecycle, /foundationEstablished/);
  assert.match(lifecycle, /currentBasicsValid/);
  assert.match(lifecycle, /structuralBasicsValid/);
  assert.match(lifecycle, /step\.id === "review"[\s\S]{0,180}requiredBasicsComplete && foundationEstablished/);
});

test("completed foundational onboarding does not collapse back to Stage 2 when a launch item later degrades", () => {
  const lifecycle = read("lib/business-lifecycle.js");
  assert.match(lifecycle, /stage = setup\.foundationEstablished \? "prepare" : "basics"/);
  assert.match(lifecycle, /setup\.structuralBasicsValid/);
  assert.match(lifecycle, /locationCheck/);
  const nav = read("data/business-archetypes.js");
  assert.match(nav, /if \(mode === "prelaunch"\)/);
  assert.match(nav, /label: archetype\.nouns\.catalog/);
});

test("launch submit returns the exact authoritative blockers and lifecycle snapshot on 422", () => {
  const route = read("app/api/business/launch-review/submit/route.js");
  const client = read("lib/api-client.js");
  const launch = read("components/business/launch.js");
  assert.match(route, /blockers, lifecycle: publicLifecycleSnapshot\(lifecycle\)/);
  assert.match(route, /blockers: error\.blockers \|\| \[\], lifecycle: error\.lifecycle \|\| null/);
  assert.match(route, /lifecycle: submittedLifecycle/);
  assert.match(route, /Cache-Control.*no-store/);
  assert.match(client, /error\.payload = payload/);
  assert.match(client, /error\.blockers = payload\.blockers/);
  assert.match(launch, /Launch requirements changed/);
});

test("lifecycle endpoint and Portfolio bypass intermediary caching", () => {
  for (const file of ["app/api/business/lifecycle/route.js", "app/api/business/portfolio/route.js"]) {
    const source = read(file);
    assert.match(source, /dynamic = "force-dynamic"/);
    assert.match(source, /revalidate = 0/);
    assert.match(source, /Cache-Control.*no-store/);
  }
});

test("direct trusted ownerIds access cannot appear in Portfolio but fail selected-business APIs", () => {
  const access = read("lib/access-control-server.js");
  assert.match(access, /ownerIds\.includes\(user\.uid\)/);
  assert.match(access, /role: "business_owner"/);
  assert.match(access, /directOwner: true/);
  const rules = read("firestore.rules");
  const businessBlock = rules.slice(rules.indexOf("match /businesses/{businessId}"), rules.indexOf("match /organizations/{organizationId}"));
  assert.doesNotMatch(businessBlock, /"ownerIds"/);
});

test("launch review submit has a synchronous client lock as well as server duplicate protection", () => {
  const launch = read("components/business/launch.js");
  const submit = read("app/api/business/launch-review/submit/route.js");
  assert.match(launch, /submissionLock = useRef\(false\)/);
  assert.match(launch, /if \(submissionLock\.current \|\| submitting\) return/);
  assert.match(submit, /A final launch review is already active/);
});

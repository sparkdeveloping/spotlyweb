import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { documentRequirementsFor, capabilityRequirements, requirementPlan, validDriverPhone } from "../lib/driver-capabilities.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Driver V8 requirements are vehicle and capability aware", () => {
  assert.deepEqual(documentRequirementsFor({ vehicleType: "bicycle", capabilities: ["prepared_delivery"] }), ["identity"]);
  const rideDocs = documentRequirementsFor({ vehicleType: "car", capabilities: ["ride_passenger"] });
  for (const type of ["identity", "licence", "registration", "insurance", "vehicle_fitness"]) assert.ok(rideDocs.includes(type), `${type} should be required for passenger rides`);
  const unsupported = capabilityRequirements({ capabilityId: "ride_passenger", vehicleType: "bicycle", documents: [], application: {} });
  assert.equal(unsupported.ready, false);
  assert.equal(unsupported.checks[0].ok, false);
});

test("Driver application stores requested capabilities and versionable training modules", async () => {
  const source = await read("app/api/driver/application/route.js");
  assert.match(source, /requestedCapabilities/);
  assert.match(source, /trainingModuleId/);
  assert.match(source, /trainingModules/);
  assert.match(source, /trainingAnswer/);
  assert.match(source, /module\.check\.answer/);
  assert.match(source, /module\.version/);
  assert.match(source, /body\.vehicle\.type\s*!==\s*"bicycle"/);
});

test("Driver bootstrap returns capabilities, account health and GPS dispatchability", async () => {
  const source = await read("app/api/driver/bootstrap/route.js");
  assert.match(source, /capabilitySummary/);
  assert.match(source, /accountHealth/);
  assert.match(source, /locationHealth/);
  assert.match(source, /dispatchable/);
});

test("all work acceptance paths re-check authoritative Driver eligibility", async () => {
  const [delivery, ride, send] = await Promise.all([
    read("app/api/driver/offers/route.js"),
    read("app/api/driver/ride-offers/route.js"),
    read("app/api/driver/parcel-offers/route.js"),
  ]);
  for (const source of [delivery, ride, send]) {
    assert.match(source, /operationalEligibility/);
    assert.match(source, /driverDocuments/);
    assert.match(source, /driverApplications/);
  }
  assert.match(ride, /ride_passenger/);
  assert.match(send, /capability:\s*"send"/);
  assert.match(delivery, /workCapability/);
});

test("merchant delivery dispatch limits pickup distance and estimates total work", async () => {
  const source = await read("lib/driver-delivery-server.js");
  assert.match(source, /driverDeliveryMaxPickupKm/);
  assert.match(source, /maxPickupKm/);
  assert.match(source, /continue/);
  assert.match(source, /shoppingMinutes/);
  assert.match(source, /workDistanceKm/);
  assert.match(source, /expectedMinutes/);
});

test("Shop & Deliver enforces no-substitution orders and requires merchant checkout authorization", async () => {
  const [shopping, kiosk, driver] = await Promise.all([
    read("app/api/driver/shopping/route.js"),
    read("app/api/kiosk/driver-pickup/route.js"),
    read("components/driver-app.js"),
  ]);
  assert.match(shopping, /no_substitutions/);
  assert.match(shopping, /checkoutAuthorizedAt/);
  assert.match(kiosk, /checkoutAuthorization/);
  assert.match(kiosk, /shopping_review/);
  assert.match(driver, /STORE CHECKOUT AUTHORIZATION/);
  assert.match(driver, /No substitutions are allowed for this item/);
});

test("Driver lifecycle states no longer fall through to the application wizard", async () => {
  const source = await read("components/driver-app.js");
  assert.match(source, /function DriverLifecycleState/);
  for (const state of ["suspended", "offboarded", "former", "offboarding", "temporarily_unavailable"]) assert.match(source, new RegExp(state));
  assert.match(source, /status === "rejected"/);
});

test("Driver V8 exposes field health, work type, offer expiry, safety and multi-currency money", async () => {
  const source = await read("components/driver-app.js");
  assert.match(source, /Location good|Location weak|Location lost|GPS/);
  assert.match(source, /OfferCountdown/);
  assert.match(source, /Shop & Deliver/);
  assert.match(source, /Safety toolkit/);
  assert.match(source, /parcel_earned/);
  assert.match(source, /ZWG/);
  assert.doesNotMatch(source, /parcel\.recipientPhone|parcel\.senderPhone/);
});

test("active work exceptions create operational records rather than only free-text support", async () => {
  const source = await read("app/api/driver/work-exceptions/route.js");
  assert.match(source, /driverIncidents/);
  assert.match(source, /adminQueueItems/);
  assert.match(source, /merchant_not_ready/);
  assert.match(source, /rider_not_here/);
  assert.match(source, /recipient_unavailable/);
  assert.match(source, /safetyHold/);
  assert.match(source, /WAIT_SECONDS/);
  assert.match(source, /resolutionEligibleAt/);
});

test("Admin Driver Operations has a live network map and exact active-work drilldown", async () => {
  const [api, ui] = await Promise.all([
    read("app/api/admin/driver-network/route.js"),
    read("components/admin-driver-operations.js"),
  ]);
  assert.match(api, /driverPresence/);
  assert.match(api, /rideTrips/);
  assert.match(api, /deliveryJobs/);
  assert.match(api, /parcelJobs/);
  assert.match(api, /safetyAttention/);
  assert.match(ui, /Live Driver network/);
  assert.match(ui, /openstreetmap\.org\/export\/embed/);
  assert.match(ui, /openWork/);
  assert.match(ui, /Rides/);
  assert.match(ui, /Deliveries/);
  assert.match(ui, /Send/);
});

test("Admin cannot activate a Driver capability without current requirements", async () => {
  const source = await read("app/api/admin/drivers/route.js");
  const start = source.indexOf('} else if (body.action === "set_capability")');
  const block = source.slice(start, start + 7000);
  assert.match(block, /capabilityRequirements/);
  assert.match(block, /if \(!readiness\.ready\)/);
  assert.match(block, /driverVehicles/);
  assert.match(block, /driverDocuments/);
});

test("public Driver acquisition includes a personalized eligibility planner and no fake shift promise", async () => {
  const [page, marketing, planner, portals] = await Promise.all([
    read("app/drive/page.js"),
    read("components/driver/driver-marketing.js"),
    read("components/driver/eligibility-planner.js"),
    read("data/portals.js"),
  ]);
  assert.match(page, /DriverMarketingPage/);
  assert.match(marketing, /DriverEligibilityPlanner/);
  assert.match(marketing, /Check before creating an account/);
  assert.match(planner, /City/);
  assert.match(planner, /vehicle/);
  assert.match(planner, /documentRequirementsFor/);
  assert.match(planner, /trainingRequirementsFor/);
  assert.match(planner, /entryHref/);
  const driverStart = portals.indexOf('id: "driver"');
  const driverBlock = portals.slice(driverStart, driverStart + 2200);
  assert.doesNotMatch(driverBlock, /shifts/i);
});

test("Shop & Deliver contact-me substitutions require customer approval before basket review", async () => {
  const [shopping, customerDecision, customerStatus, marketplace] = await Promise.all([
    read("app/api/driver/shopping/route.js"),
    read("app/api/customer/orders/substitution/route.js"),
    read("app/api/orders/delivery-status/route.js"),
    read("components/marketplace-app.js"),
  ]);
  assert.match(shopping, /substitution_pending/);
  assert.match(shopping, /customerApprovalRequired/);
  assert.match(shopping, /waiting for the customer/i);
  assert.match(customerDecision, /decision:\s*z\.enum\(\["approve",\s*"reject"\]\)/);
  assert.match(customerDecision, /maxAuthorized/);
  assert.match(customerDecision, /shopping\.substitution\.approved/);
  assert.match(customerStatus, /pendingSubstitutions/);
  assert.match(marketplace, /Approve replacement/);
  assert.match(marketplace, /No, remove item/);
});

test("Driver online session can restrict dispatch to the work types the Driver enabled", async () => {
  const [presence, eligibility, driver] = await Promise.all([
    read("app/api/driver/presence/route.js"),
    read("lib/driver-delivery-server.js"),
    read("components/driver-app.js"),
  ]);
  assert.match(presence, /enabledCapabilities/);
  assert.match(presence, /selectedVehicleId/);
  assert.match(eligibility, /presence\.enabledCapabilities/);
  assert.match(eligibility, /enabled for this session/);
  assert.match(driver, /enabledCapabilities/);
  assert.match(driver, /Work I.m accepting/i);
});

test("Admin Driver network exposes activation, expiry and first-week operating queues", async () => {
  const [api, ui] = await Promise.all([
    read("app/api/admin/driver-network/route.js"),
    read("components/admin-driver-operations.js"),
  ]);
  for (const queue of ["waitingOnDriver", "waitingOnSpotly", "readyForActivation", "capabilityActivation", "expiringDocuments", "firstWeekDrivers"]) assert.match(api, new RegExp(queue));
  assert.match(api, /capabilityRequirements/);
  assert.match(api, /30 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(ui, /Activation & compliance queues/);
  assert.match(ui, /Waiting on Driver/);
  assert.match(ui, /Ready to activate/);
  assert.match(ui, /Documents expiring/);
});

test("Driver safety toolkit keeps urgent support, trusted contact and current-location sharing in the field surface", async () => {
  const driver = await read("components/driver-app.js");
  assert.match(driver, /Alert Spotly urgently/);
  assert.match(driver, /Share current job & location/);
  assert.match(driver, /emergencyContactPhone/);
  assert.match(driver, /tel:\$\{cityEmergency\}/);
  assert.match(driver, /does not replace police, ambulance or fire services/i);
});

test("dispatch honors the Driver's selected approved session vehicle across every work type", async () => {
  const [delivery, ride, send] = await Promise.all([
    read("lib/driver-delivery-server.js"),
    read("lib/ride-server.js"),
    read("lib/parcel-server.js"),
  ]);
  for (const source of [delivery, ride, send]) {
    assert.match(source, /item\.id === presence\.vehicleId && item\.status === "approved"/);
  }
});

test("active Drivers can renew operational details without being reset into onboarding", async () => {
  const application = await read("app/api/driver/application/route.js");
  assert.match(application, /activeLifecycle/);
  assert.match(application, /activeRenewal/);
  assert.match(application, /queue: "driver-documents"/);
  assert.match(application, /queue: "driver-vehicles"/);
  assert.match(application, /auth_time/);
  assert.match(application, /changing a verified payout account/);
});

test("precise live Driver network access is limited to operational roles", async () => {
  const [network, access] = await Promise.all([
    read("app/api/admin/driver-network/route.js"),
    read("lib/admin-access.js"),
  ]);
  const roleLine = network.match(/const ADMIN_ROLES = \[[^\n]+/s)?.[0] || "";
  assert.doesNotMatch(roleLine, /finance_admin/);
  assert.doesNotMatch(roleLine, /analytics_viewer/);
  assert.match(roleLine, /driver_operations_coordinator/);
  const financeLine = access.match(/finance_admin:\s*\[[^\]]+\]/)?.[0] || "";
  const analyticsLine = access.match(/analytics_viewer:\s*\[[^\]]+\]/)?.[0] || "";
  assert.doesNotMatch(financeLine, /mobility/);
  assert.doesNotMatch(analyticsLine, /mobility/);
});

test("Driver root sells the Driver product before asking a brand-new applicant to sign in", async () => {
  const [auth, marketing, page] = await Promise.all([
    read("components/auth-gate.js"),
    read("components/driver/driver-marketing.js"),
    read("app/driver/page.js"),
  ]);
  assert.match(auth, /DriverMarketingPage/);
  assert.match(auth, /portal === "driver" && isDriverLanding/);
  assert.match(marketing, /Move Zimbabwe\. Earn on work that fits you\./);
  assert.match(marketing, /Start my Driver application/);
  assert.match(marketing, /Ways to earn/);
  assert.match(marketing, /From curious to active/);
  assert.match(marketing, /DriverEligibilityPlanner/);
  assert.match(marketing, /Sample offer · illustrative/);
  assert.match(page, /robots: \{ index: true, follow: true \}/);
  assert.match(page, /driver\.spotlyafrica\.com/);
});

test("zero-to-active onboarding can save identity before vehicle setup and collects full motor vehicle details", async () => {
  const [api, ui] = await Promise.all([
    read("app/api/driver/application/route.js"),
    read("components/driver-app.js"),
  ]);
  assert.match(api, /currentStep >= 2/);
  assert.match(ui, /if \(nextStep >= 2\) payload\.vehicle/);
  assert.match(ui, /Ownership/);
  assert.match(ui, /Registration/);
  assert.match(ui, /Year/);
  assert.match(ui, /Make/);
  assert.match(ui, /Model/);
  assert.match(ui, /Driver licence/);
  assert.match(api, /Add the motor vehicle make and model/);
});

test("additional vehicle setup is a staged evidence workflow, not a one-click record creator", async () => {
  const [api, ui] = await Promise.all([
    read("app/api/driver/application/route.js"),
    read("components/driver-app.js"),
  ]);
  assert.match(ui, /function AdditionalVehicleSetup/);
  assert.match(ui, /Continue to required evidence/);
  assert.match(ui, /Send complete vehicle for review/);
  assert.match(ui, /requestedCapabilities/);
  assert.match(api, /action:\s*z\.enum\(\["save", "submit", "vehicle", "vehicle_submit"/);
  assert.match(api, /status: "setup_required"/);
  assert.match(api, /documentRequirementsFor/);
  assert.match(api, /queue: "driver-vehicles"/);
});

test("vehicle-specific documents are scoped to the exact vehicle throughout readiness and Admin approval", async () => {
  const [capabilities, application, admin] = await Promise.all([
    read("lib/driver-capabilities.js"),
    read("app/api/driver/application/route.js"),
    read("app/api/admin/drivers/route.js"),
  ]);
  assert.match(capabilities, /VEHICLE_SCOPED_DOCUMENTS/);
  assert.match(capabilities, /item\.vehicleId === vehicleId/);
  assert.match(application, /vehicleId: inferredVehicleId/);
  assert.match(admin, /item\.vehicleId === vehicle\.id/);
  assert.match(admin, /Approve the required vehicle evidence first/);
});

test("Admin visibly exposes submitted vehicles and Driver review queues", async () => {
  const [detail, network, inbox, queues] = await Promise.all([
    read("components/admin-driver-operations.js"),
    read("app/api/admin/driver-network/route.js"),
    read("components/admin-work-inbox.js"),
    read("app/api/admin/queues/route.js"),
  ]);
  assert.match(detail, /const vehicles = data\.vehicles \|\| \[\]/);
  assert.doesNotMatch(detail, /const vehicle = data\.vehicles\?\.\[0\]/);
  assert.match(detail, /Vehicle reviews/);
  assert.match(detail, /request_vehicle_setup/);
  assert.match(detail, /reject_vehicle/);
  assert.match(network, /vehicleReviews/);
  assert.match(network, /adminQueueItems/);
  assert.match(inbox, /"driver-vehicles"/);
  assert.match(inbox, /\/mobility\?driver=/);
  assert.match(queues, /"driver-applications"/);
  assert.match(queues, /"driver-documents"/);
  assert.match(queues, /"driver-vehicles"/);
});

test("new vehicle work types merge into active Driver training rather than becoming an unfinishable Admin-only state", async () => {
  const [api, ui] = await Promise.all([
    read("app/api/driver/application/route.js"),
    read("components/driver-app.js"),
  ]);
  assert.match(api, /mergedRequestedCapabilities/);
  assert.match(api, /requestedCapabilities: mergedRequestedCapabilities/);
  assert.match(ui, /function ActiveDriverTraining/);
  assert.match(ui, /When you add a vehicle or request a new kind of work/);
});

test("Driver readiness validates saved Zimbabwe contacts and authoritative payout evidence", () => {
  const vehicle = { id: "test_primary", type: "car", registration: "ABC 123", make: "Toyota", model: "Corolla" };
  const application = { legalName: "Full Driver", phone: "+263", city: "Harare", emergencyContactName: "", emergencyContactPhone: "",
    requestedCapabilities: ["ride_passenger"], payoutComplete: true, agreementsAccepted: true, locationConsent: true, trainingModules: {} };
  const docs = ["identity", "licence", "registration", "insurance", "vehicle_fitness"].map((type) =>
    ({ type, vehicleId: ["registration", "insurance", "vehicle_fitness"].includes(type) ? "test_primary" : null, status: "uploaded" }));
  const missing = requirementPlan({ application, vehicle, documents: docs, payoutAccount: null });
  assert.equal(missing.complete, false);
  for (const id of ["phone", "emergency_contact", "emergency_phone", "payout", "training_general_safety"]) {
    assert.equal(missing.checks.find((item) => item.id === id)?.ok, false, id);
  }
  assert.equal(validDriverPhone("+263"), false);
  assert.equal(validDriverPhone("0771234567"), true);
  assert.equal(validDriverPhone("+263771234567"), true);
  assert.equal(validDriverPhone("077"), false);
  application.phone = "+263771234567";
  application.emergencyContactName = "Emergency Contact";
  application.emergencyContactPhone = "0771234567";
  const payoutAccount = { type: "mobile_money", provider: "EcoCash", recipientName: "Full Driver", maskedIdentifier: "•••• 4567", verificationState: "pending" };
  const pending = requirementPlan({ application, vehicle, documents: docs, payoutAccount });
  assert.equal(pending.checks.find((item) => item.id === "payout")?.ok, true, "pending payout verification permits application review");
  assert.equal(pending.checks.find((item) => item.id === "document_insurance")?.ok, true, "uploaded insurance permits application review");
  assert.equal(pending.complete, false, "training must still be complete");
  assert.equal(requirementPlan({ application: { ...application, requestedCapabilities: [] }, vehicle, documents: docs, payoutAccount }).checks.find((item) => item.id === "work")?.ok, false);
  assert.equal(requirementPlan({ application, vehicle, documents: docs.map((item) => item.type === "insurance" ? { ...item, status: "rejected" } : item), payoutAccount }).checks.find((item) => item.id === "document_insurance")?.ok, false);
});

test("Driver submit returns blockers, never follows failed saves and retains lifecycle progression", async () => {
  const [api, ui, bootstrap] = await Promise.all([
    read("app/api/driver/application/route.js"), read("components/driver-app.js"), read("app/api/driver/bootstrap/route.js")
  ]);
  assert.match(api, /blockers: error\.blockers\.map/);
  assert.match(api, /db\.batch\(\)/);
  assert.match(api, /if \(!existingSnap\.exists\)/);
  assert.match(api, /\["application_submitted", "under_review"/);
  assert.doesNotMatch(api, /status: activeLifecycle \? currentStatus : "application_started"/);
  assert.match(ui, /if \(!\(await saveStep\(5\)\)\) return/);
  assert.match(ui, /What still needs attention/);
  assert.match(ui, /setSubmitBlockers\(err\.blockers\)/);
  assert.doesNotMatch(ui, /setStep\(Math\.min\(Number\(data\?\.application\?\.currentStep/);
  assert.match(bootstrap, /const primaryVehicle = vehicles\.find/);
  assert.match(bootstrap, /payoutAccount, phase/);
});

test("Admin cannot approve an unsubmitted Driver or bypass payout verification", async () => {
  const [admin, delivery, application] = await Promise.all([
    read("app/api/admin/drivers/route.js"),
    read("lib/driver-delivery-server.js"),
    read("app/api/driver/application/route.js")
  ]);
  assert.match(admin, /\["application_submitted", "under_review"\]\.includes\(app\.status\)/);
  assert.match(admin, /payoutAccountSnap\.data\(\)\?\.verificationState !== "verified"/);
  assert.match(admin, /applicationReadiness\(app, vehicle, documents, payoutAccountSnap\.data\(\)\)/);
  assert.match(admin, /payoutVerificationState: "verified"/);
  assert.match(admin, /Verify the Driver payout destination before activating this work type/);
  assert.match(delivery, /verified_payout/);
  assert.match(delivery, /driver\.payoutVerificationState === "verified"/);
  assert.match(application, /payoutBatch\.set\(driverRef, \{ payoutVerificationState: "pending"/);
  assert.match(admin, /payoutBatch\.set\(driverRef, \{ payoutVerificationState: nextPayoutState/);
});

test("Driver workspace delays transient missing-session errors and scrolls application errors into view", async () => {
  const driver = await read("components/driver-app.js");
  assert.match(driver, /attempt < 3/);
  assert.match(driver, /err\.message !== "Sign in to continue\."/);
  assert.match(driver, /errorRef\.current\?\.scrollIntoView/);
  assert.match(driver, /ref=\{errorRef\} role="alert"/);
});

test("Ride booking scrolls quote and validation errors into view", async () => {
  const ride = await read("components/ride-app.js");
  assert.match(ride, /bookingErrorRef\.current\?\.scrollIntoView/);
  assert.match(ride, /ref=\{bookingErrorRef\} role="alert"/);
});

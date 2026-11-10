import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const driverRoot = "../../../driver/spotlydriver/spotlydriver";
const readDriver = (path) => readFile(new URL(`${driverRoot}/${path}`, import.meta.url), "utf8");

test("Phase 15 Driver iOS boots Firebase with Auth, Firestore, Functions, RTDB, Storage, Messaging and App Check", async () => {
  const [project, bootstrap, platform, push] = await Promise.all([
    readDriver("../spotlydriver.xcodeproj/project.pbxproj"),
    readDriver("Core/Platform/DriverFirebaseBootstrap.swift"),
    readDriver("Core/Platform/DriverFirebasePlatform.swift"),
    readDriver("Core/Platform/DriverPushCoordinator.swift")
  ]);
  for (const product of ["FirebaseCore", "FirebaseAuth", "FirebaseFunctions", "FirebaseDatabase", "FirebaseFirestore", "FirebaseStorage", "FirebaseMessaging", "FirebaseAppCheck"]) assert.match(project, new RegExp(product));
  assert.match(bootstrap, /AppCheckDebugProviderFactory/);
  assert.match(bootstrap, /AppAttestProviderFactory/);
  assert.match(platform, /Auth\.auth\(\)/);
  assert.match(platform, /Functions\.functions/);
  assert.match(platform, /Storage\.storage/);
  assert.match(push, /MessagingDelegate/);
});

test("Phase 15 removes DriverMockData as application state and uses authenticated bootstrap", async () => {
  await assert.rejects(access(new URL(`${driverRoot}/Core/MockData/DriverMockData.swift`, import.meta.url)));
  const [state, welcome, signIn, onboarding] = await Promise.all([
    readDriver("Core/Services/DriverAppState.swift"),
    readDriver("Features/Entry/DriverWelcomeView.swift"),
    readDriver("Features/Entry/DriverSignInView.swift"),
    readDriver("Features/Verification/DriverOnboardingView.swift")
  ]);
  assert.match(state, /DriverFirebasePlatform\.driverBootstrap/);
  assert.doesNotMatch(state, /DriverMockData/);
  assert.doesNotMatch(welcome, /Continue as Demo/i);
  assert.match(signIn, /signIn\(email:/);
  assert.match(onboarding, /uploadDriverDocument/);
  assert.match(onboarding, /submitOnboardingApplication/);
});

test("Phase 16 publishes Driver presence and active-trip location through RTDB", async () => {
  const location = await readDriver("Core/Platform/DriverLocationService.swift");
  assert.match(location, /driverPresence\/\\\(uid\)/);
  assert.match(location, /dispatchPresence\/\\\(country\)\/\\\(area\)\/\\\(uid\)/);
  assert.match(location, /activeTrips\/\\\(workID\)\/driverLocation/);
  assert.match(location, /allowsBackgroundLocationUpdates = mode == \.activeWork/);
  assert.match(location, /onDisconnectRemoveValue/);
});

test("trusted Driver callables enforce dispatch acceptance, expiry, PINs and active work restoration", async () => {
  const [runtime, index] = await Promise.all([
    read("firebase/functions/src/core/driver-runtime.js"),
    read("firebase/functions/src/index.js")
  ]);
  assert.match(runtime, /runTransaction/);
  assert.match(runtime, /deadline-exceeded/);
  assert.match(runtime, /noActiveWork/);
  assert.match(runtime, /runtimeAccess\/activeTrips/);
  assert.match(runtime, /SPOTLY_RIDE_PIN_KEY/);
  assert.match(runtime, /SPOTLY_SEND_PIN_KEY/);
  assert.match(index, /driverOfferAction = defineTrustedMutation/);
  assert.match(index, /driverWorkAction = defineTrustedMutation/);
  assert.match(index, /secrets: \[DRIVER_RIDE_PIN_KEY, DRIVER_SEND_PIN_KEY\]/);
});

test("dispatch migration bridge reads RTDB presence without dropping the existing Firestore fleet", async () => {
  const [bridge, delivery, ride, send] = await Promise.all([
    read("lib/driver-realtime-presence.js"),
    read("lib/driver-delivery-server.js"),
    read("lib/ride-server.js"),
    read("lib/parcel-server.js")
  ]);
  assert.match(bridge, /driverPresence/);
  assert.match(bridge, /database/);
  for (const source of [delivery, ride, send]) assert.match(source, /loadDispatchPresence/);
});

test("RTDB rules require server-granted Driver eligibility and scoped dispatch access", async () => {
  const rules = await read("database.rules.json");
  assert.match(rules, /runtimeAccess\/driverEligible/);
  assert.match(rules, /runtimeAccess\/driverDispatchScope/);
  assert.match(rules, /runtimeAccess\/activeTrips/);
});

test("Driver incidents and notifications are restored from the server", async () => {
  const [runtime, mapper, state] = await Promise.all([
    read("firebase/functions/src/core/driver-runtime.js"),
    readDriver("Core/Platform/DriverRemoteMapper.swift"),
    readDriver("Core/Services/DriverAppState.swift")
  ]);
  assert.match(runtime, /driverIncidents/);
  assert.match(runtime, /incidents,/);
  assert.match(mapper, /static func incidents/);
  assert.match(state, /DriverRemoteMapper\.incidents/);
});

test("Debug and Release push entitlements are separated", async () => {
  const [project, debugEntitlements, releaseEntitlements] = await Promise.all([
    readDriver("../spotlydriver.xcodeproj/project.pbxproj"),
    readDriver("spotlydriver.entitlements"),
    readDriver("spotlydriver.release.entitlements")
  ]);
  assert.match(project, /spotlydriver\.release\.entitlements/);
  assert.match(debugEntitlements, /development/);
  assert.match(releaseEntitlements, /production/);
});

test("trusted Driver eligibility preserves safety, compliance, payout, capability, vehicle and document gates", async () => {
  const runtime = await read("firebase/functions/src/core/driver-runtime.js");
  for (const token of ["safetyHold", "complianceHold", "payoutVerificationState", "ride_passenger", "send", "prepared_delivery", "shop_and_deliver", "vehicle_fitness", "expiresAt"]) {
    assert.match(runtime, new RegExp(token));
  }
  assert.match(runtime, /requiredVehicleTypes/);
  assert.match(runtime, /approvedDriverDocument/);
  assert.match(runtime, /evaluateDriverEligibility/);
  assert.match(runtime, /Your active work restores automatically/);
});

test("required delivery proof is a real Driver Storage upload and trusted completion gate", async () => {
  const [runtime, index, platform, flow, storageRules] = await Promise.all([
    read("firebase/functions/src/core/driver-runtime.js"),
    read("firebase/functions/src/index.js"),
    readDriver("Core/Platform/DriverFirebasePlatform.swift"),
    readDriver("Features/ActiveJob/OperationalFlowViews.swift"),
    read("storage.rules")
  ]);
  assert.match(runtime, /validateDriverProofUrl/);
  assert.match(runtime, /proofPhotoRequired === true/);
  assert.match(runtime, /registerDriverWorkProof/);
  assert.match(index, /driverWorkProofRegister = defineTrustedMutation/);
  assert.match(platform, /uploadWorkProof\(data:/);
  assert.match(platform, /driver-send-proof/);
  assert.match(platform, /driver-delivery-proof/);
  assert.match(flow, /PhotosPicker/);
  assert.match(flow, /ProofOfDeliveryView/);
  assert.match(storageRules, /driver-delivery-proof/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), "utf8");

test("self-registration cannot seed platform permissions", () => {
  const rules = read("firestore.rules");
  assert.match(rules, /roles == \["customer"\]/);
  assert.match(rules, /!\("customPermissions" in request\.resource\.data\)/);
  assert.match(rules, /request\.resource\.data\.status == "active"/);
});

test("authoritative platform configuration is private and customer runtime is sanitized", () => {
  const rules = read("firestore.rules");
  const provider = read("components/firebase-provider.js");
  const sanitizer = read("lib/public-platform-settings.js");
  assert.match(rules, /match \/platformSettings\/\{id\}[\s\S]*allow read: if platformAdmin\(\) \|\| hasPermission\("admin\.configuration"\)[\s\S]*allow create, update, delete: if false;/);
  assert.match(provider, /\/api\/public\/runtime/);
  assert.match(provider, /\/api\/admin\/settings/);
  assert.doesNotMatch(provider, /subscribePlatformSettings/);
  assert.doesNotMatch(sanitizer, /source\.security/);
  assert.doesNotMatch(sanitizer, /source\.verification/);
  assert.doesNotMatch(sanitizer, /source\.integrations/);
});

test("App Check uses an explicit monitored rollout for web APIs and stays fail-closed for trusted callables", () => {
  const admin = read("lib/firebase-admin.js");
  const firebase = read("lib/firebase.js");
  const callable = read("firebase/functions/src/core/callable.js");
  const functionsIndex = read("firebase/functions/src/index.js");
  assert.match(admin, /return process\.env\.SPOTLY_ENFORCE_APP_CHECK === "true"/);
  assert.doesNotMatch(admin, /NODE_ENV === "production"/);
  assert.ok(firebase.indexOf("globalThis.__spotlyAppCheck = initializeAppCheck") < firebase.indexOf("const auth = getAuth"));
  assert.match(firebase, /Spotly App Check could not obtain an attestation token/);
  assert.match(callable, /defineTrustedMutation[\s\S]*enforceAppCheck: true/);
  assert.equal((functionsIndex.match(/enforceAppCheck:\s*false/g) || []).length, 1);
});

test("distributed API and callable rate limits are server-authoritative", () => {
  const admin = read("lib/firebase-admin.js");
  const publicLimiter = read("lib/rate-limit-server.js");
  const callableLimiter = read("firebase/functions/src/core/security.js");
  const rules = read("firestore.rules");
  assert.match(admin, /securityRateLimits/);
  assert.match(publicLimiter, /runTransaction/);
  assert.match(callableLimiter, /securityRateLimits/);
  assert.match(callableLimiter, /runTransaction/);
  assert.match(rules, /match \/securityRateLimits\/\{limitId\} \{ allow read, write: if false; \}/);
});

test("RTDB Driver location rejects stale/future writes and has explicit retention", () => {
  const rules = read("database.rules.json");
  const retention = read("firebase/functions/src/core/retention.js");
  const index = read("firebase/functions/src/index.js");
  assert.match(rules, /now \+ 60000/);
  assert.match(rules, /now - 600000/);
  assert.match(rules, /now - 300000/);
  assert.match(retention, /presenceLocationMs: 30 \* 60_000/);
  assert.match(retention, /activeTripMs: 24 \* 60 \* 60_000/);
  assert.match(index, /driverLocationRetentionSweep/);
});

test("Driver app clears location when tracking stops or disconnects", () => {
  const source = read("../../driver/spotlydriver/spotlydriver/Core/Platform/DriverLocationService.swift");
  assert.match(source, /driverPresence\/\\\(uid\)\/location"\)\.removeValue/);
  assert.match(source, /driverPresence\/\\\(uid\)\/location"\)\.onDisconnectRemoveValue/);
  assert.match(source, /dispatchPresence\/\\\(country\)\/\\\(area\)\/\\\(uid\).*removeValue/);
});

test("Crashlytics and Performance ship in both native apps with privacy declarations", () => {
  for (const [project, manifest] of [
    ["../../ios/spotly/spotly.xcodeproj/project.pbxproj", "../../ios/spotly/spotly/PrivacyInfo.xcprivacy"],
    ["../../driver/spotlydriver/spotlydriver.xcodeproj/project.pbxproj", "../../driver/spotlydriver/spotlydriver/PrivacyInfo.xcprivacy"]
  ]) {
    const p = read(project), m = read(manifest);
    assert.match(p, /FirebaseCrashlytics/);
    assert.match(p, /FirebasePerformance/);
    assert.match(p, /Upload Crashlytics Symbols/);
    assert.match(m, /NSPrivacyCollectedDataTypeCrashData/);
    assert.match(m, /NSPrivacyCollectedDataTypePerformanceData/);
  }
});

test("web Firebase Performance is production-gated", () => {
  const firebase = read("lib/firebase.js");
  assert.match(firebase, /getPerformance/);
  assert.match(firebase, /NEXT_PUBLIC_FIREBASE_PERFORMANCE_ENABLED/);
  assert.match(firebase, /instrumentationEnabled = enabled/);
  assert.match(firebase, /dataCollectionEnabled = enabled/);
});

test("trusted Driver mutations write durable audit records", () => {
  const runtime = read("firebase/functions/src/core/driver-runtime.js");
  assert.match(runtime, /writeFunctionAudit/);
  assert.match(runtime, /driver\.application_submitted/);
  assert.match(runtime, /driver\.presence_/);
  assert.match(runtime, /offer_accepted/);
  assert.match(runtime, /driver\.incident_reported/);
});

test("security retention preserves a bounded audit trail while clearing expired rate-limit data", () => {
  const retention = read("firebase/functions/src/core/retention.js");
  assert.match(retention, /auditRetentionDays/);
  assert.match(retention, /securityRateLimits/);
  assert.match(retention, /rateLimits/);
  assert.match(retention, /auditLogs/);
  assert.match(retention, /Math\.min\(Math\.max/);
});

test("ownership-changing browser writes are blocked by Firestore rules", () => {
  const rules = read("firestore.rules");
  assert.match(rules, /request\.resource\.data\.businessId == resource\.data\.businessId/);
  assert.match(rules, /request\.resource\.data\.userId == request\.auth\.uid/);
  assert.match(rules, /request\.resource\.data\.scope == resource\.data\.scope/);
});

test("Admin diagnostics exposes real reliability and abuse signals", () => {
  const route = read("app/api/admin/operations-health/route.js");
  const ui = read("components/platform-map.js");
  assert.match(route, /staleDriverPresence/);
  assert.match(route, /unresolvedDriverIncidents/);
  assert.match(route, /paymentExceptions/);
  assert.match(route, /recentRatePressure/);
  assert.match(route, /recentAuditEvents/);
  assert.match(ui, /Reliability & security health/);
  assert.match(ui, /operations-health/);
});

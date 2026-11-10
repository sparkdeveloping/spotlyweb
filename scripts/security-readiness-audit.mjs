import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), "utf8");
const checks = [];
function check(name, condition, detail = "") { checks.push({ name, ok: Boolean(condition), detail }); }

const firestore = read("firestore.rules");
const database = read("database.rules.json");
const storage = read("storage.rules");
const admin = read("lib/firebase-admin.js");
const apiClient = read("lib/api-client.js");
const provider = read("components/firebase-provider.js");
const platformPublic = read("lib/public-platform-settings.js");
const functionsIndex = read("firebase/functions/src/index.js");
const callable = read("firebase/functions/src/core/callable.js");
const retention = read("firebase/functions/src/core/retention.js");
const security = read("firebase/functions/src/core/security.js");
const customerProject = read("../../ios/spotly/spotly.xcodeproj/project.pbxproj");
const driverProject = read("../../driver/spotlydriver/spotlydriver.xcodeproj/project.pbxproj");
const customerPrivacy = read("../../ios/spotly/spotly/PrivacyInfo.xcprivacy");
const driverPrivacy = read("../../driver/spotlydriver/spotlydriver/PrivacyInfo.xcprivacy");

check("Firestore has a final deny-all rule", /match \/\{document=\*\*\}[\s\S]*allow read, write: if false;/.test(firestore));
check("Self-registration forbids custom permissions", /allow create: if self\(uid\)[\s\S]*!\("customPermissions" in request\.resource\.data\)/.test(firestore));
check("Authoritative platform settings are private and server-mutated", /match \/platformSettings\/\{id\}[\s\S]*allow read: if platformAdmin\(\) \|\| hasPermission\("admin\.configuration"\)[\s\S]*allow create, update, delete: if false;/.test(firestore));
check("Product ownership cannot be transferred by catalogue editors", /allow update: if canEditCatalogue\(resource\.data\.businessId\) && request\.resource\.data\.businessId == resource\.data\.businessId/.test(firestore));
check("Push token ownership is immutable", /match \/pushTokens\/\{tokenId\}[\s\S]*request\.resource\.data\.userId == request\.auth\.uid/.test(firestore));
check("Client telemetry cannot spoof actor email", /match \/clientTelemetry\/\{eventId\}[\s\S]*hasOnly\(\[[\s\S]*"actorId", "createdAt"[\s\S]*\]\)/.test(firestore) && !/clientTelemetry[\s\S]{0,900}actorEmail/.test(firestore));
check("Rate-limit collections are server-only", /match \/rateLimits\/\{limitId\} \{ allow read, write: if false; \}/.test(firestore) && /match \/securityRateLimits\/\{limitId\} \{ allow read, write: if false; \}/.test(firestore));
check("RTDB is deny-by-default with bounded Driver timestamps", /"\.read": false/.test(database) && /"\.write": false/.test(database) && /now - 600000/.test(database) && /now - 300000/.test(database));
check("Storage is deny-by-default and scopes Driver evidence", /match \/driver-applications\/\{uid\}\/documents/.test(storage) && /match \/\{allPaths=\*\*\} \{ allow read, write: if false; \}/.test(storage));
check("Production web APIs default to App Check enforcement", /return process\.env\.NODE_ENV === "production"/.test(admin) && /verifyAppCheckRequest\(request\)/.test(admin) && /X-Firebase-AppCheck/.test(apiClient));
check("Customer runtime reads sanitized settings rather than public Firestore settings", /api\/public\/runtime/.test(provider) && !/subscribePlatformSettings\(/.test(provider) && !/source\.security/.test(platformPublic) && !/source\.verification/.test(platformPublic) && !/source\.integrations/.test(platformPublic));
check("Trusted Firebase mutations enforce App Check and distributed rate limits", /defineTrustedMutation/.test(callable) && /enforceAppCheck: true/.test(callable) && /securityRateLimits/.test(security));
check("Only foundation diagnostics opt out of callable App Check", (functionsIndex.match(/enforceAppCheck:\s*false/g) || []).length === 1 && /platformFoundation[\s\S]*enforceAppCheck:\s*false/.test(functionsIndex));
check("Driver location and security retention sweeps are scheduled", /driverLocationRetentionSweep/.test(functionsIndex) && /securityRetentionSweep/.test(functionsIndex) && /sweepDriverLocationRetention/.test(retention) && /sweepSecurityRetention/.test(retention));
check("Both iOS apps ship Crashlytics and Performance", /FirebaseCrashlytics/.test(customerProject) && /FirebasePerformance/.test(customerProject) && /Upload Crashlytics Symbols/.test(customerProject) && /FirebaseCrashlytics/.test(driverProject) && /FirebasePerformance/.test(driverProject) && /Upload Crashlytics Symbols/.test(driverProject));
check("Both privacy manifests disclose crash and performance diagnostics", /NSPrivacyCollectedDataTypeCrashData/.test(customerPrivacy) && /NSPrivacyCollectedDataTypePerformanceData/.test(customerPrivacy) && /NSPrivacyCollectedDataTypeCrashData/.test(driverPrivacy) && /NSPrivacyCollectedDataTypePerformanceData/.test(driverPrivacy));

const failed = checks.filter((item) => !item.ok);
for (const item of checks) console.log(`${item.ok ? "PASS" : "FAIL"}  ${item.name}${item.detail ? ` — ${item.detail}` : ""}`);
console.log(`\n${checks.length - failed.length}/${checks.length} Phase 21 security readiness checks passed.`);
if (failed.length) process.exitCode = 1;

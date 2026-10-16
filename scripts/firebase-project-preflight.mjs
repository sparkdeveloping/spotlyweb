import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const expected = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "AIzaSyB4RFSXLk4YAR2babx5z3ssP0E4msQ-rPE",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "spotly-africa.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "spotly-africa",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "spotly-africa.firebasestorage.app",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "14197555543",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:14197555543:web:189486e7d4a23114c3be12",
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: "G-4FPTS9GNG9"
};

function parseEnvFile(file) {
  const result = {};
  if (!fs.existsSync(file)) return result;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

const fileEnv = {
  ...parseEnvFile(path.join(root, ".env")),
  ...parseEnvFile(path.join(root, ".env.local"))
};
const effective = { ...fileEnv, ...process.env };
const failures = [];
const warnings = [];

for (const [key, expectedValue] of Object.entries(expected)) {
  const value = effective[key];
  if (value && value !== expectedValue) {
    failures.push(`${key} points at a different Firebase Web App value. Expected ${expectedValue}.`);
  }
}

const adminProject = effective.FIREBASE_ADMIN_PROJECT_ID;
if (adminProject && adminProject !== expected.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
  failures.push(`FIREBASE_ADMIN_PROJECT_ID=${adminProject} does not match ${expected.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.`);
}

const adminEmail = effective.FIREBASE_ADMIN_CLIENT_EMAIL || "";
const adminKey = effective.FIREBASE_ADMIN_PRIVATE_KEY || "";
if ((adminEmail && !adminKey) || (!adminEmail && adminKey)) {
  failures.push("Firebase Admin service-account configuration is partial; provide both FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY.");
}
if (adminEmail && !adminEmail.endsWith(`@${expected.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.iam.gserviceaccount.com`)) {
  failures.push("FIREBASE_ADMIN_CLIENT_EMAIL belongs to a different Google Cloud/Firebase project.");
}
if (!adminEmail && !effective.GOOGLE_APPLICATION_CREDENTIALS) {
  warnings.push("Firebase Admin credentials are not present. Browser Firebase can initialize, but privileged APIs require a spotly-africa service account at runtime.");
}
if (!effective.NEXT_PUBLIC_FIREBASE_VAPID_KEY) {
  warnings.push("NEXT_PUBLIC_FIREBASE_VAPID_KEY is not configured for spotly-africa; web push token registration will remain unavailable.");
}
if (!effective.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY) {
  warnings.push("NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY is not configured for spotly-africa; App Check cannot be enforced yet.");
}

const sourceChecks = [
  ["lib/firebase-project-config.js", 'SPOTLY_FIREBASE_PROJECT_ID = "spotly-africa"'],
  ["public/firebase-messaging-sw.js", 'projectId: "spotly-africa"'],
  [".firebaserc", '"default": "spotly-africa"']
];
for (const [file, marker] of sourceChecks) {
  const absolute = path.join(root, file);
  if (!fs.existsSync(absolute) || !fs.readFileSync(absolute, "utf8").includes(marker)) {
    failures.push(`${file} is not pinned to the spotly-africa Firebase project.`);
  }
}

const oldIdentityPatterns = [
  "denzeltinashe-spotly.firebaseapp.com",
  "denzeltinashe-spotly.firebasestorage.app",
  '"denzeltinashe-spotly"',
  "815870787939",
  "1:815870787939:web:6154be469fb3f076f5d356",
  "G-M5DE8TVHFL"
];
const scanFiles = [
  "lib/firebase.js",
  "lib/firebase-admin.js",
  "lib/firebase-project-config.js",
  "public/firebase-messaging-sw.js",
  "scripts/seed-firestore.mjs",
  ".env.example",
  ".firebaserc"
];
for (const file of scanFiles) {
  const absolute = path.join(root, file);
  if (!fs.existsSync(absolute)) continue;
  const source = fs.readFileSync(absolute, "utf8");
  for (const pattern of oldIdentityPatterns) {
    if (source.includes(pattern)) failures.push(`${file} still contains legacy Firebase identity ${pattern}.`);
  }
}

if (failures.length) {
  console.error(`Firebase project preflight failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Firebase project preflight passed for ${expected.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.`);
for (const warning of warnings) console.warn(`Warning: ${warning}`);

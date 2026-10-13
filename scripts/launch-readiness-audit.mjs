import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const notes = [];
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));

function fail(message) { failures.push(message); }
function requireText(file, text, message = `${file} must contain ${text}`) {
  if (!exists(file) || !read(file).includes(text)) fail(message);
}

const routeFiles = [];
function walk(dir) {
  if (!exists(dir)) return;
  for (const name of fs.readdirSync(path.join(root, dir))) {
    const rel = path.join(dir, name);
    const stat = fs.statSync(path.join(root, rel));
    if (stat.isDirectory()) walk(rel);
    else if (name === "route.js") routeFiles.push(rel.replaceAll("\\", "/"));
  }
}
walk("app/api");

for (const file of routeFiles) {
  const source = read(file);
  if (/^app\/api\/(admin|business|customer|driver|staff)\//.test(file) && !source.includes("authenticateRequest")) {
    fail(`${file} is privileged but does not call authenticateRequest`);
  }
  if (file.startsWith("app/api/internal/") && !source.includes("CRON_SECRET")) {
    fail(`${file} is internal but does not verify CRON_SECRET`);
  }
  if (file.startsWith("app/api/public/") && !source.includes("enforceRateLimit")) {
    fail(`${file} is public but has no distributed rate limit`);
  }
  if (file.startsWith("app/api/public/") && !source.includes("verifyAppCheckRequest")) {
    fail(`${file} is public but does not participate in App Check enforcement`);
  }
}

requireText("app/api/lead/route.js", "enforceRateLimit", "Public lead intake must be rate limited");
requireText("app/api/lead/route.js", "verifyAppCheckRequest", "Public lead intake must participate in App Check enforcement");
requireText("app/api/payments/paynow/result/route.js", "parseStatusUpdate", "Paynow webhook must parse and validate signed provider status updates");
requireText("app/api/payments/paynow/result/route.js", "pollTransaction", "Paynow webhook must confirm important provider status by polling");
requireText("app/global-error.js", "Try again", "A root-level production error boundary is required");
requireText("components/connectivity-banner.js", "navigator.onLine", "A customer-visible offline state is required");
requireText("next.config.mjs", "Strict-Transport-Security", "HSTS must be configured");
requireText("next.config.mjs", "X-Content-Type-Options", "nosniff header must be configured");
requireText("next.config.mjs", "Content-Security-Policy-Report-Only", "CSP telemetry must remain configured for launch verification");
requireText("firestore.rules", "match /rideTrips/", "Ride operational data must be covered by Firestore rules");
requireText("firestore.rules", "match /parcelJobs/", "Send operational data must be covered by Firestore rules");
requireText("storage.rules", "parcel", "Parcel proof uploads must be covered by Storage rules");
requireText("vercel.json", "ride-dispatch", "Ride dispatch cron must be scheduled");
requireText("vercel.json", "parcel-dispatch", "Parcel dispatch cron must be scheduled");

const pkg = JSON.parse(read("package.json"));
notes.push(`${routeFiles.length} API routes audited`);
notes.push(`release ${pkg.version}`);

if (failures.length) {
  console.error(`Launch audit failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Launch readiness static audit passed: ${notes.join(" · ")}.`);

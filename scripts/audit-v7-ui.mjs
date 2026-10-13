import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const notes = [];
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));
const fail = (message) => failures.push(message);

function requireFile(file) {
  if (!exists(file)) fail(`${file} is required by the V7 experience system`);
}
function requireText(file, text, message = `${file} must contain ${text}`) {
  if (!exists(file) || !read(file).includes(text)) fail(message);
}
function forbidText(file, text, message = `${file} must not contain ${text}`) {
  if (exists(file) && read(file).includes(text)) fail(message);
}

const requiredFiles = [
  "components/customer-shell.js",
  "components/customer-onboarding.js",
  "components/service-artwork.js",
  "components/marketplace-home.js",
  "components/customer-utility.js",
  "components/account-app.js",
  "components/customer-notifications-page.js",
  "components/referral-app.js",
  "components/support-app.js",
  "components/ride-app.js",
  "components/send-app.js",
  "components/customer-loading.js",
  "components/workspace-loading.js",
  "components/portal-shell.js"
];
requiredFiles.forEach(requireFile);

requireText("components/customer-shell.js", 'label: "Home"');
requireText("components/customer-shell.js", 'label: "Search"');
requireText("components/customer-shell.js", 'label: "Activity"');
requireText("components/customer-shell.js", 'label: "Saved"');
requireText("components/customer-shell.js", 'label: "Profile"');
forbidText("components/customer-shell.js", "Currency", "Customer global navigation must not expose currency as a primary navigation control");
requireText("components/customer-shell.js", "customer-primary-nav", "Desktop primary navigation needs a deliberate active state");
requireText("components/customer-shell.js", "customer-mobile-nav", "Mobile navigation must use the V7 five-destination shell");

requireText("components/customer-onboarding.js", "Your city, in one place.");
requireText("components/customer-onboarding.js", "What would you like Spotly to help with?");
requireText("components/customer-onboarding.js", "Use my location");

requireText("components/service-artwork.js", "ServiceArtwork");
for (const service of ["eat", "shop", "book", "events", "ride", "send"]) requireText("components/service-artwork.js", `${service}:`, `Service artwork must define ${service}`);

const home = read("components/marketplace-home.js");
if (!home.includes("latestRepeatBusiness ?")) fail("Home 'Again' must be conditional on actual completed history");
if (home.includes("Search nearby") && home.includes("Again")) fail("Home must not use generic search as fake repeat history");
if (!home.includes('location.coordinates ? "Near you"')) fail("Home must only claim 'Near you' when precise coordinates exist");
if (!home.includes("ActiveAccessory")) fail("Home needs the V7 Now/active activity layer");
if (!home.includes("Based on your interests") || !home.includes("interestMatchesBusiness")) fail("Home must use explicit onboarding interests for honest personalization");
if (!home.includes('item.key === "send"') || !home.includes("sendEnabled")) fail("A live Send service must remain represented in the Home service canvas");
if (home.includes("Open ↗") || home.includes(">Open<")) fail("Service tiles must not use redundant Open labels");

const coreCustomerFiles = [
  "components/marketplace-app.js",
  "components/marketplace-home.js",
  "components/customer-utility.js",
  "components/account-app.js",
  "components/ride-app.js",
  "components/send-app.js",
  "components/referral-app.js",
  "components/support-app.js",
  "components/customer-conversion.js",
  "components/customer-shell.js",
  "components/customer-onboarding.js",
  "components/service-experience.js"
];
for (const file of coreCustomerFiles) {
  if (!exists(file)) continue;
  const source = read(file);
  if (source.includes("<select")) fail(`${file}: customer V7 core must not use raw select controls`);
  if (/\b(?:bg|text|border|ring|from|to)-(?:violet|purple)-\d{2,3}(?:\/\d+)?\b/.test(source)) fail(`${file}: old fixed violet/purple utility remains in the customer V7 core`);
  if (/rounded-\[(?:14|18|20|22|26|28|30)px\]/.test(source)) fail(`${file}: uncontrolled legacy radius remains`);
}

forbidText("components/marketplace-app.js", "Search all of Spotly", "Duplicate global Search surface must be removed from Home");
requireText("components/customer-utility.js", "Popular searches", "Search needs a useful pre-query state");
requireText("components/customer-utility.js", "Save the city you want to come back to", "Saved needs an intentional all-items empty state");
requireText("components/account-app.js", "Currency & region", "Currency belongs in Account preferences, not the header");
requireText("components/payment-return-app.js", "CustomerShell", "Payment return must preserve customer continuity");
requireText("components/login-app.js", "One account. The right next step.", "Authentication needs the V7 access experience");
requireText("app/drive/page.js", "Three kinds of work. One Driver system.", "Driver acquisition should reflect Ride, Delivery and Send work");

for (const file of ["components/account-app.js", "components/customer-notifications-page.js", "components/referral-app.js", "components/support-app.js", "components/ride-app.js", "components/send-app.js"]) {
  requireText(file, "CustomerShell", `${file} must use the unified customer shell`);
}
requireText("components/portal-shell.js", "safe-bottom", "Role portals need the normalized mobile shell");
requireText("components/driver-app.js", "Available earnings", "Driver Home must surface earnings at a glance");
requireText("components/driver-app.js", "Work nearby", "Driver Home must surface work at a glance");

const allSourceRoots = ["app", "components"];
const forbiddenRadii = /rounded-\[(14|18|20|22|26|28|30)px\]/;
function walk(dir) {
  if (!exists(dir)) return [];
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(rel);
    return /\.(js|jsx|mjs)$/.test(entry.name) ? [rel.replaceAll("\\", "/")] : [];
  });
}
const sourceFiles = allSourceRoots.flatMap(walk);
for (const file of sourceFiles) {
  const source = read(file);
  if (forbiddenRadii.test(source)) fail(`${file}: uncontrolled 14/18/20/22/26/28/30px radius remains`);
  if (file.startsWith("app/") && /Suspense fallback=\{<(?:main|div)[^>]*min-h-screen[^>]*\/>/.test(source)) fail(`${file}: route fallback is an intentionally blank screen`);
}

const pkg = JSON.parse(read("package.json"));
if (pkg.version !== "7.0.0") fail(`package.json must be 7.0.0, found ${pkg.version}`);

notes.push(`${sourceFiles.length} UI source files inspected`);
notes.push(`${coreCustomerFiles.length} customer core files checked`);
notes.push("Home/Search/Activity/Saved/Profile shell verified");
notes.push("onboarding + honest personalization + active state verified");
notes.push("service artwork + Ride/Send + role shell verified");

if (failures.length) {
  console.error(`V7 experience-system audit failed (${failures.length}):`);
  for (const item of failures) console.error(`- ${item}`);
  process.exit(1);
}
console.log(`V7 experience-system audit passed: ${notes.join(" · ")}.`);

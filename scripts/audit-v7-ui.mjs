import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const passed = [];
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));
const fail = (message) => failures.push(message);
const pass = (message) => passed.push(message);

function requireFile(file, label = file) {
  if (!exists(file)) fail(`${label}: required file missing (${file})`);
  else pass(label);
}
function requireText(file, text, label = `${file} contains ${text}`) {
  if (!exists(file) || !read(file).includes(text)) fail(`${label}: expected ${JSON.stringify(text)} in ${file}`);
  else pass(label);
}
function forbidText(file, text, label = `${file} excludes ${text}`) {
  if (exists(file) && read(file).includes(text)) fail(`${label}: forbidden ${JSON.stringify(text)} remains in ${file}`);
  else pass(label);
}
function requireAll(file, values, label) {
  if (!exists(file)) return fail(`${label}: missing ${file}`);
  const source = read(file);
  const missing = values.filter((value) => !source.includes(value));
  if (missing.length) fail(`${label}: ${file} is missing ${missing.map(JSON.stringify).join(", ")}`);
  else pass(label);
}
function requirePattern(file, pattern, label) {
  if (!exists(file) || !pattern.test(read(file))) fail(`${label}: ${file} does not satisfy ${pattern}`);
  else pass(label);
}

const requiredFiles = [
  "app/v7-experience.css",
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
  "components/portal-shell.js",
  "components/driver-app.js"
];
requiredFiles.forEach((file) => requireFile(file, `foundation:${file}`));

// 1–4. One deliberate customer shell; no duplicate utility clutter.
requireAll("components/customer-shell.js", ['label: "Home"', 'label: "Activity"', 'label: "Saved"', 'locationLabel', 'NotificationBell', 'Search Spotly'], "customer shell desktop zones");
requireAll("components/customer-shell.js", ['label: "Home"', 'label: "Search"', 'label: "Activity"', 'label: "Saved"', 'label: "Profile"', 'customer-mobile-nav'], "customer shell mobile destinations");
forbidText("components/customer-shell.js", "Currency", "currency removed from global navigation");
forbidText("components/marketplace-app.js", "Search all of Spotly", "duplicate Home search removed");

// 5–7. Service identity and availability hierarchy.
requireAll("components/service-artwork.js", ["ServiceArtwork", "eat:", "shop:", "book:", "events:", "ride:", "send:", "useReducedMotion"], "six-service artwork family");
forbidText("components/marketplace-home.js", "Open ↗", "service tiles do not say Open");
requirePattern("components/marketplace-home.js", /!ridesEnabled[\s\S]*coming to \{location\.city\}/, "unavailable Ride is subordinate");
requirePattern("components/marketplace-home.js", /!sendEnabled[\s\S]*coming to \{location\.city\}/, "unavailable Send is subordinate");

// 8–13. Honest personalization, onboarding, explicit user state and Now.
requirePattern("components/marketplace-home.js", /latestRepeatBusiness \?/, "Again requires completed history");
forbidText("components/marketplace-home.js", "Search nearby", "generic search is not fake repeat history");
requireText("components/marketplace-home.js", 'location.coordinates ? "Near you"', "Near you requires precise location");
requireAll("components/marketplace-home.js", ["Based on your interests", "interestMatchesBusiness", "ActiveAccessory", "trulyNew"], "Home state-driven personalization");
requireAll("components/customer-onboarding.js", ["Your city, in one place.", "Use my location", "What would you like Spotly to help with?", "Home", "Work", "Continue exploring"], "progressive onboarding");
requireText("components/customer-onboarding.js", "Spotly asks the browser for location only after you choose this option.", "location permission explained before request");

// 14–15. Empty and loading states are product states.
requireAll("components/customer-utility.js", ["Popular searches", "No results for", "Save the city you want to come back to", "Nothing saved in"], "Search and Saved empty/recovery states");
requireAll("components/marketplace-app.js", ["Sign in to see your activity", "Your Spotly activity will live here", "Needs attention", "Active now", "Upcoming", "Past"], "Activity empty and lifecycle states");
requireAll("components/customer-loading.js", ["v7-skeleton"], "customer content skeletons");
requireAll("components/workspace-loading.js", ["v7-skeleton"], "workspace content skeletons");

// 16–20. Geometry, spacing, widths, cards and typography are systemized.
requireAll("app/v7-experience.css", ["--v7-space-1", "--v7-space-16", "--v7-radius-control", "--v7-radius-card", "--v7-radius-feature", "--v7-radius-pill", "--v7-content-wide", "--v7-content-medium", "--v7-content-focused", ".v7-list", ".v7-row", ".v7-display", ".v7-title-1", ".v7-title-2", ".v7-title-3"], "V7 geometry/spacing/type tokens");
requireText("app/layout.js", 'import "./v7-experience.css";', "V7 layer loaded globally");

// 21–25. Customer utility routes share one shell; Activity/Saved/Account are intentional.
for (const file of ["components/account-app.js", "components/customer-notifications-page.js", "components/referral-app.js", "components/support-app.js", "components/ride-app.js", "components/send-app.js"]) {
  requireText(file, "CustomerShell", `unified customer shell:${file}`);
}
requireAll("components/customer-utility.js", ["Businesses", "Products", "Services", "Events", "Places"], "Saved visual categories");
requireAll("components/account-app.js", ["Currency & region", "Preferences", "Notifications", "Privacy"], "Account settings architecture");

// 26–30. Search intelligence, detail media, checkout progression and immersive live services.
requireAll("components/customer-utility.js", ["Recent searches", "Popular searches", "Businesses", "Products", "Services", "Events", "Places", "Change location"], "intelligence-first Search");
requirePattern("components/service-experience.js", /imageForBusiness\(business\)/, "merchant media is preferred in discovery");
requireAll("components/marketplace-app.js", ["Fulfilment", "Payment", "View in Activity"], "checkout communicates progression and continuity");
requireAll("components/ride-app.js", ["CustomerShell", "Map", "PIN"], "Ride retains immersive operational cues");
requireAll("components/send-app.js", ["CustomerShell", "PIN"], "Send retains immersive operational cues");

// 31–32. Motion and icon levels.
requireAll("app/v7-experience.css", ["--v7-motion-press", "--v7-motion-state", "--v7-motion-sheet", "--v7-motion-page", "prefers-reduced-motion"], "motion tokens and reduced motion");
requireText("components/service-artwork.js", "ServiceGlyph", "custom service glyph family");
requireText("components/customer-shell.js", "lucide-react", "system icons remain standard");

// 33. Business, Driver, Staff and Admin share the V7 system without becoming consumer clones.
requireAll("app/v7-experience.css", ['[data-workspace="business"]', '[data-workspace="driver"]', '[data-workspace="staff"]', '[data-workspace="admin"]', ".v7-queue"], "cross-role V7 normalization");
requireAll("components/driver-app.js", ["Available earnings", "Work nearby", "online"], "Driver at-a-glance hierarchy");
requireText("components/portal-shell.js", "safe-bottom", "role portals have deliberate mobile navigation");

// 34–35. State matrix and honest language.
requireAll("app/v7-experience.css", [".v7-state", ".v7-skeleton-block", ".v7-interactive"], "shared state primitives");
requirePattern("components/marketplace-home.js", /location\.coordinates \? "Near you" : `Popular in \$\{location\.city\}`/, "location language reflects available data");
requirePattern("components/marketplace-home.js", /latestRepeatBusiness \? <section[\s\S]*title="Again"/, "repeat language reflects transaction history");

// 36. Shared primitives/system CSS exists before further expansion.
requireAll("app/v7-experience.css", [".v7-page", ".v7-page-header", ".v7-section-header", ".v7-discovery-rail", ".v7-media-card", ".v7-stat-grid"], "shared V7 presentation primitives");

// 37–39. Exact screenshot fixes, stop-doing rules and release acceptance gates.
const customerCore = [
  "components/marketplace-app.js",
  "components/marketplace-home.js",
  "components/customer-utility.js",
  "components/account-app.js",
  "components/customer-shell.js",
  "components/customer-onboarding.js",
  "components/service-experience.js"
];
for (const file of customerCore) {
  if (!exists(file)) continue;
  const source = read(file);
  if (source.includes("<select")) fail(`premium customer core:${file} still contains a raw <select>`);
  else pass(`premium customer core:${file} has no raw select`);
  if (/rounded-\[(?:14|18|20|22|26|28|30)px\]/.test(source)) fail(`geometry drift:${file} contains a forbidden arbitrary V7 radius`);
  else pass(`geometry normalized:${file}`);
}
forbidText("components/marketplace-home.js", ">Open<", "no generic Open label on Home");
requireAll("components/customer-shell.js", ["focus-visible", "aria-label"], "customer shell keyboard/accessibility cues");

const pkg = JSON.parse(read("package.json"));
if (pkg.version !== "7.0.0") fail(`release version must remain 7.0.0, found ${pkg.version}`);
else pass("release version 7.0.0");

if (failures.length) {
  console.error(`V7 full-audit rebuild failed (${failures.length} failures / ${passed.length} checks passed):`);
  for (const item of failures) console.error(`- ${item}`);
  process.exit(1);
}
console.log(`V7 full-audit rebuild passed ${passed.length} implementation checks across all 39 audit themes.`);

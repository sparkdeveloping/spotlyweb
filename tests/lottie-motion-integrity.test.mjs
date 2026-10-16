import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");

const requiredAnimations = [
  "search-nearby",
  "basket-add",
  "route-delivery",
  "verified-business",
  "storefront-open",
  "driver-online",
  "notification-bell",
  "empty-basket",
  "kiosk-scan",
  "success-burst",
  "location-pin",
  "marketplace-discover",
  "review-pending",
  "money-flow",
  "team-collaboration",
  "support-chat",
  "analytics-rise",
  "calendar-schedule",
];

test("Lottie runtime is a pinned production dependency", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.dependencies?.["lottie-web"], "5.12.2");
  const lock = read("package-lock.json");
  assert.match(lock, /node_modules\/lottie-web/);
});

test("Spotly ships first-party local Lottie assets with valid animation structure", () => {
  const names = new Set(readdirSync(join(root, "public/lottie")).filter((name) => name.endsWith(".json")).map((name) => name.replace(/\.json$/, "")));
  for (const name of requiredAnimations) {
    assert.ok(names.has(name), `missing ${name}.json`);
    const animation = JSON.parse(read(`public/lottie/${name}.json`));
    assert.ok(Number(animation.w) > 0 && Number(animation.h) > 0, `${name} needs a viewport`);
    assert.ok(Number(animation.fr) > 0, `${name} needs a frame rate`);
    assert.ok(Number(animation.op) > Number(animation.ip), `${name} needs a playable frame range`);
    assert.ok(Array.isArray(animation.layers) && animation.layers.length > 0, `${name} needs animation layers`);
    assert.equal(animation.assets?.some?.((asset) => /^https?:/i.test(asset?.u || "")), false, `${name} must not fetch remote media`);
  }
});

test("Lottie primitive is lazy, viewport-aware and reduced-motion safe", () => {
  const source = read("components/spotly-lottie.js");
  assert.match(source, /import\("lottie-web"\)/);
  assert.match(source, /useReducedMotion/);
  assert.match(source, /useInView/);
  assert.match(source, /cache:\s*"force-cache"/);
  assert.match(source, /instance\.goToAndStop\(0, true\)/);
  assert.match(source, /player\.pause\(\)/);
  assert.doesNotMatch(source, /https?:\/\//);
});

test("conversion and high-frequency workflows use semantic Lottie motion", () => {
  const landing = read("components/coming-soon-app.js");
  const marketplace = read("components/marketplace-app.js");
  const kiosk = read("components/business/kiosk.js");
  const driver = read("components/driver-app.js");
  const notifications = read("components/notification-center.js");
  const account = read("components/account-app.js");

  for (const phrase of ["marketplace-discover", "basket-add", "storefront-open", "driver-online", "route-delivery"]) assert.match(landing, new RegExp(phrase));
  for (const phrase of ["basket-add", "empty-basket", "search-nearby"]) assert.match(marketplace, new RegExp(phrase));
  assert.match(kiosk, /kiosk-scan/);
  assert.match(kiosk, /success-burst/);
  assert.match(driver, /driver-online/);
  assert.match(driver, /route-delivery/);
  assert.match(notifications, /notification-bell/);
  assert.match(account, /marketplace-discover/);
});

test("shared empty states extend motion across operations without animating warning states", () => {
  const ui = read("components/ui.js");
  for (const animation of ["review-pending", "money-flow", "team-collaboration", "support-chat", "analytics-rise", "calendar-schedule"]) {
    assert.match(ui, new RegExp(animation));
  }
  assert.doesNotMatch(ui, /AlertTriangle:\s*"/);
});

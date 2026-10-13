import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("launch readiness blocks missing production infrastructure instead of treating configuration as proof", () => {
  const source = read("app/api/admin/launch-readiness/route.js");
  for (const gate of ["firebase-admin", "storage", "production-origin", "finance-encryption", "dispatch-cron", "ride-rollout", "send-rollout", "bootstrap-admin"]) {
    assert.match(source, new RegExp(`item\\(\\"${gate}\\"`));
  }
  assert.match(source, /CRON_SECRET/);
  assert.match(source, /SPOTLY_FINANCE_ENCRYPTION_KEY/);
  assert.match(source, /BOOTSTRAP_ADMIN_EMAILS/);
});

test("public lead and geocode traffic participate in abuse protection", () => {
  const lead = read("app/api/lead/route.js");
  const geocode = read("app/api/public/geocode/route.js");
  assert.match(lead, /verifyAppCheckRequest/);
  assert.match(lead, /enforceRateLimit/);
  assert.match(geocode, /verifyAppCheckRequest/);
  assert.match(geocode, /enforceRateLimit/);
});

test("root runtime failures and offline mode have customer-safe recovery UI", () => {
  assert.match(read("app/global-error.js"), /Try again/);
  assert.match(read("components/connectivity-banner.js"), /navigator\.onLine/);
  assert.match(read("app/layout.js"), /ConnectivityBanner/);
});

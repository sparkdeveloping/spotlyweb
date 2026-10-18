import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("Spotly Business root sells the product instead of showing an auth wall", () => {
  const auth = read("components/auth-gate.js");
  const marketing = read("components/business/business-marketing.js");
  assert.match(auth, /BusinessMarketingPage/);
  assert.match(auth, /portal === "business" && isBusinessLanding/);
  assert.match(marketing, /Run your business where Zimbabwe discovers it/);
  assert.match(marketing, /Find or claim my business/);
  assert.match(marketing, /Sell products/);
  assert.match(marketing, /Serve food/);
  assert.match(marketing, /Take bookings/);
  assert.match(marketing, /Sell experiences/);
  assert.match(marketing, /ProductPreview/);
});

test("Business acquisition stays on the Business domain", () => {
  const marketing = read("components/business/business-marketing.js");
  const layout = read("components/business/business-layout-client.js");
  const domains = read("lib/spotly-domains.js");
  const claim = read("components/claim-app.js");
  assert.match(marketing, /spotlyPortalUrl\("business", "\/get-started"\)/);
  assert.match(layout, /normalizePortalPath\("business", pathname \|\| "\/"\)/);
  assert.match(layout, /cleanPathname === "\/get-started"/);
  assert.match(layout, /cleanPathname\?\.startsWith\("\/claim-status\/"\)/);
  assert.match(domains, /"get-started"/);
  assert.match(domains, /"claim-status"/);
  assert.match(claim, /businessJourney/);
  assert.ok(fs.existsSync(new URL("../app/business/get-started/page.js", import.meta.url)));
  assert.ok(fs.existsSync(new URL("../app/business/claim-status/[claimId]/page.js", import.meta.url)));
});

test("claim flow presents four human phases instead of ten bureaucratic stages", () => {
  const claim = read("components/claim-app.js");
  for (const phase of ["Business", "You", "Details", "Verify"]) assert.match(claim, new RegExp(`label: "${phase}"`));
  assert.match(claim, /PHASES/);
  assert.match(claim, /Is your business already on Spotly\?/);
  assert.match(claim, /Help us confirm/);
});

test("live Business navigation is job-shaped and archetype-aware", () => {
  const archetypes = read("data/business-archetypes.js");
  for (const group of ["Home", "Operate", "Grow", "Manage"]) assert.match(archetypes, new RegExp(`group: "${group}"`));
  assert.match(archetypes, /activityNav/);
  assert.match(archetypes, /Fulfilment & delivery/);
  assert.match(archetypes, /Get live/);
  assert.match(archetypes, /Verification status/);
});

test("Business V8 keeps lifecycle and day-to-day attention separate", () => {
  const dashboard = read("components/business/dashboard.js");
  const launch = read("components/business/launch.js");
  assert.match(dashboard, /Needs your attention/);
  assert.match(dashboard, /Quick actions/);
  assert.match(dashboard, /v7-page-enter/);
  assert.match(launch, /Your launch setup/);
  assert.match(launch, /Waiting on Spotly/);
  assert.match(launch, /v7-page-enter/);
});

test("merchant-facing preview and support remain contextual", () => {
  const settings = read("components/business/settings.js");
  const catalog = read("components/business/catalog.js");
  const support = read("components/business/support.js");
  assert.match(settings, /View as customer/);
  assert.match(catalog, /Customer preview/);
  assert.match(support, /v7-page-enter/);
});

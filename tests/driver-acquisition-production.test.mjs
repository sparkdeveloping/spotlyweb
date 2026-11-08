import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { driverAcquisitionSlug, driverAcquisitionUrl } from "../lib/driver-acquisition.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Driver acquisition produces stable trackable Spotly URLs", () => {
  assert.equal(driverAcquisitionSlug(" Harare CBD / Flyer A "), "harare-cbd-flyer-a");
  assert.equal(driverAcquisitionUrl("Harare CBD / Flyer A"), "https://driver.spotlyafrica.com/join/harare-cbd-flyer-a");
  assert.equal(driverAcquisitionUrl(""), "https://driver.spotlyafrica.com/join");
});

test("public Driver acquisition feeds the existing private driverLeads pipeline", async () => {
  const [route, rules] = await Promise.all([
    read("app/api/public/driver-leads/route.js"),
    read("firestore.rules"),
  ]);
  assert.match(route, /db\.collection\("driverLeads"\)/);
  assert.match(route, /db\.collection\("driverLeadContacts"\)/);
  assert.match(route, /driverLeadTouchpoints/);
  assert.match(route, /status:\s*"awaiting_claim"/);
  assert.match(route, /source:\s*"public_driver_acquisition"/);
  assert.doesNotMatch(route, /invitationHash:/);
  assert.match(rules, /match \/driverLeads\/\{leadId\} \{ allow read, write: if false; \}/);
  assert.match(rules, /match \/driverAcquisitionMetrics\/\{metricId\} \{ allow read, write: if false; \}/);
  assert.match(rules, /match \/driverAcquisitionSessions\/\{sessionId\} \{ allow read, write: if false; \}/);
});

test("public acquisition tracks a first-party funnel without storing raw IP or fingerprint data", async () => {
  const [eventRoute, server, landing] = await Promise.all([
    read("app/api/public/driver-acquisition/route.js"),
    read("lib/driver-acquisition-server.js"),
    read("components/driver/driver-acquisition-landing.js"),
  ]);
  assert.match(server, /driverAcquisitionSessions/);
  assert.match(server, /views/);
  assert.match(server, /starts/);
  assert.match(server, /contactCompletes/);
  assert.match(server, /submissions/);
  assert.match(server, /newLeads/);
  assert.match(landing, /event:\s*"view"/);
  assert.match(landing, /event:\s*"start"/);
  assert.match(landing, /event:\s*"contact_complete"/);
  assert.match(eventRoute, /verifyAppCheckRequest/);
  assert.match(eventRoute, /enforceRateLimit/);
  assert.doesNotMatch(server, /request\.ip|x-forwarded-for|fingerprint/i);
});

test("Admin Mobility can create campaigns, compare performance and generate campaign QR downloads", async () => {
  const [api, ui, mobility] = await Promise.all([
    read("app/api/admin/driver-acquisition/route.js"),
    read("components/admin-driver-acquisition.js"),
    read("components/admin-driver-operations.js"),
  ]);
  assert.match(api, /canManageDriverLeads/);
  assert.match(api, /driverAcquisitionCampaigns/);
  assert.match(api, /driverAcquisitionMetrics/);
  assert.match(api, /countryCity/);
  assert.match(ui, /Campaigns & QR tracking/);
  assert.match(ui, /qrcodejs@1\.0\.0/);
  assert.match(ui, /City performance/);
  assert.match(ui, /Visit → lead/);
  assert.match(mobility, /value:"acquisition",label:"Acquisition"/);
});

test("Driver campaign URLs are public, campaign-specific and keep the old landing alias", async () => {
  const [generic, campaign, alias, landing] = await Promise.all([
    read("app/driver/join/page.js"),
    read("app/driver/join/[campaign]/page.js"),
    read("app/driver/landing/page.js"),
    read("components/driver/driver-acquisition-landing.js"),
  ]);
  assert.match(generic, /DriverAcquisitionLanding/);
  assert.match(campaign, /campaignSlug=\{campaign\}/);
  assert.match(alias, /redirect\("\/join"\)/);
  assert.match(landing, /You do not need to create an account yet/);
  assert.match(landing, /No account or document upload required at this stage/);
  assert.match(landing, /private Driver recruitment pipeline/);
});

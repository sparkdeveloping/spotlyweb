import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DRIVER_COUNTRIES, normalizeDriverPhone, validCountry, validDriverContactPhone } from "../lib/driver-regions.js";
import { requirementPlan } from "../lib/driver-capabilities.js";
import { defaultRoleTemplates } from "../data/production-seed.js";
const source = (name) => readFile(new URL(`../${name}`, import.meta.url), "utf8");

test("Malawi and Zimbabwe national phones normalize to their own country dial codes", () => {
  assert.equal(normalizeDriverPhone("0991234567", "MW"), "+265991234567");
  assert.equal(normalizeDriverPhone("0771234567", "ZW"), "+263771234567");
  assert.equal(validDriverContactPhone("+265991234567", "MW"), true);
  assert.equal(validDriverContactPhone("+265991234567", "ZW"), false);
  assert.equal(validCountry("MW"), true);
  assert.equal(validCountry("ZZ"), false);
  assert.ok(DRIVER_COUNTRIES.MW.cities.includes("Lilongwe"));
});

test("training does not gate application readiness", () => {
  const application = { country: "MW", legalName: "Prospective Driver", phone: "+265991234567", city: "Blantyre", emergencyContactName: "Trusted Person", emergencyContactPhone: "+265888123456", requestedCapabilities: ["prepared_delivery"], agreementsAccepted: true, locationConsent: true };
  const vehicle = { id: "driver_primary", type: "bicycle" };
  const documents = [{ type: "identity", status: "uploaded" }];
  const payoutAccount = { type: "mobile_money", provider: "Airtel Money", recipientName: "Prospective Driver", maskedIdentifier: "•••• 4567", verificationState: "pending" };
  const readiness = requirementPlan({ application, vehicle, documents, payoutAccount });
  assert.equal(readiness.complete, true);
  assert.ok(readiness.checks.every((check) => !check.id.startsWith("training")));
});

test("lead creation and claim endpoints enforce private admin roles and verified ownership", async () => {
  const [lead, admin, claim] = await Promise.all([
    source("lib/driver-leads.js"), source("app/api/admin/driver-leads/route.js"), source("app/api/driver/claim-lead/route.js")
  ]);
  assert.match(lead, /canManageDriverLeads/);
  assert.match(lead, /drivers\.leads\.manage/);
  assert.match(lead, /user\.email_verified === true/);
  assert.match(lead, /lead\.phone && phone && phone === lead\.phone/);
  assert.match(lead, /randomBytes\(32\)/);
  assert.match(admin, /contactKey/);
  assert.match(admin, /runTransaction/);
  assert.match(admin, /invitation_rotated/);
  assert.match(admin, /contact_corrected/);
  assert.match(admin, /oldKeys/);
  assert.match(admin, /nextKeys/);
  assert.match(admin, /archiveReason/);
  assert.match(claim, /authorizedClaim/);
  assert.match(claim, /sourceLeadId/);
  assert.match(claim, /invitationExpiresAt/);
  assert.match(claim, /FieldValue\.delete/);
  assert.doesNotMatch(admin, /drivers"\)\.doc\(ref\.id\)/);
});

test("invitation, recruiter workspace, route mapping and Firestore privacy are wired across domains", async () => {
  const [driver, admin, auth, domains, rules] = await Promise.all([
    source("components/driver-complete-invitation.js"), source("components/admin-driver-operations.js"),
    source("components/auth-gate.js"), source("lib/spotly-domains.js"), source("firestore.rules")
  ]);
  assert.match(driver, /AuthGate portal="driver"/);
  assert.match(driver, /api\/driver\/claim-lead/);
  assert.match(admin, /AdminDriverLeads/);
  assert.match(admin, /driver_recruiter/);
  assert.match(auth, /currentPortalDestination/);
  assert.match(domains, /driver: new Set\(\["complete"/);
  assert.match(rules, /driverLeadContacts/);
  assert.match(rules, /driverLeads/);
});

test("country admin overrides and final Driver consent are kept separate", async () => {
  const [admin, api, ui] = await Promise.all([
    source("app/api/admin/drivers/route.js"), source("app/api/driver/application/route.js"), source("components/driver-app.js")
  ]);
  assert.match(admin, /action === "set_country"/);
  assert.match(admin, /countryOverrideReason/);
  assert.match(admin, /driverCountryCanActivate/);
  assert.match(admin, /complianceHold/);
  assert.match(api, /existing\.countryOverride/);
  assert.match(ui, /locationConsent/);
  assert.match(ui, /agreementsAccepted/);
  assert.match(ui, /existing\.licenceReference/);
  assert.doesNotMatch(ui, /DRIVER_TRAINING_MODULES/);
});

test("Team & Access role selector tracks shared platform roles and preserves existing grants", async () => {
  const [picker, access] = await Promise.all([
    source("components/admin-legacy-sections.js"),
    source("lib/admin-access.js")
  ]);
  const recruiter = defaultRoleTemplates.find((role) => role.id === "driver_recruiter");
  assert.ok(recruiter, "Driver recruiter must be registered as a shared role template");
  assert.equal(recruiter.scope, "platform");
  assert.deepEqual(recruiter.permissions, ["drivers.leads.manage"]);
  assert.match(picker, /\.\.\.defaultRoles\.map\(\(\{ id \}\) => id\)/);
  assert.match(picker, /\.\.\.\(person\?\.roles \|\| \[\]\)/);
  assert.match(access, /driver_recruiter:\s*\["home","mobility"\]/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../firebase/functions/src/core/driver-runtime.js", import.meta.url), "utf8");
const from = source.indexOf("function country(value)");
const until = source.indexOf("function finished(", from);
assert.ok(from > 0 && until > from, "Country and territory policy must be defined");
const helpers = new Function("text", source.slice(from, until) +
  "\nreturn { country, area, approvedTerritory, matchingActiveDispatchZone };")(
  (value, max = 80) => String(value ?? "").trim().slice(0, max)
);

test("country mapping fails closed instead of silently assigning Zimbabwe", () => {
  assert.equal(helpers.country("ZW"), "ZW");
  assert.equal(helpers.country("mw"), "MW");
  for (const invalid of ["", "ZA", "XX", null, undefined, "ZWE"])
    assert.equal(helpers.country(invalid), "");
  assert.doesNotMatch(source, /includes\(result\) \? result : "ZW"/);
});

test("approved territory derives canonical city area even without dispatchZones", () => {
  assert.deepEqual(helpers.approvedTerritory({ country: "ZW", city: "Harare" }), {
    verified: true, country: "ZW", city: "Harare",
    defaultArea: "harare", defaultAreaLabel: "Harare", reason: ""
  });
  const malawi = helpers.approvedTerritory({ country: "MW", city: "Lilongwe" });
  assert.equal(malawi.country, "MW");
  assert.equal(malawi.defaultArea, "lilongwe");
  assert.equal(helpers.approvedTerritory({ country: "unknown", city: "Harare" }).verified, false);
  assert.equal(helpers.approvedTerritory({ country: "ZW", city: "" }).verified, false);
  assert.equal(helpers.approvedTerritory({}, { country: "MW", city: "Blantyre" }).defaultArea, "blantyre");
});

test("optional zones cannot escape approved country or city or use disabled zones", () => {
  const t = helpers.approvedTerritory({ country: "ZW", city: "Harare" });
  const isAllowed = zone => helpers.matchingActiveDispatchZone(zone, t, "harare-east");
  assert.equal(isAllowed({ id: "harare-east", country: "ZW", city: "Harare", active: true }), true);
  assert.equal(isAllowed({ id: "harare-east", country: "MW", city: "Harare", active: true }), false);
  assert.equal(isAllowed({ id: "harare-east", country: "ZW", city: "Bulawayo", active: true }), false);
  assert.equal(isAllowed({ id: "harare-east", country: "ZW", city: "", active: true }), false);
  assert.equal(isAllowed({ id: "harare-east", country: "ZW", city: "Harare", active: false }), false);
  assert.equal(isAllowed({ id: "harare-east", country: "ZW", city: "Harare", status: "disabled" }), false);
  assert.equal(helpers.matchingActiveDispatchZone(
    { id: "", country: "ZW", city: "Harare", active: true }, t, "default"), false);
});

test("bootstrap projects eligibility and approved city independently of optional zones", () => {
  assert.match(source, /const dispatchReadiness = \{/);
  assert.match(source, /\.\.\.approvedTerritory\(driver, application\)/);
  assert.match(source, /return \{ profile: profile\(actor, application, driver, selectedVehicle\), dispatchReadiness/);
  assert.match(source, /const territory = approvedTerritory\(driver, application\)/);
  assert.match(source, /if \(!territory\.verified\) return \{ eligible: false/);
});

test("online session validates requested country and optional scoped zone", () => {
  assert.match(source, /const countryCode = action === "online" \? allowed\.country/);
  assert.match(source, /requestedCountry && requestedCountry !== allowed\.country/);
  assert.match(source, /requestedCountry = text\(data\.country, 20\)/);
  assert.match(source, /let areaCode = action === "online" \? allowed\.defaultArea/);
  assert.match(source, /const requestedArea = data\.area \? area\(data\.area\) : allowed\.defaultArea/);
  assert.match(source, /if \(requestedArea !== allowed\.defaultArea\)/);
  assert.match(source, /matchingActiveDispatchZone\(/);
  assert.match(source, /This dispatch zone is not active for your approved city/);
  assert.match(source, /runtimeAccess\/driverDispatchScope/);
});

test("application changes cannot save unsupported territories", () => {
  assert.match(source, /const requestedTerritory = approvedTerritory\(/);
  assert.match(source, /if \(!requestedTerritory\.verified\)/);
  assert.match(source, /Choose a supported operating country and city/);
});

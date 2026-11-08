import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { routeHarness } from "./helpers/route-harness.mjs";

const root = process.cwd();
const harness = routeHarness(root);
const engine = harness.load("lib/country-engine.js");
const manifest = JSON.parse(readFileSync(resolve(root, "contracts/spotly-countries.v1.json"), "utf8"));

test("country manifest defines Zimbabwe and Malawi without a default country", () => {
  assert.equal(manifest.countryContractVersion, "1.0.0");
  assert.deepEqual(manifest.countries.map((country) => country.code), ["ZW", "MW"]);
  assert.equal(Object.hasOwn(manifest, "defaultCountry"), false);
  assert.equal(engine.resolveCountryContext().countryCode, null);
  assert.equal(engine.resolveCountryContext().source, "unresolved");
});

test("coordinates infer only supported countries", () => {
  assert.equal(engine.countryFromCoordinates({ lat: -17.8252, lng: 31.0335 }), "ZW");
  assert.equal(engine.countryFromCoordinates({ lat: -13.9626, lng: 33.7741 }), "MW");
  assert.equal(engine.countryFromCoordinates({ lat: 38.9, lng: -94.7 }), null);
  assert.equal(engine.countryFromCoordinates(null), null);
});

test("country resolution honors override then account preference then device suggestion", () => {
  assert.deepEqual(engine.resolveCountryContext({ overrideCountryCode: "MW", preferenceCountryCode: "ZW" }), { countryCode: "MW", source: "admin_override", locked: true });
  assert.deepEqual(engine.resolveCountryContext({ preferenceCountryCode: "ZW", suggestedCountryCode: "MW" }), { countryCode: "ZW", source: "account_preference", locked: false });
  assert.deepEqual(engine.resolveCountryContext({ suggestedCountryCode: "MW" }), { countryCode: "MW", source: "device_location", locked: false, suggested: true });
});

test("phone normalization uses the selected country's dialing plan", () => {
  assert.equal(engine.normalizePhoneForCountry("0771234567", "ZW"), "+263771234567");
  assert.equal(engine.normalizePhoneForCountry("+265 991 234 567", "MW"), "+265991234567");
  assert.throws(() => engine.normalizePhoneForCountry("0771234567", null), /Choose a supported country/);
  assert.throws(() => engine.normalizePhoneForCountry("123", "MW"), /valid Malawi phone/);
});

test("cities, timezones and currencies come from the canonical country catalog", () => {
  assert.equal(engine.countryCity("ZW", "harare")?.name, "Harare");
  assert.equal(engine.countryCity("MW", "Lilongwe")?.name, "Lilongwe");
  assert.equal(engine.countryCity("MW", "Harare"), null);
  assert.equal(engine.countryTimeZone("ZW"), "Africa/Harare");
  assert.equal(engine.countryTimeZone("MW"), "Africa/Blantyre");
  assert.deepEqual(engine.countryCurrencies("ZW"), ["USD", "ZWG"]);
  assert.deepEqual(engine.countryCurrencies("MW"), ["MWK"]);
});

test("country override records are server-owned in Firestore rules", () => {
  const rules = readFileSync(resolve(root, "firestore.rules"), "utf8");
  assert.match(rules, /match \/accountCountryOverrides\/\{uid\}/);
  assert.match(rules, /allow create, update, delete: if false/);
});

test("transaction boundaries persist canonical country context", () => {
  const orders = readFileSync(resolve(root, "app/api/orders/create/route.js"), "utf8");
  const transactions = readFileSync(resolve(root, "app/api/customer/transactions/create/route.js"), "utf8");
  assert.match(orders, /country: countryCode/);
  assert.match(orders, /timeZone/);
  assert.doesNotMatch(orders, /branchData\.area \|\| branchData\.city \|\| "Harare"/);
  assert.match(transactions, /country: countryCode/);
  assert.match(transactions, /countryTimeZone\(countryCode\)/);
  assert.doesNotMatch(transactions, /timeZone: "Africa\/Harare"/);
});

test("new business creation validates country and city instead of defaulting Zimbabwe", () => {
  const route = readFileSync(resolve(root, "app/api/business-claims/submit/route.js"), "utf8");
  assert.match(route, /z\.enum\(\["ZW", "MW"\]\)/);
  assert.match(route, /countryCity\(provisionalCountry, provisional\.city\)/);
  assert.doesNotMatch(route, /provisional\.country \|\| "ZW"/);
  assert.doesNotMatch(route, /provisional\.city \|\| "Harare"/);
});

test("pickup scheduling and accepted currencies derive from the branch country", () => {
  const source = readFileSync(resolve(root, "lib/pickup-availability.js"), "utf8");
  assert.match(source, /branchCountry\(branch\)/);
  assert.match(source, /country\.timeZone/);
  assert.match(source, /branchCountry\(branch\)\?\.currencyPriority/);
  assert.doesNotMatch(source, /const ZW_TIMEZONE/);
  const pickup = harness.load("lib/pickup-availability.js");
  assert.deepEqual(pickup.branchAcceptedCurrencies({ country: "MW" }), ["MWK"]);
  assert.deepEqual(pickup.branchAcceptedCurrencies({ country: "ZW" }), ["USD", "ZWG"]);
  assert.deepEqual(pickup.branchAcceptedCurrencies({}), []);
});

test("NXT prospect conversion cannot manufacture Zimbabwe records from missing geography", () => {
  const prospectRoute = readFileSync(resolve(root, "app/api/nxt/route.js"), "utf8");
  const onboardRoute = readFileSync(resolve(root, "app/api/nxt/onboard/route.js"), "utf8");
  const workspace = readFileSync(resolve(root, "components/nxt-workspace.js"), "utf8");
  assert.match(prospectRoute, /country: z\.enum\(\["ZW", "MW"\]\)/);
  assert.match(onboardRoute, /normalizeCountryCode\(p\.country\)/);
  assert.match(onboardRoute, /countryCity\(countryCode,p\.city\)/);
  assert.doesNotMatch(onboardRoute, /country:"ZW"/);
  assert.doesNotMatch(workspace, /city:"Harare"/);
  assert.match(workspace, /Choose country/);
});

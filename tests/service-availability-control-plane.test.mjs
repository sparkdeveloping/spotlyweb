import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SERVICE_IDS } from "../lib/contracts/generated.js";
import { SPOTLY_COUNTRIES } from "../lib/country-engine.js";
import {
  applyServiceAvailabilityDraftEdit,
  buildServiceAvailabilityReadiness,
  materializeServiceAvailabilityRuntimeConfig,
  publishBlockersForImpact,
  serviceAvailabilityImpact,
  serviceAvailabilityMatrix
} from "../lib/service-availability-control-plane.js";
import { resolveServiceAvailability } from "../lib/service-availability.js";

const root = process.cwd();
const source = (path) => readFileSync(resolve(root, path), "utf8");

const emptyFacts = () => ({
  supportConfigured: true,
  marketplace: {},
  drivers: {},
  mobility: {
    ride: { enabledCountries: [], countries: {}, routingReady: false, schedulerReady: false, pinReady: false, geofences: {} },
    send: { enabledCountries: [], countries: {}, routingReady: false, schedulerReady: false, pinReady: false, geofences: {} }
  }
});

test("control plane renders every canonical country × service and every canonical city", () => {
  const matrix = serviceAvailabilityMatrix({});
  assert.equal(matrix.length, SPOTLY_COUNTRIES.length);
  for (const country of matrix) {
    assert.deepEqual(Object.keys(country.services).sort(), [...SERVICE_IDS].sort());
    const definition = SPOTLY_COUNTRIES.find((item) => item.code === country.country);
    assert.equal(country.cities.length, definition.cities.length);
    for (const city of country.cities) assert.deepEqual(Object.keys(city.services).sort(), [...SERVICE_IDS].sort());
  }
});

test("draft edits are hierarchical, canonical and support explicit inheritance", () => {
  const original = {};
  const service = applyServiceAvailabilityDraftEdit(original, { service: "ride", scope: "service", state: "preview" });
  const country = applyServiceAvailabilityDraftEdit(service, { service: "ride", scope: "country", country: "ZW", state: "discover" });
  const city = applyServiceAvailabilityDraftEdit(country, { service: "ride", scope: "city", country: "ZW", city: "Harare", state: "live", reason: "Harare launch" });
  assert.deepEqual(original, {});
  assert.equal(resolveServiceAvailability({ serviceAvailability: city, serviceAvailabilityRevisionNumber: 1 }, { service: "ride", country: "ZW", city: "Harare" }).state, "live");
  assert.equal(resolveServiceAvailability({ serviceAvailability: city, serviceAvailabilityRevisionNumber: 1 }, { service: "ride", country: "ZW", city: "Bulawayo" }).state, "discover");
  const inherited = applyServiceAvailabilityDraftEdit(city, { service: "ride", scope: "city", country: "ZW", city: "Harare", state: "inherit" });
  assert.equal(resolveServiceAvailability({ serviceAvailability: inherited, serviceAvailabilityRevisionNumber: 1 }, { service: "ride", country: "ZW", city: "Harare" }).state, "discover");
});

test("impact preview detects transaction start/stop, visibility and inherited city propagation", () => {
  const active = applyServiceAvailabilityDraftEdit({}, { service: "ride", scope: "country", country: "ZW", state: "discover" });
  const draft = applyServiceAvailabilityDraftEdit(active, { service: "ride", scope: "country", country: "ZW", state: "live" });
  const impact = serviceAvailabilityImpact(active, draft);
  const zwCities = SPOTLY_COUNTRIES.find((item) => item.code === "ZW").cities.length;
  assert.equal(impact.changed, true);
  assert.equal(impact.summary.transactionsStarting, zwCities + 1);
  assert.ok(impact.runtimeChanges.every((item) => item.service === "ride" && item.country === "ZW"));
  const paused = applyServiceAvailabilityDraftEdit(draft, { service: "ride", scope: "country", country: "ZW", state: "paused" });
  assert.equal(serviceAvailabilityImpact(draft, paused).summary.transactionsStopping, zwCities + 1);
});

test("readiness blocks a changed marketplace scope from going live without commerce supply", () => {
  const active = applyServiceAvailabilityDraftEdit({}, { service: "eat", scope: "country", country: "MW", state: "preview" });
  const draft = applyServiceAvailabilityDraftEdit(active, { service: "eat", scope: "city", country: "MW", city: "Lilongwe", state: "live" });
  const impact = serviceAvailabilityImpact(active, draft);
  const readiness = buildServiceAvailabilityReadiness(draft, emptyFacts());
  const blockers = publishBlockersForImpact(readiness, impact);
  assert.ok(blockers.some((item) => item.service === "eat" && item.country === "MW" && item.city === "Lilongwe"));
});

test("Ride live readiness requires routing, scheduler, PIN, city geofence and Driver supply", () => {
  let config = applyServiceAvailabilityDraftEdit({}, { service: "ride", scope: "city", country: "ZW", city: "Harare", state: "live" });
  let readiness = buildServiceAvailabilityReadiness(config, emptyFacts());
  let row = readiness.countries.ZW.cities.harare.services.ride.readiness;
  for (const id of ["routing", "scheduler", "pin", "geofence", "drivers"]) assert.ok(row.checks.find((item) => item.id === id)?.blocking, id);

  const facts = emptyFacts();
  facts.mobility.ride = { enabledCountries: ["ZW"], countries: { ZW: { pricingReady: true, currency: "USD", paymentReady: true, paymentMethods: ["cash"] } }, routingReady: true, schedulerReady: true, pinReady: true, geofences: { "ZW:harare": true } };
  facts.drivers.ride = { ZW: { active: 1, cities: { harare: { active: 1 } } } };
  readiness = buildServiceAvailabilityReadiness(config, facts);
  row = readiness.countries.ZW.cities.harare.services.ride.readiness;
  assert.equal(row.blockers, 0);
});

test("Send Malawi launch is blocked until territory, pricing and payment readiness are explicit", () => {
  const config = applyServiceAvailabilityDraftEdit({}, { service: "send", scope: "city", country: "MW", city: "Lilongwe", state: "live" });
  const facts = emptyFacts();
  facts.mobility.send = { enabledCountries: [], countries: {}, routingReady: true, schedulerReady: true, pinReady: true, geofences: { "MW:lilongwe": true } };
  facts.drivers.send = { MW: { active: 1, cities: { lilongwe: { active: 1 } } } };
  let row = buildServiceAvailabilityReadiness(config, facts).countries.MW.cities.lilongwe.services.send.readiness;
  for (const id of ["territory", "pricing", "payments"]) assert.ok(row.checks.find((item) => item.id === id)?.blocking, id);
  facts.mobility.send.enabledCountries = ["MW"];
  facts.mobility.send.countries.MW = { pricingReady: true, currency: "MWK", paymentReady: true, paymentMethods: ["cash"] };
  row = buildServiceAvailabilityReadiness(config, facts).countries.MW.cities.lilongwe.services.send.readiness;
  assert.equal(row.blockers, 0);
});

test("revision API owns drafts, publication, stale protection and rollback history", () => {
  const route = source("app/api/admin/service-availability/route.js");
  const server = source("lib/service-availability-control-plane-server.js");
  assert.match(route, /reset_draft/);
  assert.match(route, /publish/);
  assert.match(route, /rollback/);
  assert.match(server, /serviceAvailabilityDrafts/);
  assert.match(server, /serviceAvailabilityRevisions/);
  assert.match(server, /stale_service_availability_draft/);
  assert.match(server, /kind: "rollback"/);
  assert.match(server, /sourceRevisionId/);
  assert.match(server, /transaction\.create\(revisionRef/);
  assert.match(server, /service_availability\.published/);
  assert.match(server, /service_availability\.rolled_back/);
});

test("generic settings and browser Firestore writes cannot bypass revision-owned availability", () => {
  const genericSettings = source("app/api/admin/settings/route.js");
  const clientSettings = source("lib/firebase-services.js");
  const rules = source("firestore.rules");
  for (const text of [genericSettings, clientSettings]) {
    assert.match(text, /serviceAvailabilityRevisionNumber/);
    assert.match(text, /serviceAvailabilityPublishedAt/);
  }
  assert.match(rules, /serviceAvailabilityDrafts/);
  assert.match(rules, /serviceAvailabilityRevisions/);
  assert.match(rules, /match \/platformSettings\/\{id\}[\s\S]*allow create, update, delete: if false/);
  assert.match(clientSettings, /authenticatedFetch\("\/api\/admin\/settings"/);
  assert.doesNotMatch(clientSettings, /setDoc\(doc\(db, "platformSettings"/);
  assert.match(rules, /allow read, write: if false/);
});

test("Admin Countries & Services exposes matrix, readiness, impact, publish, rollback and audit history", () => {
  const ui = source("components/admin-service-availability-control-plane.js");
  const app = source("components/admin-app.js");
  for (const label of ["Country × service matrix", "City overrides", "Readiness", "Impact preview", "Revisions & audit", "Publish", "Rollback"]) assert.match(ui, new RegExp(label.replace(/[×&]/g, "."), "i"), label);
  assert.match(app, /Countries & Services/);
  assert.match(app, /AdminServiceAvailabilityControlPlane/);
  assert.match(app, /value:"services"|value: "services"/);
});

test("old Mobility launch controls stage the shared draft instead of mutating published availability", () => {
  const launch = source("app/api/admin/service-launch/route.js");
  const rides = source("app/api/admin/rides/route.js");
  const parcels = source("app/api/admin/parcels/route.js");
  assert.match(launch, /editServiceAvailabilityDraft/);
  assert.match(launch, /availability_staged/);
  assert.doesNotMatch(launch, /serviceAvailability\s*:/);
  assert.doesNotMatch(rides, /ridesEnabled:\s*z\.boolean/);
  assert.doesNotMatch(parcels, /enabled:\s*z\.boolean\(\)\.optional\(\),routingVerified/);
  assert.match(rides, /publishedAvailability/);
  assert.match(parcels, /publishedAvailability/);
});

test("first revision baseline materializes legacy runtime so publishing cannot silently change live scopes", () => {
  const legacy = { mobility: { ridesEnabled: true, enabledCountries: ["ZW"], enabledCities: ["Harare"], send: { enabled: true, enabledCities: ["Bulawayo"] } } };
  const baseline = materializeServiceAvailabilityRuntimeConfig(legacy);
  const revisionOwned = { ...legacy, serviceAvailability: baseline, serviceAvailabilityRevisionNumber: 1 };
  for (const [service, country, city] of [["ride", "ZW", "Harare"], ["ride", "ZW", "Bulawayo"], ["send", "ZW", "Bulawayo"], ["send", "ZW", "Harare"], ["eat", "MW", "Lilongwe"]]) {
    assert.equal(
      resolveServiceAvailability(revisionOwned, { service, country, city }).state,
      resolveServiceAvailability(legacy, { service, country, city }).state,
      `${service}/${country}/${city}`
    );
  }
});

test("published revisions suppress legacy Ride/Send enable switches while preserving bootstrap inheritance", () => {
  const legacy = { mobility: { ridesEnabled: true, enabledCountries: ["ZW"], enabledCities: ["Harare"], send: { enabled: true, enabledCities: ["Harare"] } } };
  assert.equal(resolveServiceAvailability(legacy, { service: "ride", country: "ZW", city: "Harare" }).state, "live");
  const revisionOwned = { ...legacy, serviceAvailability: { version: "1.0.0", services: {} }, serviceAvailabilityRevisionNumber: 1 };
  assert.equal(resolveServiceAvailability(revisionOwned, { service: "ride", country: "ZW", city: "Harare" }).state, "discover");
  assert.equal(resolveServiceAvailability(revisionOwned, { service: "send", country: "ZW", city: "Harare" }).state, "discover");
});

test("all clients receive revisioned published truth through the existing availability endpoints", () => {
  const publicRoute = source("app/api/public/service-availability/route.js");
  const functions = source("firebase/functions/src/index.js");
  assert.match(publicRoute, /revision/);
  assert.match(publicRoute, /serviceAvailabilityRevisionNumber/);
  assert.match(functions, /revision/);
  assert.match(functions, /serviceAvailabilityRevisionNumber/);
});

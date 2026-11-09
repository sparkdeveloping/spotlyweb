import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  resolveServiceAvailability,
  serviceAvailabilityCapabilities,
  serviceAvailabilityCityKey
} from "../lib/service-availability.js";

const root = process.cwd();
const source = (path) => readFileSync(resolve(root, path), "utf8");
const manifest = JSON.parse(source("contracts/spotly-service-availability.v1.json"));

test("service availability contract defines exactly five runtime states with distinct capabilities", () => {
  assert.deepEqual(Object.keys(manifest.states), ["hidden", "preview", "discover", "live", "paused"]);
  assert.deepEqual(serviceAvailabilityCapabilities("hidden"), { state: "hidden", visible: false, discoverable: false, transactable: false, paused: false });
  assert.deepEqual(serviceAvailabilityCapabilities("preview"), { state: "preview", visible: true, discoverable: false, transactable: false, paused: false });
  assert.deepEqual(serviceAvailabilityCapabilities("discover"), { state: "discover", visible: true, discoverable: true, transactable: false, paused: false });
  assert.deepEqual(serviceAvailabilityCapabilities("live"), { state: "live", visible: true, discoverable: true, transactable: true, paused: false });
  assert.deepEqual(serviceAvailabilityCapabilities("paused"), { state: "paused", visible: true, discoverable: true, transactable: false, paused: true });
});

test("one resolver applies city then country then service then canonical bootstrap precedence", () => {
  const settings = { serviceAvailability: { services: { ride: {
    defaultState: "hidden",
    countries: { ZW: { state: "preview", reason: "Country preview" } },
    cities: { "ZW:harare": { state: "live", reason: "Harare pilot" } }
  } } } };
  const harare = resolveServiceAvailability(settings, { service: "ride", country: "ZW", city: "Harare" });
  const bulawayo = resolveServiceAvailability(settings, { service: "ride", country: "ZW", city: "Bulawayo" });
  const lilongwe = resolveServiceAvailability(settings, { service: "ride", country: "MW", city: "Lilongwe" });
  assert.equal(harare.state, "live"); assert.equal(harare.source, "city"); assert.equal(harare.reason, "Harare pilot");
  assert.equal(bulawayo.state, "preview"); assert.equal(bulawayo.source, "country");
  assert.equal(lilongwe.state, "hidden"); assert.equal(lilongwe.source, "service");
  assert.equal(resolveServiceAvailability({}, { service: "eat", country: "ZW", city: "Harare" }).source, "bootstrap");
});

test("canonical bootstrap keeps Zimbabwe commerce discoverable while Malawi and Send remain intentionally staged", () => {
  const expected = {
    ZW: { eat: "live", shop: "live", ride: "discover", book: "live", events: "live", send: "discover" },
    MW: { eat: "preview", shop: "preview", ride: "preview", book: "preview", events: "preview", send: "hidden" }
  };
  for (const [country, services] of Object.entries(expected)) {
    for (const [service, state] of Object.entries(services)) {
      assert.equal(resolveServiceAvailability({}, { service, country }).state, state, `${service}/${country}`);
    }
  }
});

test("paused stays discoverable for continuity but can never create new transactions", () => {
  const settings = { serviceAvailability: { services: { eat: { countries: { ZW: { state: "paused", reason: "Temporary pause" } } } } } };
  const decision = resolveServiceAvailability(settings, { service: "eat", country: "ZW", city: "Harare" });
  assert.equal(decision.visible, true);
  assert.equal(decision.discoverable, true);
  assert.equal(decision.transactable, false);
  assert.equal(decision.paused, true);
  assert.equal(decision.reason, "Temporary pause");
});

test("city keys are country-bound and never manufacture a Harare fallback", () => {
  assert.equal(serviceAvailabilityCityKey("ZW", "Harare"), "ZW:harare");
  assert.equal(serviceAvailabilityCityKey("MW", "Lilongwe"), "MW:lilongwe");
  assert.equal(serviceAvailabilityCityKey("MW", "Harare"), "MW:harare");
  assert.equal(serviceAvailabilityCityKey(null, "Harare"), null);
  assert.equal(resolveServiceAvailability({}, { service: "ride", country: "MW" }).city, "");
});

test("legacy Ride and Send launch controls migrate through the central resolver until explicit configuration exists", () => {
  const settings = { mobility: {
    ridesEnabled: true, enabledCountries: ["ZW"], enabledCities: ["Harare"],
    send: { enabled: true, enabledCities: ["Bulawayo"] }
  } };
  assert.equal(resolveServiceAvailability(settings, { service: "ride", country: "ZW", city: "Harare" }).state, "live");
  assert.equal(resolveServiceAvailability(settings, { service: "ride", country: "ZW", city: "Bulawayo" }).state, "discover");
  assert.equal(resolveServiceAvailability(settings, { service: "send", country: "ZW", city: "Bulawayo" }).state, "live");
  assert.equal(resolveServiceAvailability(settings, { service: "send", country: "ZW", city: "Harare" }).state, "discover");
  settings.serviceAvailability = { services: { ride: { cities: { "ZW:harare": { state: "paused" } } } } };
  assert.equal(resolveServiceAvailability(settings, { service: "ride", country: "ZW", city: "Harare" }).state, "paused");
});

test("new customer transactions are enforced by the service engine at every backend boundary", () => {
  const liveRoutes = [
    "app/api/orders/create/route.js",
    "app/api/customer/transactions/create/route.js",
    "app/api/customer/rides/route.js",
    "app/api/customer/parcels/route.js"
  ];
  for (const path of liveRoutes) assert.match(source(path), /requireServiceLive/, path);
  for (const path of ["app/api/customer/assist-bookings/route.js", "app/api/customer/independent-shopping/requests/route.js"]) {
    assert.match(source(path), /resolveServiceAvailability/, path);
    assert.match(source(path), /transactable/, path);
  }
  for (const path of ["app/api/customer/rides/quote/route.js", "app/api/customer/parcels/quote/route.js", "app/api/public/service-feed/route.js", "app/api/public/search/route.js"]) {
    assert.match(source(path), /requireServiceDiscoverable/, path);
  }
  assert.doesNotMatch(source("lib/ride-server.js"), /if\s*\(!config\.enabled\)/);
  assert.doesNotMatch(source("lib/parcel-server.js"), /if\s*\(!config\.enabled\)/);
  for (const path of ["components/marketplace-app.js", "components/ride-app.js", "components/send-app.js"]) assert.match(source(path), /resolveServiceAvailability/, path);
  assert.match(source("app/api/public/marketplace/business/route.js"), /serviceAvailability\.discoverable/);
  assert.match(source("app/api/public/independent-shopping/route.js"), /availabilityFor/);
});

test("configuration remains service/country/city scoped while Mobility launch stages the revision-owned draft", () => {
  const admin = source("app/api/admin/service-availability/route.js");
  const launch = source("app/api/admin/service-launch/route.js");
  assert.match(admin, /z\.enum\(\["service", "country", "city"\]\)/);
  assert.match(admin, /z\.enum\(\["hidden", "preview", "discover", "live", "paused", "inherit"\]\)/);
  assert.match(admin, /publishServiceAvailabilityDraft/);
  assert.match(admin, /rollbackServiceAvailability/);
  assert.match(launch, /editServiceAvailabilityDraft/);
  assert.doesNotMatch(launch, /serviceAvailability\s*:/);
});

test("Firebase callable and client contract hashes expose the same runtime decision engine to native apps", () => {
  const functions = source("firebase/functions/src/index.js");
  const platform = source("firebase/functions/src/core/platform.js");
  const client = source("lib/firebase-platform.js");
  assert.match(functions, /export const serviceAvailability = defineCallable/);
  assert.match(functions, /resolveServiceAvailabilitySet/);
  assert.match(platform, /SPOTLY_SERVICE_AVAILABILITY_CONTRACT_SHA256/);
  assert.match(client, /SPOTLY_SERVICE_AVAILABILITY_CONTRACT_SHA256/);
});

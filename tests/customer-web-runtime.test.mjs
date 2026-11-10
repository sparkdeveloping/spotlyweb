import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  customerServiceDecision,
  normalizeCustomerRuntimeLocation,
  resolveCustomerRuntime
} from "../lib/customer-runtime.js";

const root = process.cwd();
const source = (path) => readFileSync(resolve(root, path), "utf8");

function hiddenRideSettings() {
  return {
    serviceAvailabilityRevisionNumber: 3,
    serviceAvailability: {
      services: {
        ride: {
          defaultState: "hidden",
          countries: { MW: { state: "hidden" } },
          cities: { "MW:lilongwe": { state: "hidden" } }
        }
      }
    }
  };
}

const futureGrant = (type) => ({
  status: "active",
  type,
  services: ["ride"],
  countries: ["MW"],
  cities: ["MW:lilongwe"],
  expiresAt: "2099-01-01T00:00:00.000Z"
});

test("customer runtime composes one service map from country and city availability", () => {
  const runtime = resolveCustomerRuntime({}, { country: "ZW", city: "Harare" });
  assert.equal(runtime.countryCode, "ZW");
  assert.equal(runtime.city, "Harare");
  assert.equal(runtime.services.eat.state, "live");
  assert.equal(runtime.services.ride.state, "discover");
  assert.equal(runtime.services.send.state, "discover");
  assert.deepEqual(runtime.transactableServices.sort(), ["book", "eat", "events", "shop"].sort());
});

test("service preview grants can expose a hidden shell but cannot make it public or transactional", () => {
  const decision = customerServiceDecision(hiddenRideSettings(), {
    service: "ride",
    country: "MW",
    city: "Lilongwe",
    grants: [futureGrant("service_preview")]
  });
  assert.equal(decision.state, "hidden");
  assert.equal(decision.publicVisible, false);
  assert.equal(decision.publicDiscoverable, false);
  assert.equal(decision.visible, true);
  assert.equal(decision.discoverable, true);
  assert.equal(decision.transactable, false);
  assert.equal(decision.previewGranted, true);
  assert.equal(decision.indexable, false);
  assert.equal(decision.accessSource, "operations_grant");
});

test("payment sandbox alone never changes service visibility or transaction availability", () => {
  const decision = customerServiceDecision(hiddenRideSettings(), {
    service: "ride",
    country: "MW",
    city: "Lilongwe",
    grants: [futureGrant("payment_sandbox")]
  });
  assert.equal(decision.visible, false);
  assert.equal(decision.discoverable, false);
  assert.equal(decision.transactable, false);
  assert.equal(decision.previewGranted, false);
  assert.equal(decision.operations.paymentSandbox, true);
});

test("customer location normalization rejects cross-country city drift and can infer country from a canonical city", () => {
  const mismatch = normalizeCustomerRuntimeLocation({ country: "MW", city: "Harare" });
  assert.equal(mismatch.countryCode, "MW");
  assert.equal(mismatch.city, "");
  assert.equal(mismatch.cityValid, false);
  const inferred = normalizeCustomerRuntimeLocation({ city: "Harare" });
  assert.equal(inferred.countryCode, "ZW");
  assert.equal(inferred.city, "Harare");
  assert.equal(inferred.inferredCountry, true);
});

test("Marketplace Home uses the central customer runtime and falls back to the active launch market only when location is empty", () => {
  const marketplace = source("components/marketplace-app.js");
  assert.match(marketplace, /useCustomerRuntime/);
  assert.match(marketplace, /serviceAvailability = customerRuntime\.services/);
  assert.match(marketplace, /settings\?\.launch\?\.supportedCountries\?\.\[0\]/);
  assert.match(marketplace, /settings\?\.launch\?\.primaryCity/);
  assert.match(marketplace, /countryDefinition\(configuredCountry\)\?\.cities\?\.\[0\]\?\.name/);
  assert.match(marketplace, /useCustomerRuntime\(\{ country: configuredCountry, city: location\.city \|\| launchFallbackCity \}\)/);
  assert.match(marketplace, /searchLiveBusinesses\(query, 100, \{ country: availabilityCountry, city: location\.city \}\)/);
  assert.match(marketplace, /searchSpotly\(term, 60, \{ country: availabilityCountry, city: location\.city, service \}\)/);
  assert.match(marketplace, /selectedScopeCountry/);
  assert.match(marketplace, /customerServiceDecision\(settings, \{ service: selectedService, country: selectedScopeCountry, city: selectedScopeCity, grants: customerRuntime\.grants \}\)/);
  assert.match(marketplace, /!customerRuntime\.ready/);
});

test("customer API clients and public discovery routes carry canonical country scope", () => {
  const services = source("lib/firebase-services.js");
  const marketplace = source("app/api/public/marketplace/route.js");
  const search = source("app/api/public/search/route.js");
  const feed = source("app/api/public/service-feed/route.js");
  const businessDetail = source("app/api/public/marketplace/business/route.js");
  assert.match(services, /params\.set\("country", String\(options\.country\)\)/);
  assert.match(marketplace, /requiresLocation: true/);
  assert.match(marketplace, /resolveServiceAvailability/);
  assert.match(search, /requiresLocation:true/);
  assert.match(search, /countryForCity\(recordCity\)/);
  assert.match(search, /publicCanonicalProduct\(product\),country,city/);
  assert.match(feed, /requiresLocation: true/);
  assert.match(feed, /requireServiceDiscoverable\(platformSettings, \{ service, country, city \}\)/);
  assert.match(businessDetail, /city,country/);
  assert.match(businessDetail, /country:business\.country\|\|sourceCountry/);
});

test("service navigation and Search only surface services allowed by the composed runtime", () => {
  const identity = source("components/service-identity.js");
  const ride = source("components/ride-app.js");
  const send = source("components/send-app.js");
  const utility = source("components/customer-utility.js");
  const experience = source("components/service-experience.js");
  assert.match(identity, /serviceRuntime\?\.\[key\]\?\.visible !== false/);
  assert.match(utility, /serviceAvailability\[item\.service\]\?\.discoverable !== false/);
  assert.match(experience, /publicDiscoverable === false/);
  assert.match(experience, /Operations preview/);
  assert.match(ride, /!customerRuntime\.ready/);
  assert.match(ride, /disabled=\{countryContext\.locked\}/);
  assert.match(ride, /countryContext\.selectCountry/);
  assert.match(send, /!customerRuntime\.ready/);
  assert.match(send, /countryContext\.locked\?countryContext\.countryCode/);
});

test("Home recommendations are filtered by the runtime and only live services claim readiness", () => {
  const home = source("components/marketplace-home.js");
  assert.match(home, /runtimeResults/);
  assert.match(home, /recentBusinessIds\.map\(\(id\) => runtimeResults\.find/);
  assert.match(home, /serviceAvailability\[service\]\?\.discoverable !== false/);
  assert.match(home, /serviceAvailability\[service\]\?\.transactable === true/);
  assert.match(home, /Operations preview/);
});

test("city routes and sitemap derive countries services and indexability from the published runtime", () => {
  const city = source("app/city/[city]/[service]/page.js");
  const sitemap = source("app/sitemap.js");
  const server = source("lib/customer-runtime-server.js");
  assert.match(city, /resolveCanonicalCityRoute/);
  assert.match(city, /route\.country\.code/);
  assert.match(city, /route\.availability\.indexable/);
  assert.match(sitemap, /getPublicCustomerSitemapRoutes/);
  assert.match(sitemap, /runtimeRoutes\.serviceRoutes/);
  assert.match(sitemap, /runtimeRoutes\.cityRoutes/);
  assert.match(sitemap, /revalidate = 300/);
  assert.match(server, /for \(const country of SPOTLY_COUNTRIES\)/);
  assert.match(server, /publicDiscoverable/);
  assert.doesNotMatch(sitemap, /Harare|Zimbabwe|Bulawayo/);
  for (const page of ["bite", "shopper", "book", "live", "ride", "send"]) assert.match(source(`app/${page}/page.js`), /revalidate = 300/);
});

test("public SEO and canonical deep links never advertise transactions outside live availability", () => {
  const seo = source("lib/public-seo-server.js");
  const place = source("app/place/[id]/page.js");
  const item = source("app/item/[id]/page.js");
  const publicRecords = source("lib/marketplace-public.js");
  assert.match(seo, /resolveServiceAvailability/);
  assert.match(seo, /transactable: business\.serviceAvailability\?\.transactable === true/);
  assert.match(place, /addressCountry: business\.country \|\| undefined/);
  assert.match(item, /item\.price !== null && item\.transactable/);
  assert.match(publicRecords, /href: `\/item\/\$\{encodeURIComponent\(id\)\}`/);
  assert.doesNotMatch(publicRecords, /\?item=/);
});


test("root Home metadata follows public launch mode and published runtime instead of staying permanently First Access", () => {
  const page = source("app/page.js");
  assert.match(page, /getPublishedCustomerSettings/);
  assert.match(page, /getPublicCustomerSitemapRoutes/);
  assert.match(page, /publicMode/);
  assert.match(page, /routes\.serviceRoutes/);
  assert.match(page, /revalidate = 300/);
  assert.doesNotMatch(page, /export const metadata =/);
});

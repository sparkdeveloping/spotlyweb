import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { routeHarness } from "./helpers/route-harness.mjs";

const root = process.cwd();
const source = (file) => readFileSync(join(root, file), "utf8");

test("C1: live Driver endpoint is authenticated and uses the same owner-scoped work projection as full bootstrap", async () => {
  const h = routeHarness(root);
  const driverId = "driver-one";
  h.setActor({ uid: driverId, email: "driver@example.com" });
  h.records.set(`driverApplications/${driverId}`, { status: "approved", requestedCapabilities: ["prepared_delivery"], country: "ZW" });
  h.records.set(`drivers/${driverId}`, { status: "approved", country: "ZW" });
  h.records.set(`driverPresence/${driverId}`, { online: true, currentLocation: { lat: -17.8, lng: 31 }, locationUpdatedAt: new Date().toISOString() });
  h.records.set(`driverVehicles/${driverId}_primary`, { driverId, type: "bicycle", status: "approved" });
  h.records.set(`driverPayoutAccounts/${driverId}`, { verificationState: "verified" });
  h.records.set(`deliveryJobs/job-one`, { assignedDriverId: driverId, state: "driver_to_pickup", pickupCode: "1234", customerPin: "9999", orderId: "order-a" });
  h.records.set(`deliveryJobs/job-other`, { assignedDriverId: "driver-two", state: "driver_to_pickup", pickupCode: "7777" });
  h.records.set(`rideTrips/ride-one`, { assignedDriverId: driverId, state: "in_trip", pickupPin: "5678" });
  h.records.set(`parcelJobs/parcel-one`, { assignedDriverId: driverId, state: "en_route", pickupPin: "1111", dropoffPin: "2222" });
  const liveRoute = h.load("app/api/driver/live/route.js");
  const fullRoute = h.load("app/api/driver/bootstrap/route.js");
  const liveResponse = await liveRoute.GET(new Request("https://driver.spotlyafrica.com/api/driver/live"));
  const fullResponse = await fullRoute.GET(new Request("https://driver.spotlyafrica.com/api/driver/bootstrap"));
  assert.equal(liveResponse.status, 200, await liveResponse.clone().text());
  assert.equal(fullResponse.status, 200, await fullResponse.clone().text());
  const live = await liveResponse.json();
  const full = await fullResponse.json();
  for (const key of ["presence", "offers", "rideOffers", "parcelOffers", "activeJob", "activeRide", "activeParcel", "jobs", "rides", "parcels"]) {
    assert.deepEqual(live[key], full[key], `same ${key} contract`);
  }
  assert.equal(live.jobs.length, 1);
  assert.equal(live.jobs[0].id, "job-one");
  assert.ok(!JSON.stringify(live).includes("9999"));
  assert.ok(!JSON.stringify(live).includes("5678"));
  assert.ok(!JSON.stringify(live).includes("2222"));
  assert.ok(!JSON.stringify(live).includes("7777"));
  assert.equal(liveResponse.headers.get("Cache-Control"), "private, no-store");
  assert.equal(full.driver.id, driverId);
  assert.equal(Object.hasOwn(live, "earnings"), false, "live loop does not fetch static money history");
  assert.ok(Object.hasOwn(full, "earnings"), "full bootstrap retains money history");
});

test("C1: driver polling preserves 10-second foreground offers, slower static refresh and legacy rollback", () => {
  const component = source("components/driver-app.js");
  assert.match(component, /NEXT_PUBLIC_SPOTLY_DRIVER_SPLIT_POLLING !== "false"/);
  assert.match(component, /\/api\/driver\/live/);
  assert.match(component, /hidden \? 30_000 : 10_000/);
  assert.match(component, /hidden \? 300_000 : 60_000/);
  assert.match(component, /splitUnavailable\.current = true/);
  assert.match(component, /\/api\/driver\/bootstrap/);
});

test("C2: shared feed is opt-in, public-only, explicitly bounded and has a regular query fallback", () => {
  const feed = source("app/api/public/service-feed/route.js");
  assert.match(feed, /SPOTLY_SHARED_SERVICE_FEED_CACHE === "true"/);
  assert.match(feed, /const availability = requireServiceDiscoverable/);
  assert.match(feed, /const showUnclaimed = await unclaimedPublicationEnabled/);
  assert.match(feed, /!query && !area/);
  assert.match(feed, /!feed\) feed = await computePublicServiceFeed/);
  assert.match(feed, /revalidate: 20/);
});

test("C0: telemetry is opt-in, samples by rate and cannot log request/user identifiers", () => {
  const logs = source("lib/cost-observability-server.js");
  assert.match(logs, /SPOTLY_COST_TELEMETRY !== "true"/);
  assert.match(logs, /Math\.random\(\) >= sampleRate/);
  assert.match(logs, /const ROUTES = new Set/);
  assert.doesNotMatch(logs, /request\.headers|\.uid|\.email|\.ipAddress/);
});

test("C0: billing CSV parser aggregates services and SKUs without network access", async () => {
  const { summarizeBillingCsv } = await import("../scripts/firebase-cost-report.mjs");
  const csv = 'Service,SKU,Cost\r\n"Cloud Firestore","Document reads",0.015\r\n"Cloud Firestore","Document writes",0.008\r\n"Cloud Functions","Requests",0.04\r\n"Cloud Firestore","Document reads",0.005\r\n';
  const report = summarizeBillingCsv(csv);
  assert.equal(report.billedRows, 4);
  assert.equal(report.totalCost, 0.068);
  assert.equal(report.services[0].name, "Cloud Functions");
  assert.equal(report.skus.find((row) => row.name.includes("Document reads")).cost, 0.02);
  assert.throws(() => summarizeBillingCsv("Name,Total\nfoo,12"), /Service, SKU, and Cost/);
});

test("C2: eligible public feed output is identical with shared cache disabled and enabled", async () => {
  const oldFlag = process.env.SPOTLY_SHARED_SERVICE_FEED_CACHE;
  try {
    const fetchFeed = async (enabled) => {
      process.env.SPOTLY_SHARED_SERVICE_FEED_CACHE = enabled ? "true" : "false";
      const h = routeHarness(root);
      h.records.set("platformSettings/global", { independentShopping: { browseEnabled: false } });
      h.records.set("businesses/store-one", {
        name: "Test Store", public: true, country: "ZW", city: "Harare", status: "active",
        ownershipStatus: "claimed", verificationStatus: "verified", commerceVerified: true,
        businessType: "grocery_retail", category: "supermarket"
      });
      h.records.set("products/item-one", { businessId: "store-one", name: "Bread", published: true, itemType: "product", price: 1 });
      const feed = h.load("app/api/public/service-feed/route.js");
      const response = await feed.GET(new Request("https://spotly.example/api/public/service-feed?service=shop&city=Harare&limit=24"));
      assert.equal(response.status, 200, await response.clone().text());
      return response.json();
    };
    assert.deepEqual(await fetchFeed(false), await fetchFeed(true));
  } finally {
    if (oldFlag == null) delete process.env.SPOTLY_SHARED_SERVICE_FEED_CACHE;
    else process.env.SPOTLY_SHARED_SERVICE_FEED_CACHE = oldFlag;
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { marketplaceTier, rankMarketplaceBusinesses } from "../lib/marketplace-ranking.js";
import { marketplaceMedia } from "../lib/marketplace-editorial.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("real commerce takes priority over stale popularity, ratings or paid featured flags", () => {
  const ranked = rankMarketplaceBusinesses([
    { id: "directory", name: "Famous Directory", isFeatured: true, rating: 5, reviewCount: 50000, public: true, source: { rightsStatus: "open_odbl" } },
    { id: "merchant", name: "Real Merchant", public: true, commerceVerified: true, businessType: "restaurant_food", status: "active" },
    { id: "verified", name: "Verified Directory", public: true, verificationStatus: "approved" },
    { id: "assist", name: "Assist Verified", public: true, spotlyAssistEnabled: true }
  ]);
  assert.deepEqual(ranked.map((x) => x.id), ["merchant", "assist", "verified", "directory"]);
  assert.equal(marketplaceTier({ public: true, source: { type: "spotly_assist_research" } }), 1, "research imports alone do not prove Assist availability");
  assert.equal(marketplaceTier({ assistStoreId: "real-assist-store", assistAccepting: true }), 3, "a working Assist handoff outranks passive listings");
  assert.equal(marketplaceTier({ assistStoreId: "closed-assist-store", assistAccepting: false }), 1, "disabled Assist availability must not be promoted");
});

test("no editorial images point to unshipped assets, and generic directory logos cannot impersonate merchants", () => {
  const food = marketplaceMedia({ id: "cafe", category: "Restaurants", businessType: "restaurant_food" });
  assert.equal(food.family, "restaurant-interior");
  assert.match(food.src, /\/marketplace\/photography\/restaurant-interior-768\.webp$/);
  assert.equal(food.kind, "editorial");
  const research = marketplaceMedia({ name: "Brand", source: { type: "spotly_assist_research" }, logoUrl: "https://example.com/logo.png" });
  assert.notEqual(research.kind, "merchant");
  assert.ok(!research.src.includes("editorial-pack"));
});

test("Driver bootstrap waits for authenticated session and does not show a transient false error", async () => {
  const [driver, api] = await Promise.all([read("components/driver-app.js"), read("lib/api-client.js")]);
  assert.match(driver, /if \(!authReady \|\| !user\?\.uid \|\| user\.isAnonymous\) return/);
  assert.match(driver, /setData\(next\); setError\(""/);
  assert.match(api, /await client\.auth\.authStateReady\(\)/);
});

test("all failed authenticated mutations produce a visible fixed-screen notification", async () => {
  const [api, providers] = await Promise.all([read("lib/api-client.js"), read("components/providers.js")]);
  assert.match(api, /spotly:action-error/);
  assert.match(api, /options\.method/);
  assert.match(providers, /bottom-4/);
  assert.match(providers, /aria-live=\{item\.type === "error" \? "assertive"/);
});

test("Ride booking is guided through pickup, destination, vehicle and review, with real quotes", async () => {
  const ride = await read("components/ride-app.js");
  assert.match(ride, /bookingStep===0/);
  assert.match(ride, /bookingStep===1/);
  assert.match(ride, /bookingStep===2/);
  assert.match(ride, /bookingStep===3/);
  assert.match(ride, /setBookingStep\(3\)/);
  assert.match(ride, /quoteFetch\("\/api\/customer\/rides\/quote"/);
  assert.match(ride, /quote\.bookingAvailable===true/);
  assert.match(ride, /PinDropMap/);
});

test("Operations access uses scoped account grants and never simulated Driver GPS", async () => {
  const [grants, driver, dashboard] = await Promise.all([
    read("app/api/admin/operations-grants/route.js"), read("app/api/operations/rides/route.js"), read("components/admin-mobility-launch.js")
  ]);
  assert.match(grants, /operationGrants/);
  assert.match(grants, /operations_grant\.issued/);
  assert.match(driver, /driver_operations/);
  assert.match(driver, /operationsRuns/);
  assert.doesNotMatch(driver, /db\.collection\("driverPresence"\)/);
  assert.doesNotMatch(driver, /db\.collection\("rideTrips"\)/);
  assert.match(dashboard, /Operations grants/);
});

test("Admin capability cards use a legible two-column layout, not four cards across a cramped detail pane", async () => {
  const source = await read("components/admin-driver-operations.js");
  const start = source.indexOf('title="Work capabilities"');
  assert.ok(start >= 0);
  assert.match(source.slice(start, start + 300), /md:grid-cols-2/);
  assert.doesNotMatch(source.slice(start, start + 300), /xl:grid-cols-4/);
});

test("directory cards use described photographs and preserve the real Assist handoff", async () => {
  const [cover, home, service, app] = await Promise.all([
    read("components/business-photo.js"),
    read("components/marketplace-home.js"),
    read("components/service-experience.js"),
    read("components/marketplace-app.js")
  ]);
  assert.match(cover, /Illustrative photo/);
  for (const source of [home, service, app]) assert.match(source, /BusinessPhoto/);
  assert.match(home, /assistStoreId/);
  assert.match(home, /onOpen\(business\)/);
  assert.match(app, /AssistCatalogue/);
  assert.match(home, /Illustrative photographs are identified/);
});

test("Operations Ride supports isolated two-account requests and real state transitions", async () => {
  const [route, rider, driver] = await Promise.all([
    read("app/api/operations/rides/route.js"),
    read("components/ride-app.js"),
    read("components/driver-app.js")
  ]);
  assert.match(route, /service_operations/);
  assert.match(route, /driver_operations/);
  assert.match(route, /operationsRuns/);
  assert.match(route, /data\.customerId===user\.uid/);
  assert.match(route, /driver_assigned:\s*"driver_to_pickup"/);
  assert.match(route, /driver_arrived_pickup:\s*"in_trip"/);
  assert.match(route, /in_trip:\s*"completed"/);
  assert.match(route, /validateOperationsRideLocations/);
  assert.match(route, /enforceRateLimit/);
  for (const liveCollection of ["rideTrips", "rideOffers", "driverPresence", "driverEarningsLedger"]) {
    assert.doesNotMatch(route, new RegExp(`db\\.collection\\("${liveCollection}"\\)`));
  }
  assert.match(driver, /Operations/);
  assert.match(driver, /\/api\/operations\/rides/);
  assert.match(rider, /Operations mode/);
  assert.match(rider, /\/api\/operations\/rides/);
});

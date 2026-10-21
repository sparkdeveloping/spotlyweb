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
});

test("no editorial images point to unshipped assets, and generic directory logos cannot impersonate merchants", () => {
  const food = marketplaceMedia({ id: "cafe", category: "Restaurants", businessType: "restaurant_food" });
  assert.equal(food.src, "/marketplace/editorial/eat.webp");
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
  assert.match(ride, /authenticatedFetch\("\/api\/customer\/rides\/quote"/);
  assert.match(ride, /quote\.bookingAvailable===true/);
  assert.match(ride, /PinDropMap/);
});

test("Admin Ride Lab access requires approved staff roles and verified invited email; positions never touch live GPS", async () => {
  const [admin, driver, dashboard] = await Promise.all([
    read("app/api/admin/ride-lab/route.js"), read("app/api/driver/ride-lab/route.js"), read("components/admin-mobility-launch.js")
  ]);
  assert.match(admin, /authenticateRequest\(request, \{ roles: ROLES \}\)/);
  assert.match(admin, /testerEmails/);
  assert.match(driver, /user\.email_verified !== true/);
  assert.match(driver, /mobilityRideLabLocations/);
  assert.doesNotMatch(driver, /db\.collection\("driverPresence"\)/);
  assert.doesNotMatch(driver, /db\.collection\("rideTrips"\)/);
  assert.match(dashboard, /Save Ride Lab invitations/);
});

test("Admin capability cards use a legible two-column layout, not four cards across a cramped detail pane", async () => {
  const source = await read("components/admin-driver-operations.js");
  const start = source.indexOf('title="Work capabilities"');
  assert.ok(start >= 0);
  assert.match(source.slice(start, start + 300), /md:grid-cols-2/);
  assert.doesNotMatch(source.slice(start, start + 300), /xl:grid-cols-4/);
});

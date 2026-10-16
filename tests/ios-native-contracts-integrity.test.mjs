import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { marketplaceProfile } from "../lib/marketplace-taxonomy.js";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("Eat taxonomy uses word boundaries so barber never becomes bar", () => {
  assert.equal(marketplaceProfile({ name: "Westgate Barber Shop", category: "Barber" }).service, "book");
  assert.equal(marketplaceProfile({ name: "B&B Sports Bar", category: "Nightlife" }).service, "eat");
  assert.equal(marketplaceProfile({ name: "Downtown Bar", category: "Bar" }).service, "eat");
  assert.equal(marketplaceProfile({ name: "Harare Beauty Spa", category: "Beauty & Wellness" }).service, "book");
  assert.equal(marketplaceProfile({ name: "City Pharmacy", category: "Health" }).service, "shop");
});

test("native batch marketplace route exists and returns unavailable IDs", () => {
  const source = read("app/api/public/marketplace/businesses/route.js");
  assert.match(source, /businesses/);
  assert.match(source, /unavailableIDs/);
  assert.match(source, /slice\(0, 50\)/);
  assert.match(source, /isMarketplaceDiscoverable/);
});

test("native customer Activity route aggregates orders rides and sends", () => {
  const source = read("app/api/customer/activity/route.js");
  assert.match(source, /collection\("orders"\)/);
  assert.match(source, /collection\("rideTrips"\)/);
  assert.match(source, /collection\("parcelJobs"\)/);
  assert.match(source, /transactionType/);
  assert.match(source, /nextOffset/);
  assert.match(source, /kind: "ride"/);
  assert.match(source, /kind: "send"/);
});

test("service feed derives canonical customer categories from central taxonomy", () => {
  const source = read("app/api/public/service-feed/route.js");
  assert.match(source, /marketplaceProfile\(business\)\.displayCategory/);
});

test("open marketplace deduplication keeps same-name nearby OSM features as one place", () => {
  const source = read("lib/open-marketplace-data.js");
  assert.match(source, /distanceMeters\(candidate, place\) <= 150/);
  assert.match(source, /dedupeOpenPlaces\(openPlaces\(\)\.filter/);
});

test("customer account deletion initiation contract exists and records requested state", () => {
  const source = read("app/api/customer/account/deletion/route.js");
  assert.match(source, /accountDeletionRequests/);
  assert.match(source, /status: "requested"/);
  assert.match(source, /activeRideCount/);
  assert.match(source, /activeParcelCount/);
  assert.match(source, /activeOrderCount/);
});

test("operational push delivery is strictly scoped to the target workspace", () => {
  const dispatcher = read("lib/notification-server.js");
  const manualPush = read("app/api/notifications/push/route.js");
  assert.match(dispatcher, /item\.workspace/);
  assert.match(dispatcher, /item\.workspace === notification\.workspace/);
  assert.doesNotMatch(dispatcher, /workspaceMatches\.length \? workspaceMatches : entries/);
  assert.match(manualPush, /data\.workspace === body\.workspace/);
  assert.match(manualPush, /workspace: body\.workspace/);
});

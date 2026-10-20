import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Ride customer request is server-authoritative and creates Activity continuity", async () => {
  const source = await read("app/api/customer/rides/route.js");
  assert.match(source, /rideAvailability\(settings, pickup\)/);
  assert.match(source, /paymentMethods\.includes\(body\.paymentMethod\)/);
  assert.match(source, /transaction\.create\(rideRef/);
  assert.match(source, /transaction\.create\(orderRef/);
  assert.match(source, /transactionType: "ride"/);
  assert.match(source, /businessName: "Spotly Ride"/);
  assert.match(source, /where\("state", "in", \["requested", "searching_driver"/);
});

test("Ride pricing and area rollout are controlled by platform mobility settings", async () => {
  const source = await read("lib/ride-server.js");
  assert.match(source, /enabledCities/);
  assert.match(source, /enabledAreas/);
  assert.match(source, /rideAvailability/);
  assert.match(source, /baseFare/);
  assert.match(source, /perKm/);
  assert.match(source, /perMinute/);
  assert.match(source, /driverSharePercent/);
  assert.match(source, /paymentMethods/);
});

test("Ride dispatch only offers eligible nearby Drivers and expires offers", async () => {
  const source = await read("lib/ride-server.js");
  assert.match(source, /operationalEligibility/);
  assert.match(source, /locationUpdatedAt/);
  assert.match(source, /maxPickupKm/);
  assert.match(source, /pickupDistanceKm/);
  assert.match(source, /state: "expired"/);
  assert.match(source, /rideOffers/);
  assert.match(source, /Ride available/);
});

test("Ride offer acceptance is atomic and reserves the Driver", async () => {
  const source = await read("app/api/driver/ride-offers/route.js");
  assert.match(source, /db\.runTransaction/);
  assert.match(source, /Another Driver already accepted this ride/);
  assert.match(source, /presence\.currentJobId/);
  assert.match(source, /state: "driver_assigned"/);
  assert.match(source, /currentWorkType: "ride"/);
  assert.match(source, /state: "withdrawn"/);
});

test("Ride trip state changes require assignment and pickup PIN verification", async () => {
  const [source, rideServer] = await Promise.all([read("app/api/driver/rides/route.js"), read("lib/ride-server.js")]);
  assert.match(source, /ride\.assignedDriverId !== user\.uid/);
  assert.match(source, /ride\.state !== requiredState/);
  assert.match(source, /matchesRidePin/);
  assert.match(source, /verify_pickup/);
  assert.match(rideServer, /driver_arrived_dropoff/);
  assert.match(source, /ride\.completed/);
});

test("Ride cash and Paynow completion use different Driver money treatment", async () => {
  const [route, money] = await Promise.all([read("app/api/driver/rides/route.js"), read("lib/driver-money-server.js")]);
  assert.match(route, /ride\.paymentMethod === "cash"/);
  assert.match(route, /recordCashRidePlatformFee/);
  assert.match(route, /creditRideEarnings/);
  assert.match(money, /ride_cash_platform_fee/);
  assert.match(money, /effects: \{ available: -numeric \}/);
  assert.match(money, /ride_earned/);
});

test("Customer Activity can rate completed rides through the dedicated ride endpoint", async () => {
  const [activity, rating] = await Promise.all([read("components/marketplace-app.js"), read("app/api/customer/rides/rating/route.js")]);
  assert.match(activity, /order\.transactionType === "ride"/);
  assert.match(activity, /\/api\/customer\/rides\/rating/);
  assert.match(rating, /ride\.state !== "completed"/);
  assert.match(rating, /ratingCount/);
  assert.match(rating, /riderRating/);
});

test("Admin Ride Operations exposes dispatch, assignment, exceptions and network controls", async () => {
  const [ui, api] = await Promise.all([read("components/admin-driver-operations.js"), read("app/api/admin/rides/route.js")]);
  assert.match(ui, /label:"Rides"/);
  assert.match(ui, /Ride network controls/);
  assert.match(ui, /Find Drivers/);
  assert.match(ui, /Reassign/);
  assert.match(api, /mobility\.ride_settings\.updated/);
  assert.match(api, /enabledAreas/);
  assert.match(api, /manually assigned/);
  assert.match(api, /clear_exception/);
});

test("Ride dispatch watchdog is secret-protected and ready for an external Hobby-safe scheduler", async () => {
  const [route, vercel, env] = await Promise.all([read("app/api/internal/ride-dispatch/route.js"), read("vercel.json"), read(".env.example")]);
  assert.match(route, /CRON_SECRET/);
  assert.match(route, /authorization/);
  assert.match(route, /state\", \"==\", \"searching_driver/);
  assert.match(route, /dispatchRide/);
  assert.doesNotMatch(vercel, /"crons"/);
  assert.match(env, /CRON_SECRET=/);
});

test("Ride operational collections are browser-denied and required composite indexes exist", async () => {
  const [rules, indexes] = await Promise.all([read("firestore.rules"), read("firestore.indexes.json")]);
  for (const name of ["rideTrips", "rideOffers", "rideEvents"]) assert.match(rules, new RegExp(`match /${name}`));
  assert.match(rules, /match \/rideTrips\/\{rideId\} \{ allow read, write: if false; \}/);
  const parsed = JSON.parse(indexes);
  const groups = parsed.indexes.map((item) => item.collectionGroup);
  assert.ok(groups.includes("rideTrips"));
  assert.ok(groups.includes("rideOffers"));
});

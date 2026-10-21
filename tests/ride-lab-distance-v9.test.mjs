import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateRideLabLocations, rideLabStraightLineKm, RIDE_LAB_MIN_SEPARATION_KM } from "../lib/ride-lab-validation.js";

const pickup = { lat: -17.83173, lng: 31.04542, country: "ZW", city: "Harare" };
const dropoff = { lat: -17.82963, lng: 31.04470, country: "ZW", city: "Harare" };
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Ride Lab accepts screenshot's legitimate short trip even if straight-line distance is under 300m", () => {
  const metres = rideLabStraightLineKm(pickup, dropoff) * 1000;
  assert.ok(metres > 240 && metres < 255, `Test pins should be ~246m apart, got ${metres}`);
  const result = validateRideLabLocations(pickup, dropoff);
  assert.equal(result.ok, true);
  assert.equal(result.error, "");
  assert.ok(RIDE_LAB_MIN_SEPARATION_KM < 0.246);
});

test("Ride Lab rejects identical or near-identical points with actionable feedback", () => {
  const identical = validateRideLabLocations(pickup, { ...pickup });
  assert.equal(identical.ok, false);
  assert.match(identical.error, /same place/);
  const close = validateRideLabLocations(pickup, { ...pickup, lat: pickup.lat + 0.00001 });
  assert.equal(close.ok, false);
  assert.match(close.error, /20 metres/);
  assert.equal(validateRideLabLocations(null, dropoff).ok, false);
});

test("Ride Lab still rejects cross-border, unsupported and excessively distant test routes", () => {
  const malawi = { lat: -13.96, lng: 33.78, country: "MW" };
  const bulawayo = { lat: -20.15, lng: 28.58, country: "ZW" };
  assert.match(validateRideLabLocations(pickup, malawi).error, /cross-border/);
  assert.match(validateRideLabLocations(pickup, bulawayo).error, /200 km/);
  assert.match(validateRideLabLocations(pickup, { ...pickup, lat: -25 }).error, /Zimbabwe or Malawi/);
  assert.match(validateRideLabLocations(pickup, { ...pickup, country: "ZA" }).error, /cross-border/);
});

test("server and client share the same location rules; Ride Lab remains isolated from real dispatch", async () => {
  const api = await read("app/api/mobility/ride-lab/route.js");
  const ui = await read("components/ride-app.js");
  assert.match(api, /validateRideLabLocations\(input\.pickup, input\.dropoff\)/);
  assert.match(ui, /validateRideLabLocations\(pickup, dropoff\)/);
  assert.match(ui, /rideLabLocationValidation\.error/);
  assert.match(ui, /Edit destination/);
  assert.match(ui, /The fare preview uses driving distance/);
  for (const collection of ["rideTrips", "rideOffers", "driverPresence", "driverEarningsLedger", "payments"]) {
    assert.doesNotMatch(api, new RegExp(`db\\.collection\\("${collection}"\\)`));
  }
});

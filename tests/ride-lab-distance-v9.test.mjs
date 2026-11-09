import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateOperationsRideLocations, operationsRideStraightLineKm, OPERATIONS_RIDE_MIN_SEPARATION_KM } from "../lib/operations-run-validation.js";

const pickup = { lat: -17.83173, lng: 31.04542, country: "ZW", city: "Harare" };
const dropoff = { lat: -17.82963, lng: 31.04470, country: "ZW", city: "Harare" };
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Operations Ride accepts a legitimate short real route", () => {
  const metres = operationsRideStraightLineKm(pickup, dropoff) * 1000;
  assert.ok(metres > 240 && metres < 255, `Test pins should be ~246m apart, got ${metres}`);
  const result = validateOperationsRideLocations(pickup, dropoff);
  assert.equal(result.ok, true);
  assert.ok(OPERATIONS_RIDE_MIN_SEPARATION_KM < 0.246);
});

test("Operations Ride rejects identical, near-identical, cross-border and excessive routes", () => {
  assert.match(validateOperationsRideLocations(pickup, { ...pickup }).error, /20 metres/);
  assert.match(validateOperationsRideLocations(pickup, { ...pickup, lat: pickup.lat + 0.00001 }).error, /20 metres/);
  assert.match(validateOperationsRideLocations(pickup, { lat: -13.96, lng: 33.78, country: "MW", city: "Lilongwe" }).error, /cross-border/);
  assert.match(validateOperationsRideLocations(pickup, { lat: -20.15, lng: 28.58, country: "ZW", city: "Bulawayo" }).error, /200 km/);
  assert.equal(validateOperationsRideLocations(null, dropoff).ok, false);
});

test("Operations Ride uses real route pricing but writes only isolated operationsRuns", async () => {
  const api = await read("app/api/operations/rides/route.js");
  assert.match(api, /validateOperationsRideLocations\(pickup, dropoff\)/);
  assert.match(api, /getVerifiedRideRoute/);
  assert.match(api, /estimateRide/);
  assert.match(api, /db\.collection\("operationsRuns"\)/);
  assert.match(api, /financialIsolation:true/);
  assert.match(api, /productionCollectionsUntouched:true/);
  for (const collection of ["rideTrips", "rideOffers", "driverPresence", "driverEarningsLedger", "payments"]) {
    assert.doesNotMatch(api, new RegExp(`db\\.collection\\("${collection}"\\)`));
  }
});

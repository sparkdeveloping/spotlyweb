import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("iOS preflight has a byte-identical money contract in web and Firebase", () => {
  const web = read("contracts/spotly-money.v1.json");
  const firebase = read("firebase/functions/src/contracts/spotly-money.v1.json");
  assert.equal(web, firebase);
  assert.equal(createHash("sha256").update(firebase).digest("hex"),
    "932ba27fc9b133275fd7edf587b6e2088680cfc8a1eca9c2f0610dd599340c95");
  const platform = read("firebase/functions/src/core/platform.js");
  const index = read("firebase/functions/src/index.js");
  assert.match(platform, /SPOTLY_MONEY_CONTRACT_SHA256/);
  assert.match(index, /moneyContractVersion: SPOTLY_MONEY_CONTRACT_VERSION/);
  assert.match(index, /moneyContractSHA256: SPOTLY_MONEY_CONTRACT_SHA256/);
});

test("every native routing callable and readiness has Secret Manager binding", () => {
  const index = read("firebase/functions/src/index.js");
  assert.match(index, /defineSecret\("SPOTLY_ROUTING_API_KEY"\)/);
  for (const name of ["customerRuntime", "customerRideQuote", "customerSendQuote",
    "customerRidePickupSuggestions", "adminMobilityRouteCheck"]) {
    const start = index.indexOf("name: \"" + name + "\"");
    assert.notEqual(start, -1, "Missing callable " + name);
    const block = index.slice(start, start + 360);
    assert.match(block, /secrets: \[CUSTOMER_ROUTING_KEY\]/, "Missing routing binding on " + name);
  }
});

test("routing remains verified and bounded; no invented route fallback", () => {
  const source = read("firebase/functions/src/core/mobility-road-access.js");
  assert.match(source, /DEFAULT_ROUTING_ENDPOINT = 'https:\/\/api\.mapmap\.ai'/);
  assert.match(source, /MAX_ACCESS_METERS = 350/);
  assert.match(source, /snap_retry', 'true'/);
  assert.match(source, /interpretDrivingRoute/);
  assert.doesNotMatch(source, /getStraightLineRoute|distance-only fallback/);
  const runtime = read("firebase/functions/src/core/customer-runtime.js");
  assert.match(runtime, /export async function ridePickupSuggestions/);
  assert.match(runtime, /const route = await verifiedMobilityRoute\(origin, destination\)/);
  assert.match(runtime, /verifiedRoute: true/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("native Ride and Send use bounded, server-verified road access", () => {
  const runtime = read("firebase/functions/src/core/customer-runtime.js");
  const routing = read("firebase/functions/src/core/mobility-road-access.js");
  assert.match(runtime, /import \{ verifiedMobilityRoute \} from "\.\/mobility-road-access\.js"/);
  assert.equal((runtime.match(/await verifiedMobilityRoute\(/g) || []).length, 2);
  assert.equal((runtime.match(/routePath: route\.path, accessPoints: route\.accessPoints/g) || []).length, 2);
  assert.match(routing, /MAX_ACCESS_METERS = 350/);
  assert.match(routing, /route\?\.geometry\?\.coordinates/);
  assert.match(routing, /interpretDrivingRoute/);
  assert.match(routing, /nearestCandidates/);
  assert.match(routing, /requiresConfirmation/);
  assert.doesNotMatch(runtime, /routePath: \[\]/);
});

test("native mobility booking readiness respects the customer launch gate", () => {
  const source = read("firebase/functions/src/core/customer-runtime.js");
  const index = read("firebase/functions/src/index.js");
  assert.match(source, /customerTransactionLaunchReadiness/);
  assert.match(source, /"maintenance"/);
  assert.match(source, /"first_access"/);
  assert.match(source, /loadOperationGrants\(firestore, actor\.uid\)/);
  assert.equal((source.match(/launchAccess\.allowed && decision\.transactable/g) || []).length, 2);
  assert.match(index, /rideQuote\(\{ firestore: spotlyAdmin\(\)\.firestore, data: request\.data \|\| \{\}, actor \}\)/);
  assert.match(index, /sendQuote\(\{ firestore: spotlyAdmin\(\)\.firestore, data: request\.data \|\| \{\}, actor \}\)/);
});

test("Firebase quote contracts remain distinct from not-yet-migrated customer request mutations", () => {
  const contract = JSON.parse(read("contracts/spotly-customer-runtime.v1.json"));
  assert.equal(contract.customerRuntimeContractVersion, "1.0.0");
  assert.ok(contract.callables.customerRideQuote);
  assert.ok(contract.callables.customerSendQuote);
  const index = read("firebase/functions/src/index.js");
  assert.doesNotMatch(index, /export const customerRideRequest =/);
  assert.doesNotMatch(index, /export const customerSendRequest =/);
});

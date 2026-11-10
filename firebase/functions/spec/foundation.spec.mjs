import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { requestFingerprint, scopedIdempotencyKey } from "../src/core/fingerprint.js";
import { privateStoragePath } from "../src/core/storage.js";
import * as platform from "../src/core/platform.js";
const { SPOTLY_CONTRACT_SHA256, SPOTLY_CONTRACT_VERSION, SPOTLY_FUNCTIONS_REGION, SPOTLY_PROJECT_ID } = platform;

test("Functions foundation is pinned to Spotly Africa and canonical contract v1", async () => {
  assert.equal(SPOTLY_PROJECT_ID, "spotly-africa");
  assert.equal(SPOTLY_FUNCTIONS_REGION, "europe-west1");
  assert.equal(SPOTLY_CONTRACT_VERSION, "1.0.0");
  assert.equal(SPOTLY_CONTRACT_SHA256, "a9ebc7f94c1ad89fdf755561cfb6d5967db8c75dcd3b3e766c39d2c85582ece1");
  const raw = await readFile(new URL("../src/contracts/spotly-contracts.v1.json", import.meta.url));
  assert.ok(raw.length > 1000);
});

test("idempotency fingerprints are stable across object key order", () => {
  assert.equal(requestFingerprint({ b: 2, a: 1 }), requestFingerprint({ a: 1, b: 2 }));
  assert.notEqual(requestFingerprint({ a: 1 }), requestFingerprint({ a: 2 }));
  assert.equal(scopedIdempotencyKey("order", "user", "abc"), scopedIdempotencyKey("order", "user", "abc"));
  assert.notEqual(scopedIdempotencyKey("order", "user", "abc"), scopedIdempotencyKey("ride", "user", "abc"));
});

test("private Storage paths cannot escape their namespace", () => {
  assert.equal(privateStoragePath({ domain: "driver/evidence", ownerId: "u/1", recordId: "r 1", filename: "../license.png" }), "private/driver-evidence/u-1/r-1/..-license.png");
});

test("customer runtime contract and native callable surface are pinned", () => {
  assert.equal(platform.SPOTLY_CUSTOMER_RUNTIME_CONTRACT_VERSION, "1.0.0");
  assert.match(platform.SPOTLY_CUSTOMER_RUNTIME_CONTRACT_SHA256, /^[a-f0-9]{64}$/);
  assert.equal(platform.FOUNDATION_CAPABILITIES.customerRuntime, true);
  assert.equal(platform.FOUNDATION_CAPABILITIES.customerMobilityQuotes, true);
});


test("media and discovery contract is pinned across the Firebase surface", () => {
  assert.equal(platform.SPOTLY_MEDIA_DISCOVERY_CONTRACT_VERSION, "1.0.0");
  assert.equal(platform.SPOTLY_MEDIA_DISCOVERY_CONTRACT_SHA256, "3eaaa836f24a90b536e935040bfc8007cf2f367443e471ebd3c727a0429f557c");
  assert.equal(platform.FOUNDATION_CAPABILITIES.customerDiscovery, true);
  assert.equal(platform.FOUNDATION_CAPABILITIES.approvedMedia, true);
});

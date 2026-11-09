import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { requestFingerprint, scopedIdempotencyKey } from "../src/core/fingerprint.js";
import { privateStoragePath } from "../src/core/storage.js";
import { SPOTLY_CONTRACT_SHA256, SPOTLY_CONTRACT_VERSION, SPOTLY_FUNCTIONS_REGION, SPOTLY_PROJECT_ID } from "../src/core/platform.js";

test("Functions foundation is pinned to Spotly Africa and canonical contract v1", async () => {
  assert.equal(SPOTLY_PROJECT_ID, "spotly-africa");
  assert.equal(SPOTLY_FUNCTIONS_REGION, "europe-west1");
  assert.equal(SPOTLY_CONTRACT_VERSION, "1.0.0");
  assert.equal(SPOTLY_CONTRACT_SHA256, "a1e3ea851048653f4be14f32024050d62af37bcee88c1055a969ffe7f76c5184");
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

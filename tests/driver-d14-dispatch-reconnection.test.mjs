import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const runtime = readFileSync(new URL("../firebase/functions/src/core/driver-runtime.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../firebase/functions/src/index.js", import.meta.url), "utf8");
const start = runtime.indexOf("export async function driverOfferAction(");
const end = runtime.indexOf("export async function driverWorkAction(", start);
const accept = runtime.slice(start, end);

test("driver offer acceptance uses one atomic work assignment with a single winner", () => {
  assert.ok(start > 0 && end > start);
  assert.match(accept,/await firestore\.runTransaction/);
  assert.match(accept,/transaction\.get\(offerRef\)/);
  assert.match(accept,/transaction\.get\(workRef\)/);
  assert.match(accept,/work\.assignedDriverId \|\| !allowedStates\.includes\(work\.state\)/);
  assert.match(accept,/Another Driver already accepted this request/);
  assert.match(accept,/await noActiveWork\(transaction, firestore, actor\.uid\)/);
  assert.match(accept,/transaction\.set\(workRef, \{ state: "driver_assigned", assignedDriverId: actor\.uid/);
  assert.match(accept,/transaction\.create\(firestore\.collection\("auditLogs"\)/);
});

test("no new acceptance from an unverified, offline, expired, or foreign session", () => {
  assert.match(accept,/offer\.driverId !== actor\.uid/);
  assert.match(accept,/presence\.val\(\)\?\.state !== "online"/);
  assert.match(accept,/Go online with a verified Driver session/);
  assert.match(accept,/await eligibility\(firestore, actor\.uid/);
  assert.match(accept,/offer\.expiresAt\?\.toMillis/);
  assert.match(accept,/This offer expired/);
});

test("replayed winner is returned idempotently without another assignment or customer push", () => {
  assert.match(accept,/const replayCandidate = offer\.state === "accepted" && workDoc\.data\(\)\?\.assignedDriverId === actor\.uid/);
  assert.match(accept,/offer\.state === "accepted" && work\.assignedDriverId === actor\.uid/);
  assert.match(accept,/reused = true; customerId = work\.customerId \|\| ""; return/);
  assert.match(accept,/if \(!reused && customerId\) await sendUserPush/);
  assert.match(accept,/return \{ kind, action, workId, reused, synchronizationPending \}/);
});

test("post-commit secondary dispatch sync failure is reported without denying assigned trip", () => {
  const tx = accept.indexOf("await firestore.runTransaction");
  const sideEffects = accept.indexOf("if (action === \"accept\") {",tx);
  assert.ok(sideEffects > tx);
  assert.match(accept,/catch \{ synchronizationPending = true; \}/);
  assert.match(accept,/driver\.dispatch_sync_pending/);
  assert.match(accept,/runtimeAccess\/driverDispatchScope/);
  assert.match(accept,/driverPresence/);
  assert.match(accept,/runtimeAccess\/activeTrips/);
  assert.doesNotMatch(accept,/transaction\.set\(workRef, \{ state: "completed"/);
});

test("Operations test runs use scoped grants, distinct accounts and atomic advances", () => {
  assert.match(index,/export const operationsRide = defineCallable/);
  assert.match(index,/requireOperationGrant\(grants, \{ type: "driver_operations", service: "ride", country: data\.pickup\?\.country, city: data\.pickup\?\.city \}\)/);
  assert.match(index,/data\.customerId === actor\.uid/);
  assert.match(index,/await firestore\.runTransaction/);
  assert.match(index,/Another Operations Driver already accepted this run/);
  assert.match(index,/data\.driverId !== actor\.uid \|\| !OPERATIONS_RIDE_NEXT\[data\.state\]/);
  assert.match(index,/const OPERATIONS_RIDE_END = new Set\(\["completed", "cancelled"\]\)/);
});

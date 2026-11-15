import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  CUSTOMER_STATUS_INTERVALS,
  customerStatusInterval,
  createVisibleCustomerPoller
} from "../lib/customer-status-polling.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path) => readFileSync(resolve(root, path), "utf8");

function harness(poll) {
  const calls = new Map();
  const listeners = new Map();
  let nextID = 1;
  const visibility = {
    visibilityState: "visible",
    addEventListener(event, cb) { listeners.set(event, cb); },
    removeEventListener(event, cb) { if (listeners.get(event) === cb) listeners.delete(event); },
    show() { this.visibilityState = "visible"; listeners.get("visibilitychange")?.(); },
    hide() { this.visibilityState = "hidden"; listeners.get("visibilitychange")?.(); }
  };
  const controller = createVisibleCustomerPoller({
    poll,
    interval: () => 8_000,
    visibility,
    schedule(fn, delay) { const id = nextID++; calls.set(id, { fn, delay }); return id; },
    cancel(id) { calls.delete(id); }
  });
  return {
    controller, visibility, calls, listeners,
    async advance() {
      const [id, next] = calls.entries().next().value || [];
      assert.ok(id, "a timer must be scheduled");
      calls.delete(id);
      next.fn();
      // Drain promise continuations in the async controller.
      for (let i = 0; i < 8; i++) await Promise.resolve();
      return next.delay;
    }
  };
}

test("C5: active polling remains frequent while idle lists are fetched only once per minute", () => {
  assert.equal(customerStatusInterval("ride", true), 8000);
  assert.equal(customerStatusInterval("send", true), 10000);
  assert.equal(customerStatusInterval("send", false), 60000);
  assert.equal(customerStatusInterval("ride", false), 60000);
  assert.ok(CUSTOMER_STATUS_INTERVALS.rideDispatchRetryMs >= 18000);
  assert.ok(CUSTOMER_STATUS_INTERVALS.sendDispatchRetryMs >= 45000);
});

test("C5: no polling while hidden; foreground triggers immediate reconciliation", async () => {
  let reads = 0;
  const h = harness(async () => { reads++; });
  h.controller.start();
  assert.equal(h.calls.size, 1);
  h.visibility.hide();
  assert.equal(h.calls.size, 0);
  h.visibility.show();
  for (let i = 0; i < 8; i++) await Promise.resolve();
  assert.equal(reads, 1);
  assert.equal(h.calls.size, 1);
  h.controller.stop();
  assert.equal(h.calls.size, 0);
  assert.equal(h.listeners.size, 0);
});

test("C5: slow requests never overlap and status remains allowed to finish", async () => {
  let resolve;
  let reads = 0;
  const h = harness(async () => { reads++; await new Promise((r) => { resolve = r; }); });
  h.controller.start();
  const advancePromise = h.advance();
  await Promise.resolve();
  assert.equal(reads, 1);
  h.visibility.hide();
  h.visibility.show();
  assert.equal(reads, 1, "background/foreground must not duplicate the running request");
  resolve();
  await advancePromise;
  for (let i = 0; i < 8; i++) await Promise.resolve();
  assert.equal(h.calls.size, 1, "one immediate recovery is queued");
  assert.equal([...h.calls.values()][0].delay, 0);
  h.controller.stop();
});

test("C5: failures back off without killing the polling loop", async () => {
  let count = 0;
  const h = harness(async () => { count++; if (count === 1) throw Error("offline"); });
  h.controller.start();
  assert.equal(await h.advance(), 8000);
  assert.equal([...h.calls.values()][0].delay, 16000);
  assert.equal(await h.advance(), 16000);
  assert.equal([...h.calls.values()][0].delay, 8000);
  h.controller.stop();
});

test("C5: stop blocks scheduled reads and post-stop rescheduling", async () => {
  let resolve;
  const h = harness(() => new Promise((r) => { resolve = r; }));
  h.controller.start();
  const pending = h.advance();
  h.controller.stop();
  resolve();
  await pending;
  assert.equal(h.calls.size, 0);
  h.visibility.show();
  assert.equal(h.calls.size, 0);
});

test("C5: Ride and Send poll a single owned active job, preserve full-list recovery", () => {
  const ride = source("components/ride-app.js");
  const send = source("components/send-app.js");
  assert.match(ride, /customer\/rides\?rideId=\$\{encodeURIComponent\(activeRideID\)\}/);
  assert.match(send, /customer\/parcels\?parcelJobId=\$\{encodeURIComponent\(activeParcelID\)\}/);
  assert.match(ride, /await load\(\{ quiet: true \}\); \/\/ Reconcile history/);
  assert.match(send, /await load\(\{ quiet: true \}\); \/\/ History\/receipts/);
  assert.doesNotMatch(send, /setInterval\(\(\)\s*=>\s*load\(\{quiet:true\}\),\s*10000\)/);
  assert.match(ride, /ownerRef\.current !== customerUID/);
  assert.match(send, /ownerRef\.current !== customerUID/);
  assert.match(ride, /rideDispatchRetryMs/);
  assert.match(send, /sendDispatchRetryMs/);
});

test("C5: the API still checks customer ownership before returning tracked details", () => {
  for (const path of ["app/api/customer/rides/route.js", "app/api/customer/parcels/route.js"]) {
    const route = source(path);
    assert.match(route, /customerId !== user\.uid/);
    assert.match(route, /includePins?: true/);
    assert.match(route, /loadDriverBundle/);
  }
  const hook = source("components/customer-status-polling.js");
  assert.match(hook, /controller\.stop\(\)/);
  assert.match(hook, /ownerKey/);
});

test("C5: iOS coalesces overlapping forced Activity requests without losing mutation refreshes", () => {
  // When run from a web-only deployment archive the native sibling is absent;
  // native syntax is validated separately in the combined project release.
  const iosPath = resolve(root, "../ios/spotly/Core/Stores/ActivityStore.swift");
  if (!existsSync(iosPath)) return;
  const ios = readFileSync(iosPath, "utf8");
  assert.match(ios, /if isLoading \{\s*if force \{ pendingForcedReload = true \}/);
  assert.match(ios, /await drainPendingForcedReload\(for: user\)/);
  assert.match(ios, /await load\(user: user, force: true\)/);
  assert.match(ios, /Date\(\)\.timeIntervalSince\(lastUpdated\) < 30/);
  assert.match(ios, /pendingForcedReload = false/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { getDriverPresenceSnapshot } from "../lib/driver-presence-query.mjs";
import { summarizeDriverRetentionScan } from "../firebase/functions/src/core/retention-scan-metrics.js";

function fakeDatabase({ queryError = false, rootError = false } = {}) {
  const calls = [];
  const rows = { driverA: { state: "online" }, driverB: { state: "offline" } };
  const db = {
    ref(path) {
      calls.push(["ref", path]);
      return {
        async get() { calls.push(["full"]); if (rootError) throw new Error("offline"); return { val: () => rows }; },
        orderByChild(field) {
          calls.push(["order", field]);
          return {
            equalTo(state) {
              calls.push(["equal", state]);
              return {
                async get() { calls.push(["indexed"]); if (queryError) throw new Error("index not ready"); return { val: () => ({ driverA: rows.driverA }) }; }
              };
            }
          };
        }
      };
    }
  };
  return { db, calls };
}

test("C6: indexed presence is opt-in, keeping original full-query behavior by default", async () => {
  const h = fakeDatabase();
  const result = await getDriverPresenceSnapshot(h.db, { indexed: false });
  assert.equal(Object.keys(result.val()).length, 2);
  assert.deepEqual(h.calls, [["ref", "driverPresence"], ["full"]]);
});

test("C6: indexed query returns all online records without a result limit", async () => {
  const h = fakeDatabase();
  const result = await getDriverPresenceSnapshot(h.db, { indexed: true });
  assert.deepEqual(Object.keys(result.val()), ["driverA"]);
  assert.deepEqual(h.calls, [["ref", "driverPresence"], ["order", "state"], ["equal", "online"], ["indexed"]]);
});

test("C6: indexed read failure falls back to the original full presence tree", async () => {
  const h = fakeDatabase({ queryError: true });
  const result = await getDriverPresenceSnapshot(h.db, { indexed: true });
  assert.equal(Object.keys(result.val()).length, 2);
  assert.deepEqual(h.calls.at(-2), ["indexed"]);
  assert.deepEqual(h.calls.at(-1), ["full"]);
});

test("C6: transport outage still signals a failure after the conservative fallback", async () => {
  const h = fakeDatabase({ queryError: true, rootError: true });
  await assert.rejects(getDriverPresenceSnapshot(h.db, { indexed: true }), /offline/);
});

test("C6: RTDB state index preserves all owner-scoped read and write restrictions", () => {
  const rules = JSON.parse(readFileSync(new URL("../database.rules.json", import.meta.url), "utf8")).rules;
  assert.deepEqual(rules.driverPresence[".indexOn"], ["state"]);
  assert.equal(rules[".read"], false);
  assert.equal(rules[".write"], false);
  assert.equal(rules.driverPresence.$uid[".read"].includes("auth.uid === $uid"), true);
  assert.equal(rules.driverPresence.$uid[".write"].includes("runtimeAccess/driverEligible/"), true);
  assert.equal(rules.dispatchPresence.$country.$area.$uid[".read"], false);
  assert.equal(rules.activeTrips.$tripId.$other[".write"], false);
});

test("C6: driver presence bridge uses the opt-in helper and preserves legacy fallback", () => {
  const source = readFileSync(new URL("../lib/driver-realtime-presence.js", import.meta.url), "utf8");
  assert.match(source, /getDriverPresenceSnapshot\(database\)/);
  assert.match(source, /firestore\.collection\("driverPresence"\)\.where\("online"/);
  assert.match(source, /for \(const \[id, presence\] of Object\.entries\(raw\)\)/);
});

test("C6: driver GPS safety and dispatch cleanup contracts stay in source when sibling driver exists", () => {
  const path = new URL("../../driver/spotlydriver/spotlydriver/Core/Platform/DriverLocationService.swift", import.meta.url);
  if (!existsSync(path)) return; // Native code is distributed as a separate archive.
  const source = readFileSync(path, "utf8");
  assert.match(source, /DriverLocationWritePolicy\.shouldPublishFix/);
  assert.match(source, /driverPresence\/\\\(uid\)\/location"\)\.onDisconnectRemoveValue/);
  assert.match(source, /dispatchPresence\/\\\(country\)\/\\\(area\)\/\\\(uid\)"\)\.onDisconnectRemoveValue/);
  assert.match(source, /DriverReleaseLocationPolicy\.shouldPublish/);
  assert.match(source, /requiresServerReconciliation/);
});

test("C6: retention scan metrics reuse downloaded snapshots without personal data", () => {
  const metrics = summarizeDriverRetentionScan({
    dispatch: { ZW: { Harare: { a: {}, b: {} }, Bulawayo: { c: {} } }, MW: { Lilongwe: { d: {} } } },
    presence: { a: {}, b: {}, c: {}, d: {}, e: {} },
    active: { trip1: {}, trip2: {} },
    access: { trip1: {} }
  });
  assert.deepEqual(metrics, {
    dispatchAreasScanned: 3,
    dispatchDriversScanned: 4,
    presenceDriversScanned: 5,
    activeTripsScanned: 2,
    activeTripAccessRecordsScanned: 1
  });
  assert.doesNotMatch(JSON.stringify(metrics), /Harare|Bulawayo|Lilongwe|trip1/);
  const retention = readFileSync(new URL("../firebase/functions/src/core/retention.js", import.meta.url), "utf8");
  assert.match(retention, /summarizeDriverRetentionScan\(\{ dispatch, presence, active, access \}\)/);
});

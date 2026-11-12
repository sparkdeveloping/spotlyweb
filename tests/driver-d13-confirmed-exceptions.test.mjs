import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const runtime = readFileSync(new URL("../firebase/functions/src/core/driver-runtime.js", import.meta.url), "utf8");
const web = readFileSync(new URL("../app/api/driver/incidents/route.js", import.meta.url), "utf8");
const begin = runtime.indexOf("export async function createDriverIncident(");
const end = runtime.indexOf("export async function markDriverNotificationRead(", begin);
assert.ok(begin >= 0 && end > begin);

function memory(initial = {}) {
  const records = new Map(Object.entries(initial));
  let auto = 0;
  const key = ref => ref.collection + "/" + ref.id;
  const snapshot = ref => ({ exists: records.has(key(ref)), data: () => records.get(key(ref)) });
  const db = {
    failCreate: "",
    records,
    collection(collection) {
      return { doc(id = "A".repeat(18) + String(++auto).padStart(2, "0")) { return { collection, id }; } };
    },
    async runTransaction(callback) {
      const writes = [];
      const tx = {
        get: async ref => snapshot(ref),
        create: (ref, data) => writes.push({ kind: "create", ref, data }),
        set: (ref, data, options) => writes.push({ kind: "set", ref, data, options })
      };
      const result = await callback(tx);
      // Before any write, ensure the full transaction could commit.
      for (const operation of writes) {
        if (operation.kind === "create" && (operation.ref.collection === db.failCreate || records.has(key(operation.ref))))
          throw new Error("Atomic create rejected");
      }
      for (const operation of writes) {
        const before = records.get(key(operation.ref)) || {};
        records.set(key(operation.ref), operation.kind === "set" && operation.options?.merge ?
          { ...before, ...operation.data } : operation.data);
      }
      return result;
    }
  };
  return db;
}

function runtimeIncident(db, audit = async () => {}) {
  const fragment = runtime.slice(begin, end).replace("export async function", "async function");
  const fakeText = (value, max = 220) => String(value || "").trim().slice(0, max);
  class TestHttpsError extends Error {
    constructor(code, message) { super(message); this.code = code; }
  }
  const types = {
    delivery: { work: "deliveryJobs" }, ride: { work: "rideTrips" }, send: { work: "parcelJobs" }
  };
  return new Function("spotlyAdmin", "text", "createHash", "HttpsError", "FieldValue",
    "COLLECTIONS", "finished", "writeFunctionAudit",
    fragment + "\nreturn createDriverIncident;")(
    () => ({ firestore: db }), fakeText, createHash, TestHttpsError,
    { serverTimestamp: () => "SERVER_TIMESTAMP" }, types,
    (_kind, state) => ["delivered", "returned", "completed", "cancelled", "failed"].includes(state), audit
  );
}

const request = {
  kind: "delivery", workId: "job-1", category: "customer_unreachable",
  description: "Customer unreachable at handoff", severity: "medium",
  requestKey: "550e8400-e29b-41d4-a716-446655440000"
};
const initial = { "deliveryJobs/job-1": { assignedDriverId: "driver-one", state: "driver_arrived_customer", customerId: "customer-one" } };

test("incident + Operations queue commit atomically, without changing delivery state", async () => {
  const db = memory(initial);
  let audits = 0;
  const create = runtimeIncident(db, async () => { audits++; });
  const result = await create({ uid: "driver-one" }, request);
  assert.equal(result.status, "open");
  assert.equal(result.reused, false);
  assert.equal(db.records.get("deliveryJobs/job-1").state, "driver_arrived_customer");
  assert.equal(db.records.get("driverIncidents/" + result.incidentId).driverId, "driver-one");
  assert.equal(db.records.get("adminQueueItems/driver_incident_" + result.incidentId).entityId, result.incidentId);
  assert.equal(db.records.get("drivers/driver-one"), undefined);
  assert.equal(audits, 1);
});

test("same request key reuses real incident status and never creates duplicate queue items", async () => {
  const db = memory(initial);
  let audits = 0;
  const create = runtimeIncident(db, async () => { audits++; });
  const first = await create({ uid: "driver-one" }, request);
  db.records.get("driverIncidents/" + first.incidentId).status = "under_review";
  const second = await create({ uid: "driver-one" }, request);
  assert.equal(second.incidentId, first.incidentId);
  assert.equal(second.reused, true);
  assert.equal(second.status, "under_review");
  assert.equal(audits, 1);
  assert.equal([...db.records.keys()].filter(key => key.startsWith("driverIncidents/")).length, 1);
  await assert.rejects(() => create({ uid: "driver-one" }, { ...request, description: "Different details" }),
    error => error.code === "already-exists");
});

test("foreign driver cannot report against another driver's assigned job", async () => {
  const db = memory(initial);
  const create = runtimeIncident(db);
  await assert.rejects(() => create({ uid: "driver-two" }, request),
    error => error.code === "permission-denied");
  assert.equal([...db.records.keys()].filter(key => key.startsWith("driverIncidents/")).length, 0);
});

test("high-severity safety report atomically locks account and active work", async () => {
  const db = memory(initial);
  const create = runtimeIncident(db);
  const result = await create({ uid: "driver-one" }, { ...request, severity: "high" });
  assert.equal(db.records.get("drivers/driver-one").safetyHold, true);
  assert.equal(db.records.get("deliveryJobs/job-1").safetyReviewHold, true);
  assert.equal(db.records.get("deliveryJobs/job-1").safetyIncidentId, result.incidentId);
  assert.equal(db.records.get("adminQueueItems/driver_incident_" + result.incidentId).status, "open");
  assert.equal(db.records.get("deliveryJobs/job-1").state, "driver_arrived_customer");
});

test("an Operations queue creation failure leaves no partial incident or safety hold", async () => {
  const db = memory(initial);
  db.failCreate = "adminQueueItems";
  const create = runtimeIncident(db);
  await assert.rejects(() => create({ uid: "driver-one" }, { ...request, severity: "critical" }));
  assert.equal(db.records.get("drivers/driver-one"), undefined);
  assert.equal(db.records.get("deliveryJobs/job-1").safetyReviewHold, undefined);
  assert.equal([...db.records.keys()].filter(key => key.startsWith("driverIncidents/")).length, 0);
});

test("audit failure after successful commit does not falsely report incident failure", async () => {
  const db = memory(initial);
  const create = runtimeIncident(db, async () => { throw new Error("audit offline"); });
  const result = await create({ uid: "driver-one" }, request);
  assert.ok(result.incidentId);
  assert.ok(db.records.has("driverIncidents/" + result.incidentId));
});

test("web Driver incident endpoint also uses transaction, scoped assignment and no fake job transitions", () => {
  assert.match(web, /await db\.runTransaction/);
  assert.match(web, /transaction\.create\(incidentRef/);
  assert.match(web, /transaction\.create\(queueRef/);
  assert.match(web, /transaction\.get\(workRef\)/);
  assert.match(web, /assignedDriverId !== user\.uid/);
  assert.match(web, /requestFingerprint/);
  assert.match(web, /requestKey: z\.string\(\)\.uuid\(\)\.optional\(\)/);
  assert.match(web, /safetyReviewHold: true/);
  assert.doesNotMatch(web, /state: "failed"/);
  assert.doesNotMatch(web, /state: "cancelled"/);
});

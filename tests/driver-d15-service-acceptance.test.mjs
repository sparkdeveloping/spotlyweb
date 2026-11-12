import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const runtime = readFileSync(new URL("../firebase/functions/src/core/driver-runtime.js", import.meta.url), "utf8");

class FakeStore {
  constructor() { this.rows = new Map(); this.serial = Promise.resolve(); this.sequence = 0; }
  key(ref) { return ref.collection + "/" + ref.id; }
  ref(collection, id) {
    const store = this;
    return {
      collection, id,
      async get() {
        const key = collection + "/" + id;
        return { exists: store.rows.has(key), data: () => store.rows.get(key) };
      },
      async set(patch, options) {
        const key = collection + "/" + id;
        store.rows.set(key, options?.merge ? { ...(store.rows.get(key) || {}), ...patch } : patch);
      }
    };
  }
  collection(name) {
    return { doc: (id) => this.ref(name, id || "event-" + (++this.sequence)) };
  }
  runTransaction(callback) {
    const job = this.serial.then(async () => {
      const writes = [];
      const tx = {
        get: ref => ref.get(),
        set: (ref, patch, options) => writes.push({ kind:"set", ref, patch, options }),
        create: (ref, patch) => writes.push({ kind:"create", ref, patch })
      };
      const result = await callback(tx);
      for (const change of writes)
        if (change.kind === "create" && this.rows.has(this.key(change.ref)))
          throw new Error("Duplicate transaction create");
      for (const change of writes) {
        const key = this.key(change.ref);
        const original = this.rows.get(key) || {};
        this.rows.set(key, change.kind === "set" && change.options?.merge ?
          { ...original, ...change.patch } : change.patch);
      }
      return result;
    });
    this.serial = job.catch(() => {});
    return job;
  }
}

function makeService(kind, state, overrides = {}, options = {}) {
  const firestore = new FakeStore();
  const collections = {
    ride:{work:"rideTrips",event:"rideEvents"},
    send:{work:"parcelJobs",event:"parcelEvents"},
    delivery:{work:"deliveryJobs",event:"deliveryEvents"}
  };
  const base = {
    id:"job1", assignedDriverId:"driver1", state, orderId:"order1",
    customerId:"customer1", currency:"USD", paymentMethod:"card",
    paymentStatus:"paid", acceptedDriverPay:4, quote:{total:10,platformFee:1,driverPay:4},
    cashToCollect:0, proofPhotoRequired:false
  };
  firestore.rows.set(collections[kind].work+"/job1", { ...base, ...overrides });
  firestore.rows.set("orders/order1", {id:"order1", status:"in_progress"});
  const presence = { state:"busy", country:"ZW", area:"harare",
    location:{lat:-17.825,lng:31.04}, updatedAt:Date.now() };
  let credits=0, pushes=0, syncFailures=0;
  const locations = new Map([["driverPresence/driver1",presence]]);
  const database = {
    ref(path) {
      return {
        async get() { const row=locations.get(path); return {exists:()=>!!row,val:()=>row} },
        async set(value) { locations.set(path,value) },
        async update(patch) { if(path==="driverPresence/driver1") Object.assign(presence,patch); else locations.set(path,patch) },
        async remove() {
          if(options.failActiveTrips && path.startsWith("runtimeAccess/activeTrips/")) {
            syncFailures++; throw Error("RTDB cleanup failed");
          }
          locations.delete(path);
        }
      };
    }
  };
  class TestHttpsError extends Error {
    constructor(code,message) { super(message); this.code=code; }
  }
  const start = runtime.indexOf("export async function driverWorkAction(");
  const end = runtime.indexOf("export async function createDriverIncident(",start);
  assert.ok(start >= 0 && end > start);
  const fragment = runtime.slice(start,end).replace("export async function","async function");
  const callable = new Function("spotlyAdmin","COLLECTIONS","text","HttpsError",
    "FieldValue","validateDriverProofUrl","matchesSecretPin","num","creditCompletion",
    "eligibility","writeFunctionAudit","sendUserPush",fragment+"\nreturn driverWorkAction;")(
    () => ({firestore,database,storage:{}}),
    collections,(v,max=220)=>String(v||"").trim().slice(0,max),
    TestHttpsError,{serverTimestamp:()=>Date.now()},
    async (_storage,{url})=>url,
    ({plaintext,value})=>String(plaintext)===String(value),
    value=>Number(value)||0,
    (transaction,db,_kind,workId,_work,driverID)=>{
      credits++;
      transaction.create(db.collection("driverEarningsLedger").doc("earned-"+workId),
        {driverId:driverID,amount:4,currency:"USD"});
      return true;
    },
    async()=>({country:"ZW",defaultArea:"harare"}),
    async()=>{},async()=>{pushes++}
  );
  const row=()=>firestore.rows.get(collections[kind].work+"/job1");
  return {callable,row,firestore,presence,credits:()=>credits,pushes:()=>pushes,
    syncFailures:()=>syncFailures};
}

test("Ride completion updates the customer order and credits only once despite a same-driver replay",async()=>{
  const app=makeService("ride","driver_arrived_dropoff");
  const a=await app.callable({uid:"driver1"},{kind:"ride",workId:"job1",action:"complete"});
  assert.equal(a.state,"completed");
  assert.equal(app.row().state,"completed");
  assert.equal(app.firestore.rows.get("orders/order1").rideStatus,"completed");
  assert.equal(app.firestore.rows.get("orders/order1").status,"completed");
  const b=await app.callable({uid:"driver1"},{kind:"ride",workId:"job1",action:"complete"});
  assert.equal(b.reused,true);
  assert.equal(app.credits(),1);
  assert.equal(app.pushes(),1);
});

test("Send delivery and returned Send are distinct financial and customer outcomes",async()=>{
  const delivered=makeService("send","handoff_verification");
  assert.equal((await delivered.callable({uid:"driver1"},{kind:"send",workId:"job1",action:"complete"})).state,"delivered");
  assert.equal(delivered.firestore.rows.get("orders/order1").sendStatus,"delivered");
  const returned=makeService("send","return_in_progress",{paymentStatus:"paid"});
  const first=await returned.callable({uid:"driver1"},{kind:"send",workId:"job1",action:"confirm_return"});
  assert.equal(first.state,"returned");
  assert.equal(returned.row().driverEarningsStatus,"on_hold");
  assert.equal(returned.firestore.rows.get("orders/order1").status,"exception");
  assert.ok(returned.firestore.rows.has("sendFinanceReviews/job1"));
  assert.equal(returned.credits(),0);
  assert.equal((await returned.callable({uid:"driver1"},{kind:"send",workId:"job1",action:"confirm_return"})).reused,true);
});

test("Bite completion updates actual order only after handoff",async()=>{
  const app=makeService("delivery","handoff_verification");
  assert.equal((await app.callable({uid:"driver1"},{kind:"delivery",workId:"job1",action:"complete"})).state,"delivered");
  assert.equal(app.firestore.rows.get("orders/order1").deliveryStatus,"delivered");
  assert.equal(app.credits(),1);
});

test("Store shopping checkout cannot be bypassed by generic pickup verification",async()=>{
  const app=makeService("delivery","driver_arrived_pickup",{fulfilmentMode:"driver_shops"});
  await assert.rejects(() =>app.callable({uid:"driver1"},{kind:"delivery",workId:"job1",action:"begin_pickup_verification"}),
    e=>e.code==="failed-precondition");
  assert.equal(app.row().state,"driver_arrived_pickup");
  const shopping=readFileSync(new URL("../app/api/driver/shopping/route.js", import.meta.url),"utf8");
  assert.match(shopping,/job\.shopping\?\.checkoutAuthorizedAt/);
  assert.match(shopping,/validateReceiptPath\(body\.receiptStoragePath/);
  assert.match(shopping,/shoppingReconciliation/);
  assert.match(shopping,/postPaymentCapturedLedger/);
  assert.match(shopping,/customerMoneyAdjustments/);
});

test("An interrupted post-commit location cleanup does not reverse a completed trip",async()=>{
  const app=makeService("ride","driver_arrived_dropoff",{}, {failActiveTrips:true});
  const first=await app.callable({uid:"driver1"},{kind:"ride",workId:"job1",action:"complete"});
  assert.equal(first.state,"completed");
  assert.equal(first.synchronizationPending,true);
  assert.equal(app.row().state,"completed");
  assert.equal(app.credits(),1);
  assert.equal((await app.callable({uid:"driver1"},{kind:"ride",workId:"job1",action:"complete"})).reused,true);
  assert.equal(app.credits(),1);
});

test("Invalid currency and unauthorized actor cannot complete real work or credit money",async()=>{
  const bad=makeService("ride","driver_arrived_dropoff",{currency:""});
  await assert.rejects(() =>bad.callable({uid:"driver1"},{kind:"ride",workId:"job1",action:"complete"}),
    e=>e.code==="failed-precondition");
  assert.equal(bad.credits(),0);
  const foreign=makeService("ride","driver_arrived_dropoff");
  await assert.rejects(() =>foreign.callable({uid:"other"},{kind:"ride",workId:"job1",action:"complete"}),
    e=>e.code==="permission-denied");
  assert.equal(foreign.credits(),0);
});

test("A cashed Ride requires explicit exact attestation and remains in the original state otherwise",async()=>{
  const app=makeService("ride","driver_arrived_dropoff",{paymentMethod:"cash",paymentStatus:"unpaid"});
  await assert.rejects(() =>app.callable({uid:"driver1"},{kind:"ride",workId:"job1",action:"complete"}),
    e=>e.code==="failed-precondition");
  assert.equal(app.row().state,"driver_arrived_dropoff");
  const complete=await app.callable({uid:"driver1"},{kind:"ride",workId:"job1",action:"complete",cashReceived:true,cashAmount:10});
  assert.equal(complete.state,"completed");
  assert.equal(app.row().cashReceived,10);
  assert.equal(app.row().paymentStatus,"cash_driver_attested");
});

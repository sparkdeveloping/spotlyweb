import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("offer collections expose only the authenticated Driver's own offers for reading", () => {
  const rules=read("firestore.rules");
  for(const kind of ["deliveryOffers","rideOffers","parcelOffers"]){
    const start=rules.indexOf("match /"+kind+"/{offerId}");
    assert.notEqual(start,-1,kind);
    const block=rules.slice(start,rules.indexOf("}",start)+1);
    assert.match(block,/allow get: if activeAccount\(\) && resource\.data\.driverId == request\.auth\.uid/);
    assert.match(block,/allow list: if activeAccount\(\)/);
    assert.match(block,/request\.query\.limit <= 40 && resource\.data\.driverId == request\.auth\.uid/);
    assert.match(block,/allow create, update, delete: if false/);
    assert.doesNotMatch(block,/allow write: if true/);
  }
  for(const collection of ["rideTrips","deliveryJobs","parcelJobs"]){
    assert.match(rules,new RegExp("match /"+collection+"/\\{[^}]+\\} \\{ allow read, write: if false; \\}"));
  }
});

test("existing Firestore composite indexes support scoped active-offer listeners",()=>{
 const indexes=JSON.parse(read("firestore.indexes.json")).indexes;
 for(const kind of ["rideOffers","deliveryOffers","parcelOffers"]){
  assert.ok(indexes.some(i=>i.collectionGroup===kind&&i.queryScope==="COLLECTION"&&
    i.fields[0]?.fieldPath==="driverId"&&i.fields[1]?.fieldPath==="state"&&
    i.fields[2]?.fieldPath==="createdAt"),kind);
 }
});

test("assigned Ride receives the original verified quote route, no Apple or fabricated fallback",()=>{
 const source=read("firebase/functions/src/core/driver-runtime.js");
 const start=source.indexOf("function workPayload(kind, work)");
 assert.notEqual(start,-1);
 const code=source.slice(start,start+4600);
 assert.match(code,/routePath: kind === "ride" && Array\.isArray\(work\.quote\?\.routePath\)/);
 assert.match(code,/Math\.abs\(point\.lat\) <= 90/);
 assert.match(code,/Math\.abs\(point\.lng\) <= 180/);
 assert.match(code,/\.slice\(0, 250\)/);
 assert.match(code,/serviceType: kind === "ride"/);
 assert.doesNotMatch(code,/pickupPinCiphertext:\s*work\./);
 assert.doesNotMatch(code,/dropoffPinCiphertext:\s*work\./);
});

test("Ride server transitions, verification and money remain server-owned",()=>{
 const source=read("firebase/functions/src/core/driver-runtime.js");
 assert.match(source,/pickup_verification: \{ verify_pickup: "in_trip" \}/);
 assert.match(source,/driver_arrived_dropoff: \{ complete: "completed" \}/);
 assert.match(source,/matchesSecretPin/);
 assert.match(source,/cashReceived !== true/);
 assert.match(source,/postDriverLedgerEntry/);
 assert.match(source,/transaction\.set\(ref, patch/);
});

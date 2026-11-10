import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const read=(p)=>fs.readFileSync(path.join(root,p),"utf8");

test("Phase 8 publishes one customer runtime contract to Functions",()=>{
 const contract=JSON.parse(read("contracts/spotly-customer-runtime.v1.json"));
 assert.equal(contract.customerRuntimeContractVersion,"1.0.0");
 assert.deepEqual(Object.keys(contract.callables).sort(),["customerRideQuote","customerRuntime","customerSendQuote"]);
 const platform=read("firebase/functions/src/core/platform.js");
 const index=read("firebase/functions/src/index.js");
 assert.match(platform,/SPOTLY_CUSTOMER_RUNTIME_CONTRACT_SHA256/);
 assert.match(index,/export const customerRuntime/);
 assert.match(index,/export const customerRideQuote/);
 assert.match(index,/export const customerSendQuote/);
});

test("Firebase customer runtime preserves Phase 3 country and Phase 4 availability authority",()=>{
 const source=read("firebase/functions/src/core/customer-runtime.js");
 assert.match(source,/accountCountryOverrides/);
 assert.match(source,/resolveServiceAvailabilitySet/);
 assert.match(source,/admin_override/);
 assert.match(source,/operationContext/);
 assert.doesNotMatch(source,/spotlyafrica\.com\/api/);
});

test("Ride and Send callable quotes use canonical location fields and verified road routing",()=>{
 const source=read("firebase/functions/src/core/customer-runtime.js");
 for(const field of ["lat","lng","country","city","area","formattedAddress"])assert.match(source,new RegExp(field));
 assert.match(source,/verifiedRoute/);
 assert.match(source,/SPOTLY_ROUTING_URL/);
 assert.match(source,/rideQuote/);
 assert.match(source,/sendQuote/);
});

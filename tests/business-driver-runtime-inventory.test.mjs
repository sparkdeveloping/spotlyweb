import test from 'node:test';
import assert from 'node:assert/strict';
import { auditInventory, requiredFunctions } from '../scripts/business-driver-runtime-inventory.mjs';

test('a missing inventory never counts as verified', () => {
 assert.equal(auditInventory({}).filter(x=>x.status==='confirmed').length,0);
});
test('an explicit matching inventory confirms only the named callable and region',()=>{
 const inventory={result:requiredFunctions.map(fn=>({id:fn.name,region:fn.region}))};
 assert.ok(auditInventory(inventory).every(x=>x.status==='confirmed'));
});
test('wrong-region, absent and opaque region data remain unverified',()=>{
 const inventory={functions:[{id:'businessPortfolio',region:'europe-west1'},{id:'businessLifecycle'}]};
 const results=auditInventory(inventory);
 assert.equal(results.find(x=>x.name==='businessPortfolio').status,'wrong-region');
 assert.equal(results.find(x=>x.name==='businessLifecycle').status,'region-unknown');
 assert.equal(results.find(x=>x.name==='driverBootstrap').status,'missing');
});
test('resource-form function names can supply region when explicit fields are absent',()=>{
 const inventory={result:[{name:'projects/spotly-africa/locations/us-central1/functions/businessPortfolio'}]};
 assert.equal(auditInventory(inventory).find(x=>x.name==='businessPortfolio').status,'confirmed');
});

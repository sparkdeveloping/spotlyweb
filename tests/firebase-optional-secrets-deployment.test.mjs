import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pkg=JSON.parse(readFileSync(new URL("../package.json",import.meta.url),"utf8"));
const source=readFileSync(new URL("../firebase/functions/src/index.js",import.meta.url),"utf8");
const expectedCore=["platformFoundation","authenticatedFoundation","serviceAvailability","customerRuntime","customerDiscovery","customerRideQuote","customerSendQuote"];
function targetNames(script){
  const prefix="functions:platform:";
  return [...script.matchAll(/functions:platform:[A-Za-z0-9_]+/g)].map(match=>match[0].slice(prefix.length));
}
function definition(name){
  const start=source.indexOf("export const "+name+" = ");
  assert.ok(start>=0,"Missing callable: "+name);
  const end=source.indexOf("\nexport const ",start+1);
  return source.slice(start,end>=0?end:undefined);
}
test("core deployment contains only expected functions and never binds custom PIN or MapTiler secrets",()=>{
  const script=pkg.scripts["firebase:deploy:functions:core"];
  assert.ok(script.includes("--project spotly-africa"));
  assert.deepEqual(targetNames(script),expectedCore);
  for(const name of expectedCore){
    assert.doesNotMatch(definition(name),/secrets:\s*\[/,"Unexpected secret binding in "+name);
  }
});
test("search and PIN functions stay isolated in separate deployment modes",()=>{
  assert.deepEqual(targetNames(pkg.scripts["firebase:deploy:functions:place-search"]),["customerPlaceSearch"]);
  assert.deepEqual(targetNames(pkg.scripts["firebase:deploy:functions:driver-pin"]),["driverWorkAction"]);
  assert.match(definition("customerPlaceSearch"),/secrets:\s*\[CUSTOMER_PLACE_SEARCH_KEY\]/);
  assert.match(definition("driverWorkAction"),/secrets:\s*\[DRIVER_RIDE_PIN_KEY,\s*DRIVER_SEND_PIN_KEY\]/);
});
test("full deployment remains available and is not changed to skip verification",()=>{
  assert.ok(pkg.scripts["firebase:deploy:functions"].includes("--only functions:platform"));
  assert.match(source,/export const driverWorkAction = defineTrustedMutation/);
});

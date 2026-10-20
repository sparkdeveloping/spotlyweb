import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { restaurantMatchSignals, rankRestaurantCandidates } from "../lib/assist-research-match.js";

test("same chain name in a different city is not a duplicate", () => {
 const r=restaurantMatchSignals({name:"Nando's Avondale",brandName:"Nando's",city:"Harare",address:"King George Road"}, {name:"Nando's Bulawayo",brandName:"Nando's",city:"Bulawayo",address:"Main Street"});
 assert.equal(r,null);
});
test("same name and address is a strong possible duplicate", () => {
 const r=restaurantMatchSignals({name:"Londoners",city:"Harare",address:"Borrowdale Village, Harare"}, {name:"Londoners",city:"Harare",address:"Borrowdale Village"});
 assert.equal(r.rank,"high");
});
test("same brand in the same city without same outlet is only an advisory candidate", () => {
 const r=restaurantMatchSignals({name:"Nando's Avondale",brandName:"Nando's",city:"Harare",address:"King George Road"}, {name:"Nando's Sam Levy",brandName:"Nando's",city:"Harare",address:"Sam Levy Village"});
 assert.equal(r.rank,"brand_only");
});
test("same phone in same city is a suggestion, not an automatic transfer", () => {
 const matches=rankRestaurantCandidates({name:"Cafe ABC",city:"Harare",phone:"+263 712 345 678"}, [{id:"1",name:"Cafe Different",city:"Harare",phone:"0712345678"},{id:"2",name:"Cafe ABC",city:"Gweru",phone:"0712345678"}]);
 assert.equal(matches.length,1);assert.equal(matches[0].candidate.id,"1");
});
test("duplicate-review endpoint is administrator-only and read-only", () => {
 const source=readFileSync(new URL("../app/api/admin/assist-research/review/route.js",import.meta.url),"utf8");
 assert.match(source,/authenticateRequest\(request, \{ roles \}\)/);
 assert.match(source,/eligibleForPublication: false/);
 assert.match(source,/mayMissMatches: true/);
 assert.match(source,/where\("city", "==", city\)/);
 assert.doesNotMatch(source,/\.set\(|\.create\(|\.update\(|\.delete\(|batch\(|runTransaction\(/);
});

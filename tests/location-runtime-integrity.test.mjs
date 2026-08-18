import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const services = fs.readFileSync("lib/firebase-services.js", "utf8");
const branchesRoute = fs.readFileSync("app/api/business/branches/route.js", "utf8");
const branchResolver = fs.readFileSync("lib/business-branches-server.js", "utf8");
const setup = fs.readFileSync("components/business/setup.js", "utf8");
const branchesView = fs.readFileSync("components/business/branches.js", "utf8");
const staffRoute = fs.readFileSync("app/api/staff/catalogue/route.js", "utf8");
const locationDecision = fs.readFileSync("app/api/admin/location-reviews/decision/route.js", "utf8");

test("Business location loading does not depend on the businessId+name composite index", () => {
  assert.match(services, /authenticatedFetch\(`\/api\/business\/branches\?businessId=/);
  assert.doesNotMatch(services, /collection\(db, "branches"\), where\("businessId", "==", businessId\), orderBy\("name"\)/);
  assert.match(branchesRoute, /loadCanonicalBusinessBranches\(db, businessId/);
  assert.match(branchResolver, /collection\("branches"\)\.where\("businessId", "==", businessId\)\.limit\(500\)\.get\(\)/);
  assert.doesNotMatch(branchResolver, /collection\("branches"\).*orderBy\("name"\)/s);
  assert.doesNotMatch(staffRoute, /collection\("branches"\).*orderBy\("name"\)/s);
});

test("canonical location resolution can recover a branch known to Admin review even when Business linkage drifted", () => {
  assert.match(branchResolver, /collection\("businessLocationReviews"\)\.where\("businessId", "==", businessId\)/);
  assert.match(branchResolver, /reviewLinkedIds/);
  assert.match(branchResolver, /reviewEvidence/);
  assert.match(branchResolver, /businessLinkEvidence/);
  assert.match(branchResolver, /launchReviewLinkedIds/);
  assert.match(branchResolver, /claimLinkedIds/);
  assert.match(branchResolver, /safeRepairIds/);
  assert.match(branchResolver, /branchIds: canonicalIds/);
  assert.match(locationDecision, /loadCanonicalBusinessBranches\(db, initialReview\.businessId, \{ repair: true \}\)/);
});

test("location writes force an authoritative refresh instead of waiting for a lagging listener", () => {
  assert.match(services, /notifyBranchesChanged\(businessId\)/);
  assert.match(setup, /await workspace\.refreshBranches\(selectedBusinessId, \{ silent: true \}\)/);
  assert.match(branchesView, /await refreshBranches\(selectedBusinessId\)/);
});

test("location UI distinguishes a read failure from a genuinely empty business", () => {
  assert.match(branchesView, /Locations could not be loaded/);
  assert.match(branchesView, /branchesError \?/);
  assert.match(branchesView, /branchesLoading && !branches\.length/);
});

test("legacy provisional and draft location states can be normalized by the trusted branch route", () => {
  assert.match(branchesRoute, /z\.enum\(\["draft", "provisional", "active", "paused", "closed"\]\)/);
  assert.match(branchesRoute, /submitted\.status === "provisional" \? "draft"/);
});

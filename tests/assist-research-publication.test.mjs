import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const publication = read("app/api/admin/assist-research/publication/route.js");
const review = read("app/api/admin/assist-research/review/route.js");
const ui = read("components/admin-assist-research-publication.js");

test("publication requires address, operating, source-rights and duplicate checks", () => {
  assert.match(publication, /addressVerified/);
  assert.match(publication, /operatingVerified/);
  assert.match(publication, /sourceRightsReviewed/);
  assert.match(publication, /duplicatesReviewed/);
  assert.match(publication, /meaningfulAddress/);
  assert.match(publication, /requires verification/);
});
test("publishing uses deterministic canonical IDs and a Firestore publication lock", () => {
  assert.match(publication, /safeListingIds/);
  assert.match(publication, /assistPublicationKeys/);
  assert.match(publication, /tx\.create\(lock/);
  assert.match(publication, /if\(lockSnap\.exists/);
});
test("publication checks active merchants, branches, generated directory and claims", () => {
  assert.match(publication, /rankRestaurantCandidates/);
  assert.match(publication, /curatedCandidates/);
  assert.match(publication, /findLiveCandidates/);
  assert.match(publication, /businessClaims/);
  assert.match(publication, /restaurantMatchSignals/);
  assert.match(review, /openPlaces/);
});
test("new businesses are unclaimed discovery-only, and commerce is explicitly off", () => {
  assert.match(publication, /ownerIds:\[\]/);
  assert.match(publication, /capabilities:\["discover","claim"\]/);
  assert.match(publication, /commerceVerified:false,commerceEnabled:false/);
  assert.match(publication, /fulfilment:\[\]/);
  assert.match(publication, /pickup:\{enabled:false\}/);
  assert.match(publication, /assistOperationalReady:false/);
  assert.doesNotMatch(publication, /collection\("orders"\)|collection\("products"\)|collection\("paymentIntents"\)|collection\("deliveryJobs"\)/);
});
test("operator price verification never creates a public product", () => {
  assert.match(publication, /independently_verified_reference/);
  assert.match(publication, /priceCheckedAt:payload\.decision/);
  assert.match(publication, /public:false,orderable:false/);
});
test("approval requires explicit operator decision and confirms absence of automatic ordering", () => {
  assert.match(ui, /Approve & publish listing/);
  assert.match(ui, /Review & publish|Save verified review/);
  assert.match(ui, /No merchant commission/);
});
test("withdrawal refuses claimed, verified, commerce-enabled or claimed-pending business", () => {
  assert.match(publication, /ownerIds\?\.length/);
  assert.match(publication, /verificationStatus!=="unverified"/);
  assert.match(publication, /businessClaims/);
  assert.match(publication, /pendingClaims/);
});

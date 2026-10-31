import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { marketplaceTrust, safeMarketplaceCapabilities, isMarketplaceDiscoverable } from "../lib/marketplace-trust.js";
import placeDataset from "../lib/generated/open-marketplace-places.js";
import productDataset from "../lib/generated/open-marketplace-products.js";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");

test("curated Zimbabwe place graph is rights-tagged and non-transactional", () => {
  const dataset = placeDataset;
  assert.equal(dataset.meta.recordCount, dataset.records.length);
  assert.ok(dataset.records.length >= 2000);
  const cities = new Set(dataset.records.map((item) => item.city));
  for (const city of ["Harare", "Bulawayo", "Mutare", "Gweru"]) assert.ok(cities.has(city), `missing ${city}`);
  for (const item of dataset.records) {
    assert.equal(item.public, true);
    assert.equal(item.source?.type, "openstreetmap");
    assert.equal(item.source?.rightsStatus, "open_odbl");
    assert.equal(item.commerceEnabled, false);
    assert.equal(item.transactional, false);
    assert.deepEqual(item.fulfilment, []);
    assert.notEqual(item.claimStatus, "claimed");
  }
});

test("canonical products do not imply store price, stock, pickup or delivery", () => {
  const dataset = productDataset;
  assert.equal(dataset.meta.recordCount, dataset.records.length);
  assert.ok(dataset.records.length >= 100);
  assert.ok(dataset.records.some((item) => item.sourceType === "open_food_facts"));
  assert.ok(dataset.records.some((item) => item.sourceType === "spotly_reference_library"));
  for (const item of dataset.records) {
    assert.equal(item.merchantOfferRequired, true);
    assert.equal(item.storeAvailabilityConfirmed, false);
    assert.equal(item.ageRestricted, false);
    assert.equal(item.primaryImage, "");
    assert.equal("price" in item, false);
    assert.equal("stockStatus" in item, false);
    assert.equal("fulfilment" in item, false);
  }
});

test("open unclaimed listings are discoverable but cannot transact", () => {
  const listing = { public: true, status: "provisional", claimStatus: "unclaimed", verificationStatus: "listed", source: { rightsStatus: "open_odbl" }, fulfilment: ["pickup"], paymentMethods: ["cash"] };
  const trust = marketplaceTrust(listing);
  assert.equal(trust.discoveryAllowed, true);
  assert.equal(trust.discovery.claim, true);
  assert.equal(trust.commerceVerified, false);
  assert.equal(trust.commerce.pickup, false);
  assert.equal(trust.commerce.cash, false);
  const capabilities = safeMarketplaceCapabilities({ ...listing, capabilities: ["pickup_orders", "cash", "inventory"] });
  assert.ok(capabilities.includes("discover"));
  assert.ok(capabilities.includes("claim"));
  assert.ok(!capabilities.includes("pickup_orders"));
  assert.ok(!capabilities.includes("cash"));
  assert.ok(!capabilities.includes("inventory"));
});

test("rights-unclear unclaimed research records stay out of public discovery", () => {
  const unclear = { public: true, status: "provisional", claimStatus: "unclaimed", source: { rightsStatus: "provisional_review_required" } };
  assert.equal(isMarketplaceDiscoverable(unclear), false);
});

test("existing approved owner-controlled live merchants retain commerce", () => {
  const merchant = { public: true, status: "active", lifecycleStatus: "live", claimStatus: "claimed", ownerIds: ["owner-1"], verificationStatus: "approved", capabilities: ["pickup_orders"], fulfilment: ["pickup"], cashEnabled: true };
  const trust = marketplaceTrust(merchant);
  assert.equal(trust.commerceVerified, true);
  assert.equal(trust.commerce.pickup, true);
  assert.equal(trust.commerce.cash, true);
});

test("claim-pending ownership cannot unlock legacy commerce", () => {
  const merchant = { public: true, status: "active", lifecycleStatus: "live", claimStatus: "claim_pending", ownerIds: ["requester"], verificationStatus: "approved", capabilities: ["pickup_orders"], fulfilment: ["pickup"], source: { rightsStatus: "open_odbl" } };
  const trust = marketplaceTrust(merchant);
  assert.equal(trust.claimed, false);
  assert.equal(trust.trustState, "claim_pending");
  assert.equal(trust.commerceVerified, false);
});

test("server transaction paths enforce commerce verification", () => {
  for (const file of ["app/api/orders/create/route.js", "app/api/customer/transactions/create/route.js", "app/api/public/marketplace/pickup-availability/route.js"]) {
    const source = read(file);
    assert.match(source, /marketplaceTrust/);
    assert.match(source, /commerceVerified/);
  }
  const business = read("app/api/public/marketplace/business/route.js");
  assert.match(business, /products=trust\.commerceVerified\?/);
  assert.match(business, /paymentMethods:\[\]/);
  assert.match(business, /fulfilment:\[\]/);
});

test("customer search separates canonical products from merchant offers", () => {
  const search = read("app/api/public/search/route.js");
  assert.match(search, /marketplaceTrust\(business\)\.commerceVerified/);
  assert.match(search, /publicCanonicalProduct/);
  const publicDto = read("lib/marketplace-public.js");
  assert.match(publicDto, /catalogReference: true/);
  assert.match(publicDto, /merchantOfferRequired: true/);
  assert.match(publicDto, /storeAvailabilityConfirmed: false/);
  assert.match(publicDto, /price: null/);
});

test("curated claim route accepts ODbL listing but not unclear-source bulk research", () => {
  const source = read("app/api/business-claims/submit/route.js");
  assert.match(source, /provisional\.source\?\.type === "openstreetmap"/);
  assert.match(source, /provisional\.source\?\.rightsStatus === "open_odbl"/);
  assert.match(source, /source rights/);
  assert.match(source, /commerceEnabled: false/);
  assert.match(source, /paymentMethods: \[\]/);
});

test("legacy provisional seed no longer grants pickup", () => {
  const seedData = read("data/zimbabwe-businesses.js");
  const seedRoute = read("app/api/admin/seed/route.js");
  assert.doesNotMatch(seedData, /category === "Groceries" \|\| category === "Restaurants" \? \["pickup"\]/);
  assert.match(seedRoute, /pickup: \{ enabled: false/);
});

test("Admin curation imports only approved data classes and preserves claimed records", () => {
  const route = read("app/api/admin/curation/route.js");
  const ui = read("components/admin-marketplace-curation.js");
  assert.match(route, /sync_places/);
  assert.match(route, /sync_products/);
  assert.match(route, /claimed\(current\)/);
  assert.match(route, /openstreetmap/);
  assert.match(route, /open_food_facts/);
  assert.match(route, /google_maps_bulk/);
  assert.match(route, /retailer_catalog_scrape/);
  assert.match(ui, /Unclaimed pickup/);
  assert.match(ui, /Disabled/);
  assert.match(ui, /Rights-unclear sources/);
});

test("customer UI tells the truth about trust, catalogue and generic photography", () => {
  const trustUi = read("components/marketplace-trust-ui.js");
  const marketplace = read("components/marketplace-app.js");
  const search = read("components/customer-utility.js");
  const home = read("components/marketplace-home.js");
  assert.match(trustUi, /Listed on Spotly/);
  assert.match(trustUi, /Own this business\? Claim it/);
  assert.match(trustUi, /does not show merchant pickup, live stock, cash or booking controls/);
  assert.match(marketplace, /BusinessPhoto/);
  assert.match(read("components/business-photo.js"), /Illustrative photo/);
  assert.match(search, /Catalogue identity · store stock and price not confirmed/);
  assert.match(home, /Spotly includes useful city listings alongside verified commerce businesses/);
  assert.match(home, /Directory listing/);
});

test("open dataset documentation records attribution and excluded sources", () => {
  const docs = read("data/open-marketplace/README.md");
  assert.match(docs, /© OpenStreetMap contributors/);
  assert.match(docs, /ODbL 1\.0/);
  assert.match(docs, /Open Food Facts/);
  assert.match(docs, /Retailer catalogues/);
  assert.match(docs, /Google Maps-derived bulk records/);
});

test("open marketplace datasets are compiled into Git-safe JavaScript modules", () => {
  const source = read("lib/open-marketplace-data.js");
  assert.match(source, /generated\/open-marketplace-places/);
  assert.match(source, /generated\/open-marketplace-products/);
  assert.doesNotMatch(source, /zimbabwe-open-(places|products)\.json|readFileSync|process\.cwd\(\)/);
  const places = read("lib/generated/open-marketplace-places.js");
  const products = read("lib/generated/open-marketplace-products.js");
  assert.match(places, /openMarketplacePlacesDataset/);
  assert.match(products, /openMarketplaceProductsDataset/);
});

test("deployment runtime does not depend on JSON files that Git may ignore", () => {
  const ignore = read(".gitignore");
  const marketplace = read("lib/open-marketplace-data.js");
  const lottie = read("components/spotly-lottie.js");
  assert.match(ignore, /\*\.json/);
  assert.doesNotMatch(marketplace, /@\/data\/open-marketplace\/.*\.json/);
  assert.doesNotMatch(lottie, /fetch\(.*\/lottie\//);
  assert.match(lottie, /bundledLottieAsset/);
  assert.match(read("lib/generated/lottie-assets.js"), /LOTTIE_ASSETS/);
});

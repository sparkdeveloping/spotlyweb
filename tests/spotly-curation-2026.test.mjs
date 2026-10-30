import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { marketplaceEditorial } from "../lib/marketplace-curation.js";
import { marketplaceTier, rankMarketplaceBusinesses } from "../lib/marketplace-ranking.js";
import { categorizeMarketplaceProduct, enrichMarketplaceProduct } from "../lib/marketplace-product-taxonomy.js";
import { marketplaceProfile } from "../lib/marketplace-taxonomy.js";

test("Zimbabwe retail brands gain explainable editorial discovery weight, never customer stars", () => {
  for (const name of ["Pick n Pay Avondale", "TM Supermarkets", "Bon Marché Chisipite", "SPAR Arundel", "OK Mart Harare"]) {
    const info = marketplaceEditorial({ name, city: "Harare", businessType: "grocery_retail" });
    assert.equal(info.signal, "established_retail_brand", name);
    assert.ok(info.score >= 12, name);
    assert.equal(info.customerRating, false);
    assert.equal(info.openNowVerified, false);
  }
  assert.equal(marketplaceEditorial({ name: "Local Fruit and Veg", city: "Harare" }).signal, "unassessed");
  assert.equal(marketplaceEditorial({ name: "SPARK Tech", city: "Harare" }).signal, "unassessed", "Do not accidentally match substring brand names");
});

test("reported closures demote specific branches, not an entire brand or town", () => {
  const borrowing = marketplaceEditorial({ name: "Food Lover's Market", city: "Harare", area: "Borrowdale" });
  assert.equal(borrowing.signal, "branch_reverification_required");
  assert.equal(borrowing.branchReviewRequired, true);
  assert.ok(borrowing.score < 0);
  assert.equal(marketplaceEditorial({ name: "Food Lover's Market", city: "Harare", area: "Greendale" }).branchReviewRequired, false);
  assert.equal(marketplaceEditorial({ name: "Pick n Pay", city: "Mutare", area: "Chikanga" }).branchReviewRequired, true);
  assert.equal(marketplaceEditorial({ name: "Pick n Pay", city: "Harare", area: "Chikanga" }).branchReviewRequired, false);
  assert.equal(marketplaceEditorial({ name: "Pick n Pay", city: "Mutare", area: "City Centre" }).branchReviewRequired, false);
});

test("commerce, Assist and verified merchants remain higher-priority than chain recognition", () => {
  const records = rankMarketplaceBusinesses([
    { id: "independent", name: "Independent Local Grocer", public: true, source: { rightsStatus: "open_odbl" } },
    { id: "chain", name: "Bon Marche Avondale", public: true, businessType: "grocery_retail", source: { rightsStatus: "open_odbl" } },
    { id: "featuredImport", name: "Imported Supermarket", isFeatured: true, rating: 5, reviewCount: 0, source: { rightsStatus: "open_odbl" } },
    { id: "merchant", name: "Independent Merchant", public: true, businessType: "grocery_retail", commerceVerified: true, status: "active" },
    { id: "assist", name: "Independent Assist", assistStoreId: "test-store", assistAccepting: true }
  ]);
  assert.deepEqual(records.slice(0, 3).map((item) => item.id), ["merchant", "assist", "chain"]);
  assert.deepEqual(new Set(records.slice(3).map((item) => item.id)), new Set(["featuredImport", "independent"]));
  assert.equal(marketplaceTier(records[0]), 4);
});

test("product identity categories infer useful branches, preserve valid source branches", () => {
  assert.deepEqual(categorizeMarketplaceProduct({ canonicalName: "A4 2 Quire Exercise Book", categoryPath: ["Groceries", "Groceries"] }).path, ["Shopping", "Stationery & school", "Exercise books"]);
  assert.deepEqual(categorizeMarketplaceProduct({ canonicalName: "Fresh apples", categoryPath: ["Groceries", "Groceries"] }).path, ["Groceries", "Fresh produce", "Fruit"]);
  assert.deepEqual(categorizeMarketplaceProduct({ canonicalName: "Dishwashing liquid" }).path, ["Shopping", "Home essentials", "Cleaning & laundry"]);
  assert.deepEqual(categorizeMarketplaceProduct({ name: "Special roast", categoryPath: ["Food", "Premium coffee"] }).path, ["Food", "Premium coffee"]);
  const item = enrichMarketplaceProduct({ id: "x", canonicalName: "School exercise book", categoryPath: ["Groceries", "Groceries"], price: null });
  assert.equal(item.id, "x");
  assert.equal(item.price, null);
  assert.deepEqual(item.sourceCategoryPath, ["Groceries", "Groceries"]);
  assert.equal(item.categoryConfidence, "inferred");
});

test("explicit merchant archetypes override weak venue-name signals", () => {
  assert.equal(marketplaceProfile({ name: "Fresh Bakery Supermarket", businessType: "grocery_retail" }).service, "shop");
  assert.equal(marketplaceProfile({ name: "Grocery Cafe", businessType: "restaurant_food" }).service, "eat");
  assert.equal(marketplaceProfile({ name: "Retail Hall Stage", businessType: "ticketing_events" }).service, "events");
  assert.equal(marketplaceProfile({ name: "Shop Hair Salon", businessType: "appointments_services" }).service, "book");
});

test("discoverability changes remain presentation-only and never generate fake sales or ratings", async () => {
  const root = new URL("../", import.meta.url);
  const file = async (path) => readFile(new URL(path, root), "utf8");
  const [feed, search, shell, utility, data] = await Promise.all([
    file("app/api/public/service-feed/route.js"),
    file("app/api/public/search/route.js"),
    file("components/customer-shell.js"),
    file("components/customer-utility.js"),
    file("lib/open-marketplace-data.js")
  ]);
  assert.match(feed, /compareMarketplaceBusinesses/);
  assert.doesNotMatch(feed, /return 4\.1/);
  assert.match(search, /marketplaceRank/);
  assert.match(shell, /SpotlyNavIcon/);
  assert.match(utility, /Product categories/);
  assert.match(data, /enrichMarketplaceProduct/);
  assert.doesNotMatch(data, /price\s*:\s*\d{2,}/);
});

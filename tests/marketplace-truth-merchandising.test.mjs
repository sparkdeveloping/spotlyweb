import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import dataset from "../lib/generated/open-marketplace-places.js";
import { marketplaceActionLabel, marketplaceProfile } from "../lib/marketplace-taxonomy.js";

const records = dataset.records || [];
const record = (name) => records.find((item) => item.name === name);

const expectations = [
  ["Aladdin's Caves", "toys", "Toys & kids"],
  ["Albion OK Supermarket", "supermarket", "Supermarket"],
  ["AliShop", "department_store", "Department store"],
  ["All Stationary", "stationery", "Stationery & office supplies"],
  ["Amazing Fashions", "fashion", "Fashion & accessories"],
  ["Amg Studio", "photography", "Photography & photo services"],
];

test("shop directory records retain exact retail semantics", () => {
  for (const [name, vertical, label] of expectations) {
    const business = record(name);
    assert.ok(business, `${name} exists in curated dataset`);
    const profile = marketplaceProfile(business);
    assert.equal(profile.service, "shop", `${name} routes to Shop`);
    assert.equal(profile.vertical, vertical, `${name} has exact vertical`);
    assert.equal(profile.displayCategory, label, `${name} has exact customer label`);
    assert.equal(profile.cardMode, "directory", `${name} remains non-transactional`);
    assert.equal(marketplaceActionLabel(business, "shop"), "View place", `${name} does not claim commerce`);
  }
});

test("commerce verification changes actions without changing taxonomy", () => {
  const source = record("Albion OK Supermarket");
  const merchant = { ...source, commerceEnabled: true, commerceVerified: true, trustState: "commerce_verified" };
  const profile = marketplaceProfile(merchant);
  assert.equal(profile.vertical, "supermarket");
  assert.equal(profile.cardMode, "commerce");
  assert.equal(marketplaceActionLabel(merchant, "shop"), "Shop");
});

test("customer surfaces share the central marketplace taxonomy", () => {
  for (const file of ["app/api/public/service-feed/route.js", "app/api/public/search/route.js", "components/marketplace-home.js", "components/service-experience.js", "components/marketplace-app.js"]) {
    const source = fs.readFileSync(file, "utf8");
    assert.match(source, /marketplace-taxonomy/, `${file} uses central taxonomy`);
  }
});

test("service discovery separates commerce from directory actions", () => {
  const source = fs.readFileSync("components/service-experience.js", "utf8");
  assert.match(source, /Available on Spotly/);
  assert.match(source, /Directory listing · commerce not enabled/);
  assert.match(source, /Spotly does not show ordering, pickup, booking or ticket actions until the business enables verified commerce/);
  assert.doesNotMatch(source, />Category image</);
});

test("public marketplace serialization preserves source taxonomy signals", () => {
  const source = fs.readFileSync("lib/marketplace-public.js", "utf8");
  assert.match(source, /sourceTags:/);
  assert.match(source, /searchTerms:/);
  assert.match(source, /aliases:/);
});

test("retail photography is resolved by specific structured shop type", async () => {
  const { businessPhotoFamily } = await import("../lib/business-photography.js");
  assert.equal(businessPhotoFamily({ name: "Toy Shop", sourceTags: { shop: "toys" } }), "toys");
  assert.equal(businessPhotoFamily({ name: "Book Shop", sourceTags: { shop: "books" } }), "bookshop");
});

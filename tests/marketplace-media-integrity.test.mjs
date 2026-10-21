import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { marketplaceMedia, marketplaceMediaSet } from "../lib/marketplace-editorial.js";

const screenshotRestaurants = [
  "Afrotopia Café @ The Gallery",
  "Alo Alo Restaurant",
  "Amanzi",
  "Antonio's Avondale",
  "Aroma Cafe",
  "B&B Sports Bar"
].map((name, index) => ({ id: `restaurant-${index}`, name, category: index === 5 ? "Nightlife" : "Restaurants", businessType: "restaurant_food", city: "Harare" }));

test("merchant-approved marketplace media always wins over editorial fallback", () => {
  const media = marketplaceMedia({ id: "ok", name: "OK Zimbabwe", category: "Groceries", businessType: "grocery_retail", coverImage: "https://cdn.example.com/ok.jpg" });
  assert.equal(media.src, "https://cdn.example.com/ok.jpg");
  assert.equal(media.kind, "merchant");
  assert.equal(media.generated, false);
});

test("unclaimed listings use shipped, attributed category images rather than missing editorial-pack assets", () => {
  for (const [record, asset] of [
    [{ id: "food", name: "Cafe", category: "Restaurants", businessType: "restaurant_food" }, "eat.webp"],
    [{ id: "grocery", name: "Grocery", category: "Groceries", businessType: "grocery_retail" }, "groceries.webp"]
  ]) {
    const media = marketplaceMedia(record);
    assert.equal(media.kind, "editorial");
    assert.match(media.src, new RegExp(asset.replace(".", "\\.")));
    assert.ok(fs.existsSync(new URL(`../public${media.src}`, import.meta.url)), media.src);
  }
  const unsupported = marketplaceMedia({ id: "pharm", name: "Pharmacy", category: "Pharmacy" });
  assert.equal(unsupported.kind, "designed");
  assert.equal(unsupported.src, "");
  assert.equal(marketplaceMedia({ name: "Research listing", source: { type: "spotly_assist_research" }, logoUrl: "https://example.com/logo.jpg" }).kind, "designed");
});

test("editorial set avoids repeating an image when only one licensed category image ships", () => {
  const assigned = marketplaceMediaSet(screenshotRestaurants);
  const images = screenshotRestaurants.map((record) => assigned.get(record.id)?.src).filter(Boolean);
  assert.equal(images.length, 1);
  assert.match(images[0], /eat\.webp/);
});

test("marketplace UI identifies generic editorial media instead of implying it is merchant photography", () => {
  const service = fs.readFileSync(new URL("../components/service-experience.js", import.meta.url), "utf8");
  const home = fs.readFileSync(new URL("../components/marketplace-home.js", import.meta.url), "utf8");
  const app = fs.readFileSync(new URL("../components/marketplace-app.js", import.meta.url), "utf8");
  assert.match(service, /Editorial category image/);
  assert.match(home, /Editorial category image/);
  assert.match(app, /Editorial category image/);
  assert.doesNotMatch(service, /marketplace\/editorial\/eat\.webp/);
});

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

test("unclaimed marketplace records receive category-appropriate editorial media", () => {
  assert.match(marketplaceMedia({ id: "ok", name: "OK Zimbabwe", category: "Groceries", businessType: "grocery_retail" }).src, /02_Shop_Groceries/);
  assert.match(marketplaceMedia({ id: "pharm", name: "Pharmacy", category: "Pharmacy" }).src, /02_Shop_Groceries\/pharmacy_/);
  assert.match(marketplaceMedia({ id: "salon", name: "Salon", category: "Beauty & Wellness", businessType: "appointments_services" }).src, /03_Book_Beauty_Wellness/);
  assert.match(marketplaceMedia({ id: "event", name: "Live Show", category: "Events & Activities", businessType: "ticketing_events" }).src, /04_Events_Activities/);
  assert.match(marketplaceMedia({ id: "hotel", name: "Hotel", category: "Accommodation", businessType: "accommodation_activities" }).src, /07_Stay_Travel/);
});

test("visible service result sets do not repeat editorial photos while the pool has capacity", () => {
  const assigned = marketplaceMediaSet(screenshotRestaurants);
  const sources = screenshotRestaurants.map((record) => assigned.get(record.id)?.src);
  assert.equal(new Set(sources).size, screenshotRestaurants.length);
  for (const source of sources) assert.match(source, /01_Eat/);
});

test("marketplace UI identifies generic editorial media instead of implying it is merchant photography", () => {
  const service = fs.readFileSync(new URL("../components/service-experience.js", import.meta.url), "utf8");
  const home = fs.readFileSync(new URL("../components/marketplace-home.js", import.meta.url), "utf8");
  const app = fs.readFileSync(new URL("../components/marketplace-app.js", import.meta.url), "utf8");
  assert.match(service, /Category image/);
  assert.match(home, /Category image/);
  assert.match(app, /Category image/);
  assert.doesNotMatch(service, /marketplace\/editorial\/eat\.webp/);
});

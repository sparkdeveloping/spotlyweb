import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), "utf8");

test("Eat, Shop, Book and Events are first-class service routes", () => {
  for (const service of ["eat", "shop", "book", "events"]) {
    const page = read(`app/${service}/page.js`);
    assert.match(page, /MarketplaceApp/);
    assert.match(page, new RegExp(`initialService="${service}"`));
    assert.doesNotMatch(page, /redirect\(/);
  }
});

test("service feed is public read-only, rate limited and backed by live marketplace records", () => {
  const route = read("app/api/public/service-feed/route.js");
  assert.match(route, /verifyAppCheckRequest/);
  assert.match(route, /enforceRateLimit/);
  assert.match(route, /collection\("businesses"\)/);
  assert.match(route, /collection\("branches"\)/);
  assert.match(route, /collection\("products"\)/);
  assert.match(route, /pickupAvailability/);
  assert.match(route, /nextOffset/);
});

test("service experience provides dedicated discovery controls and real deep links", () => {
  const experience = read("components/service-experience.js");
  const marketplace = read("components/marketplace-app.js");
  assert.match(experience, /What are you craving/);
  assert.match(experience, /Find what you need nearby/);
  assert.match(experience, /Make time for something/);
  assert.match(experience, /Make plans in your city/);
  assert.match(experience, /Delivery/);
  assert.match(experience, /Pickup/);
  assert.match(experience, /Open now/);
  assert.match(experience, /Tonight/);
  assert.match(experience, /Weekend/);
  assert.match(experience, /Load more/);
  assert.match(marketplace, /ServiceDiscoveryView/);
  assert.match(marketplace, /onOpenItem=\{openSearchResult\}/);
  assert.match(marketplace, /onToggleSaved=\{toggleSavedResult\}/);
});

test("service switching uses canonical service URLs while Ride and Send remain gated", () => {
  const marketplace = read("components/marketplace-app.js");
  assert.match(marketplace, /router\.push\(`\/\$\{nextService\}`\)/);
  assert.match(marketplace, /service === "ride" && !ridesEnabled/);
  assert.match(marketplace, /service === "send" && !sendEnabled/);
  assert.match(marketplace, /Opening area by area/);
});

test("service discovery preserves Saved, Activity and existing transaction continuity", () => {
  const marketplace = read("components/marketplace-app.js");
  const experience = read("components/service-experience.js");
  assert.match(experience, /savedItems/);
  assert.match(experience, /Again/);
  assert.match(experience, /onActivity/);
  assert.match(marketplace, /CustomerTransactionModal/);
  assert.match(marketplace, /CheckoutModal/);
  assert.match(marketplace, /OfferDetailModal/);
});

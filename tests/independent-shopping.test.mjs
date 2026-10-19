import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  INDEPENDENT_SHOPPING_DISCLOSURE, independentShoppingFlags,
  independentPublicStore, independentQuote, currentIndependentItem
} from "../lib/independent-shopping.js";

const now = Date.now();
const checkedAt = new Date(now - 2 * 60 * 60_000).toISOString();
const eligible = {
  name: "Sample Independent Restaurant",
  city: "Harare",
  area: "Avondale",
  address: "Example Road, Avondale, Harare",
  affiliation: "unaffiliated",
  sourcingModel: "independent_in_person",
  status: "published",
  logo: "not allowed",
  image: "copyright-photo.jpg",
  businessId: "not_an_official_merchant",
  items: [
    { id: "meal-1", name: "Meal, regular", priceEstimate: 8.5, priceCheckedAt: checkedAt, status: "available", image: "copyright-menu-photo" },
    { id: "meal-2", name: "Meal, large", priceEstimate: 13, priceCheckedAt: checkedAt, status: "available" },
    { id: "stale", name: "Old dish", priceEstimate: 2, priceCheckedAt: new Date(now - 20 * 86400_000).toISOString(), status: "available" }
  ]
};

test("assisted discovery is on by default, unless an operator pauses it", () => {
  assert.deepEqual(independentShoppingFlags({}), { browseEnabled: true, requestEnabled: true });
  assert.deepEqual(independentShoppingFlags({ independentShopping: { browseEnabled: false, requestEnabled: true } }), { browseEnabled: false, requestEnabled: false });
  assert.deepEqual(independentShoppingFlags({ independentShopping: { browseEnabled: true, requestEnabled: false } }), { browseEnabled: true, requestEnabled: false });
});

test("only unpartnered, independently sourced published stores become visible", () => {
  assert.equal(independentPublicStore("s", { ...eligible, status: "draft" }, now), null);
  assert.equal(independentPublicStore("s", { ...eligible, affiliation: "partner" }, now), null);
  assert.equal(independentPublicStore("s", { ...eligible, sourcingModel: "merchant_catalog" }, now), null);
  assert.equal(independentPublicStore("s", eligible, now)?.model, "independent_shopping");
});

test("stale prices are excluded and new prices must be independently checked", () => {
  const store = independentPublicStore("s", eligible, now);
  assert.equal(store.items.length, 2);
  assert(!store.items.some((item) => item.id === "stale"));
  assert.equal(currentIndependentItem({ id: "x", name: "Meal", priceEstimate: 5, status: "available", priceCheckedAt: new Date(now + 86400_000).toISOString() }, now), false);
  assert.equal(independentPublicStore("s", { ...eligible, items: eligible.items.slice(2) }, now), null);
});

test("public storefront strips copyrighted images and official business identifiers", () => {
  const store = independentPublicStore("s", eligible, now);
  assert.equal(store.logo, undefined);
  assert.equal(store.image, undefined);
  assert.equal(store.businessId, undefined);
  assert.equal(store.items[0].image, undefined);
  assert.match(store.disclaimer, /not affiliated/i);
  assert.match(INDEPENDENT_SHOPPING_DISCLOSURE, /not affiliated/i);
});

test("quote uses server prices and clearly cannot trigger capture or dispatch", () => {
  const store = independentPublicStore("s", eligible, now);
  const estimate = independentQuote(store, [{ itemId: "meal-1", quantity: 2 }], { shoppingFee: 1.5, deliveryFee: 3 }, now);
  assert.equal(estimate.merchandiseEstimate, 17);
  assert.equal(estimate.totalEstimate, 21.5);
  assert.equal(estimate.isFinalPrice, false);
  assert.equal(estimate.paymentRequired, false);
  assert.equal(estimate.dispatchCreated, false);
  assert.equal(estimate.currency, "USD");
});

test("independent requests cannot use unknown, duplicated, or excessive menu items", () => {
  const store = independentPublicStore("s", eligible, now);
  assert.throws(() => independentQuote(store, [{ itemId: "unknown", quantity: 1 }], {}, now));
  assert.throws(() => independentQuote(store, [{ itemId: "meal-1", quantity: 1 }, { itemId: "meal-1", quantity: 2 }], {}, now));
  assert.throws(() => independentQuote(store, [{ itemId: "meal-1", quantity: 11 }], {}, now));
});

test("new independent path never writes merchant orders, settlements or driver dispatch", () => {
  const route = readFileSync(new URL("../app/api/customer/independent-shopping/requests/route.js", import.meta.url), "utf8");
  assert.match(route, /independentShoppingRequests/);
  assert.match(route, /paymentStatus: "not_initiated"/);
  assert.match(route, /dispatchStatus: "not_dispatched"/);
  assert.doesNotMatch(route, /collection\("orders"\)|collection\("deliveryJobs"\)|collection\("paymentIntents"\)|postPaymentCapturedLedger|dispatchDelivery/);
  const merchant = readFileSync(new URL("../app/api/orders/create/route.js", import.meta.url), "utf8");
  assert.match(merchant, /marketplaceTrust\(businessData\)\.commerceVerified/);
});

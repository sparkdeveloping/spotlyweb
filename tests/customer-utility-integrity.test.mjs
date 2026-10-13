import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), "utf8");

test("global customer search is server-backed, mixed-type, and rate limited", () => {
  const route = read("app/api/public/search/route.js");
  const services = read("lib/firebase-services.js");
  const utility = read("components/customer-utility.js");
  assert.match(route, /enforceRateLimit/);
  assert.match(route, /business/);
  assert.match(route, /product/);
  assert.match(route, /service/);
  assert.match(route, /event/);
  assert.match(route, /place/);
  assert.match(services, /export async function searchSpotly/);
  assert.match(utility, /CustomerSearchView/);
  assert.match(utility, /Recent searches/);
});

test("generic customer saved items are self-scoped in Firestore rules", () => {
  const rules = read("firestore.rules");
  const services = read("lib/firebase-services.js");
  assert.match(rules, /match \/savedItems\/\{savedItemId\}/);
  assert.match(rules, /request\.resource\.data\.userId == request\.auth\.uid/);
  assert.match(rules, /resource\.data\.userId == request\.auth\.uid/);
  assert.match(services, /saveSavedItem/);
  assert.match(services, /deleteSavedItem/);
  assert.match(services, /subscribeSavedItems/);
});

test("saved businesses are loaded independently of the current marketplace city", () => {
  const marketplace = read("components/marketplace-app.js");
  assert.match(marketplace, /favoriteBusinesses/);
  assert.match(marketplace, /loadPublicMarketplaceBusiness\(businessId\)/);
  assert.match(marketplace, /businessEntries=\{favoriteBusinesses\.map/);
});

test("customer activity provides lifecycle buckets and contextual help", () => {
  const marketplace = read("components/marketplace-app.js");
  assert.match(marketplace, /Needs attention/);
  assert.match(marketplace, /Active now/);
  assert.match(marketplace, /Upcoming/);
  assert.match(marketplace, /Past/);
  assert.match(marketplace, /\/support\?topic=orders/);
});

test("customer notification center has dedicated customer categories", () => {
  const center = read("components/notification-center.js");
  const page = read("app/notifications/page.js");
  assert.match(center, /customerMode/);
  assert.match(center, /Bookings/);
  assert.match(center, /Support/);
  assert.match(center, /Account/);
  assert.match(page, /customerMode/);
});

test("account supports saved places and shopping defaults", () => {
  const account = read("components/account-app.js");
  assert.match(account, /Saved places/);
  assert.match(account, /preferredCurrency/);
  assert.match(account, /defaultFulfilment/);
  assert.match(account, /saveSavedItem/);
  assert.match(account, /\/notifications/);
  assert.match(account, /\/support/);
});

test("checkout consumes the customer's preferred fulfilment mode", () => {
  const marketplace = read("components/marketplace-app.js");
  assert.match(marketplace, /defaultFulfilment = "pickup"/);
  assert.match(marketplace, /profile\?\.preferences\?\.defaultFulfilment/);
});

test("customer support includes utility and transaction help resources", () => {
  const support = read("components/support-app.js");
  assert.match(support, /Track an order or delivery/);
  assert.match(support, /booking, appointment or ticket/i);
  assert.match(support, /Saved/);
  assert.match(support, /saved places/i);
});

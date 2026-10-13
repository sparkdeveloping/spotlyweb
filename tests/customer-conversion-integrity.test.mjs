import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
async function source(path) { return readFile(new URL(path, root), "utf8"); }

test("customer booking and ticket creation is authenticated, rate limited, and idempotent", async () => {
  const code = await source("app/api/customer/transactions/create/route.js");
  assert.match(code, /authenticateRequest\(request\)/);
  assert.match(code, /enforceRateLimit\(request/);
  assert.match(code, /customerTransactionRequests/);
  assert.match(code, /db\.runTransaction/);
  assert.match(code, /transaction\.create\(requestRef/);
});

test("customer transaction route verifies live business, branch, product and server price", async () => {
  const code = await source("app/api/customer/transactions/create/route.js");
  assert.match(code, /business\.public === true/);
  assert.match(code, /branch\.businessId !== body\.businessId/);
  assert.match(code, /product\.businessId !== body\.businessId/);
  assert.match(code, /product\.prices\?\.\[body\.currency\]/);
  assert.match(code, /reservedQuantity/);
});

test("marketplace conversion layer exposes item detail and booking flow", async () => {
  const app = await source("components/marketplace-app.js");
  const conversion = await source("components/customer-conversion.js");
  assert.match(app, /OfferDetailModal/);
  assert.match(app, /CustomerTransactionModal/);
  assert.match(app, /TransactionSummary/);
  assert.match(conversion, /\/api\/customer\/transactions\/create/);
  assert.match(conversion, /\/api\/payments\/paynow\/initiate/);
});

test("customer Activity supports cancellation and keeps sensitive idempotency records server-only", async () => {
  const app = await source("components/marketplace-app.js");
  const cancel = await source("app/api/orders/cancel/route.js");
  const rules = await source("firestore.rules");
  assert.match(app, /\/api\/orders\/cancel/);
  assert.match(app, /Cancel this activity/);
  assert.match(cancel, /customer-order-cancel/);
  assert.match(cancel, /releaseReservationInTransaction/);
  assert.match(rules, /customerTransactionRequests\/\{requestId\}.*allow read, write: if false/s);
});

test("ticket issuance creates an entry code and customer Activity renders it", async () => {
  const businessUpdate = await source("app/api/business-orders/update/route.js");
  const conversion = await source("components/customer-conversion.js");
  assert.match(businessUpdate, /createTicketCode/);
  assert.match(businessUpdate, /nextStatus === "issued"/);
  assert.match(businessUpdate, /changes\.ticketCode/);
  assert.match(conversion, /Entry code/);
});

test("shareable customer routes resolve into live marketplace state", async () => {
  const app = await source("components/marketplace-app.js");
  const item = await source("app/item/[id]/page.js");
  const place = await source("app/place/[id]/page.js");
  assert.match(app, /requestedOffer/);
  assert.match(item, /business=.*offer=/);
  assert.match(place, /business=/);
});

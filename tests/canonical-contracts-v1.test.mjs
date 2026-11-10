import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { routeHarness } from "./helpers/route-harness.mjs";
import {
  SPOTLY_CONTRACT_VERSION, SPOTLY_CONTRACT_SHA256, SERVICE_IDS, COUNTRY_CODES, CURRENCY_CODES,
  ACTIVITY_KINDS, DRIVER_WORK_TYPES
} from "../lib/contracts/generated.js";

const root = new URL("../", import.meta.url);
const json = async (relative) => JSON.parse(await readFile(new URL(relative, root), "utf8"));
const text = async (relative) => readFile(new URL(relative, root), "utf8");
const hasLocation = (value) => value && Number.isFinite(value.lat) && Number.isFinite(value.lng) && COUNTRY_CODES.includes(value.country);

test("generated binding is pinned to the canonical manifest", async () => {
  const raw = await text("contracts/spotly-contracts.v1.json");
  const manifest = JSON.parse(raw);
  const hash = createHash("sha256").update(raw).digest("hex");
  assert.equal(manifest.contractVersion, "1.0.0");
  assert.equal(SPOTLY_CONTRACT_VERSION, manifest.contractVersion);
  assert.equal(SPOTLY_CONTRACT_SHA256, hash);
  assert.deepEqual(SERVICE_IDS, manifest["x-spotly-enums"].serviceIds);
  assert.deepEqual(COUNTRY_CODES, manifest["x-spotly-enums"].countryCodes);
  assert.deepEqual(CURRENCY_CODES, manifest["x-spotly-enums"].currencyCodes);
  assert.deepEqual(ACTIVITY_KINDS, manifest["x-spotly-enums"].activityKinds);
  assert.deepEqual(DRIVER_WORK_TYPES, manifest["x-spotly-enums"].driverWorkTypes);
});

test("fixtures encode the contract regressions Phase 1 is meant to prevent", async () => {
  const ride = await json("contracts/fixtures/ride-request.valid.json");
  assert.ok(hasLocation(ride.pickup) && hasLocation(ride.dropoff));
  assert.equal(typeof ride.quotedTotal, "number");
  assert.ok(["USD", "ZWG"].includes(ride.quotedCurrency));

  const missingCountry = await json("contracts/fixtures/ride-request.invalid-missing-country.json");
  assert.equal(hasLocation(missingCountry.pickup), false);

  const send = await json("contracts/fixtures/send-request.valid.json");
  assert.equal(send.pickup.country, "ZW");
  assert.equal(send.dropoff.country, "ZW");
  assert.equal(send.prohibitedAcknowledged, true);
  assert.equal(typeof send.quotedTotal, "number");

  const malawiSend = await json("contracts/fixtures/send-request.valid-malawi.json");
  assert.equal(malawiSend.pickup.country, "MW");
  assert.equal(malawiSend.dropoff.country, "MW");
  assert.equal(malawiSend.quotedCurrency, "MWK");

  const activity = await json("contracts/fixtures/activity-record.valid.json");
  assert.ok(ACTIVITY_KINDS.includes(activity.kind));
  assert.ok(SERVICE_IDS.includes(activity.service));
  assert.ok(CURRENCY_CODES.includes(activity.currency));

  const assistedActivity = await json("contracts/fixtures/activity-assist-booking.valid.json");
  assert.equal(assistedActivity.kind, "assist_booking");
  assert.equal(assistedActivity.currency, null);
  assert.equal(assistedActivity.primaryAction, "review_alternative");

  const transaction = await json("contracts/fixtures/transaction-appointment.valid.json");
  assert.equal(transaction.paymentMethod, "pay_later");
  assert.equal(transaction.currency, "USD");

  const offer = await json("contracts/fixtures/driver-work-offer.valid.json");
  assert.ok(DRIVER_WORK_TYPES.includes(offer.workType));
  assert.ok(CURRENCY_CODES.includes(offer.currency));
});

test("canonical Zod schemas accept/reject the fixtures through the dependency-free route harness", async () => {
  const { load } = routeHarness(fileURLToPath(new URL("../", import.meta.url)));
  const schemas = load("lib/contracts/schemas.js");
  assert.equal(schemas.rideCreateRequestSchema.safeParse(await json("contracts/fixtures/ride-request.valid.json")).success, true);
  assert.equal(schemas.rideCreateRequestSchema.safeParse(await json("contracts/fixtures/ride-request.invalid-missing-country.json")).success, false);
  assert.equal(schemas.sendCreateRequestSchema.safeParse(await json("contracts/fixtures/send-request.valid.json")).success, true);
  assert.equal(schemas.sendCreateRequestSchema.safeParse(await json("contracts/fixtures/send-request.valid-malawi.json")).success, true);
  assert.equal(schemas.orderCreateRequestSchema.safeParse(await json("contracts/fixtures/order-create.valid.json")).success, true);
  assert.equal(schemas.transactionCreateRequestSchema.safeParse(await json("contracts/fixtures/transaction-appointment.valid.json")).success, true);
  assert.equal(schemas.activityRecordSchema.safeParse(await json("contracts/fixtures/activity-record.valid.json")).success, true);
  assert.equal(schemas.activityRecordSchema.safeParse(await json("contracts/fixtures/activity-assist-booking.valid.json")).success, true);
  assert.equal(schemas.driverWorkOfferSchema.safeParse(await json("contracts/fixtures/driver-work-offer.valid.json")).success, true);
});

test("production mutation routes consume canonical schemas rather than private copies", async () => {
  const files = {
    ride: await text("app/api/customer/rides/route.js"),
    rideQuote: await text("app/api/customer/rides/quote/route.js"),
    send: await text("app/api/customer/parcels/route.js"),
    sendQuote: await text("app/api/customer/parcels/quote/route.js"),
    order: await text("app/api/orders/create/route.js"),
    transaction: await text("app/api/customer/transactions/create/route.js")
  };
  assert.match(files.ride, /rideCreateRequestSchema/);
  assert.match(files.rideQuote, /rideQuoteRequestSchema/);
  assert.match(files.send, /sendCreateRequestSchema/);
  assert.match(files.sendQuote, /sendQuoteRequestSchema/);
  assert.match(files.order, /orderCreateRequestSchema/);
  assert.match(files.transaction, /transactionCreateRequestSchema/);
  for (const source of Object.values(files)) assert.match(source, /@\/lib\/contracts\/schemas/);
});

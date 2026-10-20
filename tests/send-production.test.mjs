import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Send customer request is authoritative and creates Activity continuity with handoff PINs", async () => {
  const source = await read("app/api/customer/parcels/route.js");
  assert.match(source, /parcelAvailability\(settings, pickup\)/);
  assert.match(source, /pickupPin = makeParcelPin\(\)/);
  assert.match(source, /dropoffPin = makeParcelPin\(\)/);
  assert.match(source, /transaction\.create\(parcelRef/);
  assert.match(source, /transaction\.create\(orderRef/);
  assert.match(source, /transactionType: "send"/);
  assert.match(source, /businessName: "Spotly Send"/);
});

test("Send pricing, parcel sizes and rollout are controlled by mobility settings", async () => {
  const source = await read("lib/parcel-server.js");
  for (const token of ["enabledCities","enabledAreas","baseFare","perKm","driverSharePercent","small","medium","large","bulky","requiredVehicleTypes"]) assert.match(source, new RegExp(token));
});

test("Send dispatch uses fresh eligible nearby Drivers and parcel vehicle compatibility", async () => {
  const source = await read("lib/parcel-server.js");
  assert.match(source, /operationalEligibility/);
  assert.match(source, /locationUpdatedAt/);
  assert.match(source, /maxPickupKm/);
  assert.match(source, /requiredVehicleTypes/);
  assert.match(source, /parcelOffers/);
  assert.match(source, /state: "expired"/);
});

test("Send offer acceptance is transactional and reserves Driver capacity", async () => {
  const source = await read("app/api/driver/parcel-offers/route.js");
  assert.match(source, /db\.runTransaction/);
  assert.match(source, /Another Driver already accepted this Send request/);
  assert.match(source, /presence\.currentJobId/);
  assert.match(source, /currentWorkType: "send"/);
  assert.match(source, /availabilityState: "on_send"/);
  assert.match(source, /state: "withdrawn"/);
});

test("Send handoff requires pickup and recipient PINs plus configurable proof of delivery", async () => {
  const source = await read("app/api/driver/parcels/route.js");
  assert.match(source, /matchesParcelPin/);
  assert.match(source, /matchesParcelPin/);
  assert.match(source, /proofPhotoRequired === true/);
  assert.match(source, /proofPhotoUrl/);
  assert.match(source, /state: nextState/);
});

test("Send cash and digital completion use Driver Money correctly", async () => {
  const [route,money] = await Promise.all([read("app/api/driver/parcels/route.js"),read("lib/driver-money-server.js")]);
  assert.match(route, /recordCashParcelPlatformFee/);
  assert.match(route, /creditParcelEarnings/);
  assert.match(money, /parcel_cash_platform_fee/);
  assert.match(money, /parcel_earned/);
});

test("Paid Paynow Send requests transition into dispatch automatically", async () => {
  const source = await read("lib/payment-processor-server.js");
  assert.match(source, /order\.transactionType === "send"/);
  assert.match(source, /patch.state=scheduledMs.*"scheduled":"searching_driver"/);
  assert.match(source, /dispatchParcel/);
  assert.match(source, /parcel_dispatch_failed/);
});

test("Driver workspace includes Send offers, active workflow, history and incident attachment", async () => {
  const [bootstrap,ui,incidents] = await Promise.all([read("app/api/driver/bootstrap/route.js"),read("components/driver-app.js"),read("app/api/driver/incidents/route.js")]);
  assert.match(bootstrap, /parcelOffers/); assert.match(bootstrap, /activeParcel/); assert.match(bootstrap, /parcels/);
  assert.match(ui, /function ActiveParcel/); assert.match(ui, /ParcelOfferCard/); assert.match(ui, /driver-send-proof/);
  assert.match(incidents, /parcelJobId/);
});

test("Admin Send Operations exposes network controls, dispatch, assignment and exceptions", async () => {
  const [ui,api] = await Promise.all([read("components/admin-driver-operations.js"),read("app/api/admin/parcels/route.js")]);
  assert.match(ui, /label:"Send"/); assert.match(ui, /Send network controls/); assert.match(ui, /Find Drivers/); assert.match(ui, /Cancel Send/);
  assert.match(api, /mobility\.send_settings\.updated/); assert.match(api, /enabledAreas/); assert.match(api, /clear_exception/); assert.match(api, /requiredVehicleTypes/);
});

test("Send dispatch watchdog is secret protected and scheduled", async () => {
  const [route,vercel] = await Promise.all([read("app/api/internal/parcel-dispatch/route.js"),read("vercel.json")]);
  assert.match(route, /CRON_SECRET/); assert.match(route, /authorization/); assert.match(route, /dispatchParcel/); assert.match(vercel, /api\/internal\/parcel-dispatch/);
});

test("Send operational collections and proof uploads are protected", async () => {
  const [rules,storage,indexes] = await Promise.all([read("firestore.rules"),read("storage.rules"),read("firestore.indexes.json")]);
  for (const name of ["parcelJobs","parcelOffers","parcelEvents"]) assert.match(rules,new RegExp(`match /${name}`));
  assert.match(storage,/driver-send-proof/); assert.match(storage,/request\.auth\.uid == uid/);
  const groups=JSON.parse(indexes).indexes.map(x=>x.collectionGroup); assert.ok(groups.includes("parcelJobs")); assert.ok(groups.includes("parcelOffers"));
});

test("Customer Activity and Home route Send into the live Send product", async () => {
  const ui = await read("components/marketplace-app.js");
  assert.match(ui, /nextService === "send"/); assert.match(ui, /router\.push\(`\/\$\{nextService\}`\)/); assert.match(ui, /Manage Send/); assert.match(ui, /api\/customer\/parcels/);
});

test("Scheduled Send defers dispatch until the pickup window and preserves paid scheduling", async () => {
  const [customer, processor, cron, server] = await Promise.all([read("app/api/customer/parcels/route.js"), read("lib/payment-processor-server.js"), read("app/api/internal/parcel-dispatch/route.js"), read("lib/parcel-server.js")]);
  assert.match(customer, /pickupMode: z\.enum\(\["now", "scheduled"\]\)/);
  assert.match(customer, /Schedule pickup at least 20 minutes from now/);
  assert.match(customer, /Scheduled Send pickup can be booked up to 7 days ahead/);
  assert.match(processor, /patch.state=scheduledMs.*"scheduled":"searching_driver"/);
  assert.match(cron, /dispatch\.scheduled_due/);
  assert.match(cron, /dueCutoff = Date\.now\(\) \+ 15 \* 60_000/);
  assert.match(server, /scheduled: \["searching_driver", "cancelled", "failed"\]/);
});

test("Parcel size weight limits and prohibited-item acknowledgement are server enforced", async () => {
  const source = await read("app/api/customer/parcels/route.js");
  assert.match(source, /estimatedWeightKg: z\.number\(\)\.min\(0\.1\)\.max\(100\)/);
  assert.match(source, /body\.estimatedWeightKg.*quote\.maxKg/);
  assert.match(source, /prohibitedAcknowledged: z\.literal\(true\)/);
});

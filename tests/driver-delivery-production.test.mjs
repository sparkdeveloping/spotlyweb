import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("production Driver no longer imports seeded training jobs or session workflow", async () => {
  const [driver, account] = await Promise.all([read("components/driver-app.js"), read("components/account-app.js")]);
  assert.doesNotMatch(driver, /driver-training-workflow|@\/data\/driver|Training only:/);
  assert.doesNotMatch(account, /Driver training|live dispatch is connected/);
  assert.match(driver, /\/api\/driver\/bootstrap/);
  assert.match(driver, /navigator\.geolocation/);
});

test("customer order creation can create a durable delivery job without exposing the customer PIN on the order", async () => {
  const source = await read("app/api/orders/create/route.js");
  assert.match(source, /fulfilment:\s*z\.enum\(\["pickup",\s*"delivery"\]\)/);
  assert.match(source, /db\.collection\("deliveryJobs"\)/);
  assert.match(source, /customerPin/);
  const orderObjectStart = source.indexOf("const order = {");
  const orderObjectEnd = source.indexOf("};", orderObjectStart);
  const orderObject = source.slice(orderObjectStart, orderObjectEnd);
  assert.doesNotMatch(orderObject, /customerPin\s*:/);
});

test("Driver bootstrap strips pickup and handoff secrets from every delivery payload", async () => {
  const source = await read("app/api/driver/bootstrap/route.js");
  assert.match(source, /pickupCode:\s*undefined/);
  assert.match(source, /customerPin:\s*undefined/);
  assert.match(source, /rawJobs\.map\(sanitizeJob\)/);
});

test("delivery completion uses a deterministic ledger entry and never reads after writing in the money helper", async () => {
  const [money, delivery] = await Promise.all([read("lib/driver-money-server.js"), read("app/api/driver/delivery/route.js")]);
  assert.match(money, /driverLedgerEntryId\("delivery_earned", deliveryJobId\)/);
  assert.doesNotMatch(money, /transaction\.get\(ledgerRef\)/);
  assert.match(money, /effects:\s*\{ available: numeric \}/);
  assert.match(delivery, /creditDeliveryEarnings/);
});

test("Driver payout moves authoritative balance buckets and requires a verified destination", async () => {
  const [driverPayout, adminPayout] = await Promise.all([read("app/api/driver/payout/route.js"), read("app/api/admin/driver-money/route.js")]);
  assert.match(driverPayout, /verificationState !== "verified"/);
  assert.match(driverPayout, /available: -amount, reserved: amount/);
  assert.match(adminPayout, /reserved: -amount, processing: amount/);
  assert.match(adminPayout, /processing: -amount, paid_out: amount/);
  assert.match(adminPayout, /reference\.length < 3/);
});

test("Kiosk live runtime is device scoped rather than Business-session scoped", async () => {
  const [kiosk, server] = await Promise.all([read("components/business/kiosk.js"), read("lib/kiosk-server.js")]);
  assert.doesNotMatch(kiosk, /AuthGate|BusinessDataProvider/);
  assert.match(kiosk, /x-spotly-kiosk-device/);
  assert.match(kiosk, /x-spotly-kiosk-credential/);
  assert.match(server, /credentialHash/);
});

test("Firestore explicitly protects new Driver Delivery Money and Kiosk collections", async () => {
  const rules = await read("firestore.rules");
  for (const name of ["driverApplications", "drivers", "driverDocuments", "driverVehicles", "driverPayoutAccounts", "driverPresence", "deliveryJobs", "deliveryOffers", "deliveryEvents", "driverEarningsLedger", "driverBalanceAccounts", "driverPayouts", "driverIncidents", "dispatchZones", "kioskDevices"]) {
    assert.match(rules, new RegExp(`match /${name}`), `${name} must be explicit in Firestore rules`);
  }
  assert.match(rules, /match \/deliveryJobs\/\{jobId\} \{ allow read, write: if false; \}/);
});

test("Admin Driver approval validates evidence before writing approval state", async () => {
  const source = await read("app/api/admin/drivers/route.js");
  const start = source.indexOf('if (body.action === "approve")');
  const end = source.indexOf('} else if (body.action === "request_information")', start);
  const block = source.slice(start, end);
  assert.ok(block.indexOf("approvedVehicle") < block.indexOf("batch.set(appRef"));
  assert.ok(block.indexOf('approvedTypes.has("identity")') < block.indexOf("batch.set(appRef"));
  assert.ok(block.indexOf('approvedTypes.has("licence")') < block.indexOf("batch.set(appRef"));
});

test("Business delivery is visible in live commerce navigation and branchless kiosk/delivery refuse fake Main location", async () => {
  const [archetypes, kiosk, delivery] = await Promise.all([read("data/business-archetypes.js"), read("components/business/kiosk.js"), read("components/business/delivery.js")]);
  assert.match(archetypes, /id: "delivery"/);
  assert.match(archetypes, /href\("\/business\/delivery"\)/);
  assert.match(kiosk, /Add a location before enrolling a kiosk/);
  assert.match(kiosk, /will not invent a “Main location.”/);
  assert.match(delivery, /Add the pickup location first/);
});

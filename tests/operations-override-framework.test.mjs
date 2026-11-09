import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { operationContext, operationGrantMatches } from "../lib/operations-grants.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const future = "2026-12-01T00:00:00.000Z";
const past = "2026-10-01T00:00:00.000Z";
const now = new Date("2026-11-08T18:00:00.000Z");

function grant(type, extra = {}) {
  return { status: "active", type, services: [], countries: [], cities: [], expiresAt: future, ...extra };
}

test("operations grants are active, expiring and scope by service country and city", () => {
  const scoped = grant("service_operations", { services: ["ride"], countries: ["ZW"], cities: ["ZW:harare"] });
  assert.equal(operationGrantMatches(scoped, { type: "service_operations", service: "ride", country: "ZW", city: "Harare", now }), true);
  assert.equal(operationGrantMatches(scoped, { type: "service_operations", service: "send", country: "ZW", city: "Harare", now }), false);
  assert.equal(operationGrantMatches(scoped, { type: "service_operations", service: "ride", country: "MW", city: "Lilongwe", now }), false);
  assert.equal(operationGrantMatches({ ...scoped, expiresAt: past }, { type: "service_operations", service: "ride", country: "ZW", city: "Harare", now }), false);
});

test("service operations includes preview but never implicitly grants payment location or Driver authority", () => {
  const context = operationContext([grant("service_operations")], { service: "ride", country: "ZW", city: "Harare", now });
  assert.equal(context.servicePreview, true);
  assert.equal(context.serviceOperations, true);
  assert.equal(context.paymentSandbox, false);
  assert.equal(context.locationOverride, false);
  assert.equal(context.driverOperations, false);
});

test("admin grant API is server-owned, bounded, auditable and revocable", async () => {
  const [route, rules, ui] = await Promise.all([
    read("app/api/admin/operations-grants/route.js"), read("firestore.rules"), read("components/admin-operations-grants.js")
  ]);
  assert.match(route, /90 \* 24 \* 60 \* 60_000/);
  assert.match(route, /operations_grant\.issued/);
  assert.match(route, /operations_grant\.revoked/);
  assert.match(route, /canonical cities/i);
  assert.match(rules, /match \/operationGrants\/\{grantId\}[\s\S]*allow read, write: if false/);
  assert.match(rules, /match \/operationsRuns\/\{runId\}[\s\S]*allow read, write: if false/);
  for (const label of ["Service preview", "Service operations", "Payment sandbox", "Location override", "Driver operations"]) assert.match(ui, new RegExp(label));
});

test("legacy special-case tester authority is removed from runtime contracts and product code", async () => {
  const files = [
    "contracts/spotly-contracts.v1.json", "lib/contracts/schemas.js", "components/customer-conversion.js",
    "components/ride-app.js", "components/driver-app.js", "lib/customer-launch-server.js"
  ];
  for (const file of files) {
    const source = await read(file);
    assert.doesNotMatch(source, /superadmin_test|privateBeta|testerEmails|mobilityRideLab|Ride Lab|ride-lab/, file);
  }
});

test("real production checkout cannot use Operations grants as a fake-paid bypass", async () => {
  const [orders, transactions] = await Promise.all([read("app/api/orders/create/route.js"), read("app/api/customer/transactions/create/route.js")]);
  for (const source of [orders, transactions]) {
    assert.doesNotMatch(source, /superadmin_test|test_paid|isTestOrder/);
    assert.doesNotMatch(source, /serviceOperations.*marketplaceOpen|marketplaceOpen.*serviceOperations/);
  }
});

test("Operations checkout validates real catalogue inputs and isolates inventory and money", async () => {
  const source = await read("app/api/operations/checkout/route.js");
  assert.match(source, /requireOperationGrant\(db, user\.uid, \{ type: "service_operations"/);
  assert.match(source, /type: "payment_sandbox"/);
  assert.match(source, /db\.collection\("products"\)/);
  assert.match(source, /branchPaymentMethods/);
  assert.match(source, /db\.collection\("operationsRuns"\)/);
  assert.match(source, /financialIsolation: true/);
  assert.match(source, /inventoryIsolation: true/);
  assert.match(source, /providerCalled: false/);
  assert.match(source, /fundsMoved: false/);
  for (const collection of ["orders", "payments", "driverEarningsLedger", "merchantLedger", "inventoryReservations"]) {
    assert.doesNotMatch(source, new RegExp(`db\\.collection\\("${collection}"\\)`));
  }
});

test("Operations Ride and Send use real routing/pricing but only isolated records", async () => {
  const [ride, send] = await Promise.all([read("app/api/operations/rides/route.js"), read("app/api/operations/send/route.js")]);
  for (const source of [ride, send]) {
    assert.match(source, /operationsRuns/);
    assert.match(source, /getVerifiedRideRoute/);
    assert.match(source, /productionCollectionsUntouched:true/);
    assert.doesNotMatch(source, /db\.collection\("rideTrips"\)|db\.collection\("parcelJobs"\)|db\.collection\("payments"\)/);
  }
  assert.match(ride, /estimateRide/);
  assert.match(send, /estimateParcel/);
});

test("customer launch preview is grant based rather than profile or role based", async () => {
  const source = await read("lib/customer-launch-server.js");
  assert.match(source, /loadOperationGrants/);
  assert.match(source, /service_preview/);
  assert.match(source, /service_operations/);
  assert.doesNotMatch(source, /privateBeta|roles/);
});

test("Firebase native bridge exposes Operations context and isolated Driver Ride lifecycle", async () => {
  const source = await read("firebase/functions/src/index.js");
  assert.match(source, /export const operationsContext/);
  assert.match(source, /export const operationsRide/);
  assert.match(source, /driver_operations/);
  assert.match(source, /operationsRuns/);
  assert.doesNotMatch(source.slice(source.indexOf("export const operationsRide")), /driverPresence|driverEarningsLedger/);
});

test("customer iOS consumes scoped Operations grants for Ride Send and checkout", async () => {
  const root = process.env.SPOTLY_CUSTOMER_IOS_ROOT;
  if (!root) return;
  const files = await Promise.all([
    readFile(`${root}/spotly/Core/Contracts/SpotlyOperations.swift`, "utf8"),
    readFile(`${root}/spotly/Core/Platform/FirebasePlatform.swift`, "utf8"),
    readFile(`${root}/spotly/Core/Services/ProductionServices.swift`, "utf8"),
    readFile(`${root}/spotly/Features/Production/RideRequestView.swift`, "utf8"),
    readFile(`${root}/spotly/Features/Production/SendRequestView.swift`, "utf8"),
    readFile(`${root}/spotly/Features/Production/MarketplaceCheckoutView.swift`, "utf8")
  ]);
  const source = files.join("\n");
  assert.match(source, /serviceOperations/);
  assert.match(source, /paymentSandbox/);
  assert.match(source, /locationOverride/);
  assert.match(source, /operationsContext/);
  assert.match(source, /\/api\/operations\/rides/);
  assert.match(source, /\/api\/operations\/send/);
  assert.match(source, /\/api\/operations\/checkout/);
});

test("Driver iOS requires real Firebase authentication and a driver_operations grant", async () => {
  const root = process.env.SPOTLY_DRIVER_IOS_ROOT;
  if (!root) return;
  const [platform, state, jobs] = await Promise.all([
    readFile(`${root}/spotlydriver/Core/Platform/DriverFirebasePlatform.swift`, "utf8"),
    readFile(`${root}/spotlydriver/Core/Services/DriverAppState.swift`, "utf8"),
    readFile(`${root}/spotlydriver/Features/Jobs/JobsView.swift`, "utf8")
  ]);
  assert.match(platform, /Auth\.auth\(\)\.currentUser != nil/);
  assert.match(platform, /Demo mode cannot authorize Operations work/);
  assert.match(platform, /httpsCallable\("operationsRide"\)/);
  assert.match(state, /operationsContext\.driverOperations/);
  assert.match(jobs, /Real account grant required/);
  assert.doesNotMatch(state, /skipToMain\(\).*driverOperations/s);
});

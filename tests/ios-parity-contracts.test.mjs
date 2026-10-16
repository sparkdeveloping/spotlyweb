import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { marketplaceProfile } from "../lib/marketplace-taxonomy.js";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("marketplace taxonomy does not confuse barber with bar", () => {
  assert.equal(marketplaceProfile({ category: "Barber", name: "City Barber" }).service, "book");
  assert.equal(marketplaceProfile({ category: "Sports Bar", name: "B&B Sports Bar" }).service, "eat");
});

test("marketplace taxonomy keeps core verticals in the correct service", () => {
  assert.equal(marketplaceProfile({ category: "Groceries" }).service, "shop");
  assert.equal(marketplaceProfile({ category: "Hospital" }).service, "book");
  assert.equal(marketplaceProfile({ category: "Accommodation" }).service, "book");
  assert.equal(marketplaceProfile({ category: "Cinema" }).service, "events");
});

test("iOS customer activity contract is authenticated and normalized", () => {
  const source = read("app/api/customer/activity/route.js");
  assert.match(source, /authenticateRequest/);
  assert.match(source, /collection\("orders"\)/);
  assert.match(source, /collection\("rideTrips"\)/);
  assert.match(source, /collection\("parcelJobs"\)/);
  assert.match(source, /records, counts, generatedAt/);
});

test("Saved batch business hydration route exists and preserves missing IDs", () => {
  const source = read("app/api/public/marketplace/businesses/route.js");
  assert.match(source, /parseIds/);
  assert.match(source, /db\.getAll/);
  assert.match(source, /businesses, missing/);
  assert.match(source, /isMarketplaceDiscoverable/);
});

test("workspace push never falls back Driver or Business notifications to arbitrary customer tokens", () => {
  const source = read("lib/notification-server.js");
  assert.match(source, /legacyCustomerTokens/);
  assert.match(source, /workspace === "customer"/);
  assert.doesNotMatch(source, /workspaceMatches\.length \? workspaceMatches : entries/);
  assert.match(source, /audience: normalizedWorkspace/);
});

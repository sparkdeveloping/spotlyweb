import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("TabPanel supports the value plus tabValue pattern used by catalogue modules", async () => {
  const source = await read("components/ui.js");
  assert.match(source, /tabValue/);
  assert.match(source, /value === tabValue/);
});

test("Business catalogue does not depend on a businessId plus name composite index", async () => {
  const source = await read("lib/firebase-services.js");
  const start = source.indexOf("export function subscribeBusinessCatalog");
  const end = source.indexOf("export function subscribePublicBusinessCatalog", start);
  const block = source.slice(start, end);
  assert.match(block, /where\("businessId", "==", businessId\)/);
  assert.doesNotMatch(block, /orderBy\("name"\)/);
});

test("catalogue and order modules distinguish read failures from legitimate empty states", async () => {
  const [context, catalog, orders] = await Promise.all([
    read("components/business/business-context.js"),
    read("components/business/catalog.js"),
    read("components/business/orders.js")
  ]);
  assert.match(context, /productsError/);
  assert.match(context, /ordersError/);
  assert.match(catalog, /Your products could not be loaded/);
  assert.match(orders, /Orders could not be loaded/);
});

test("live kiosk bypasses Business owner authentication and uses its device credential", async () => {
  const [layout, kiosk] = await Promise.all([read("components/business/business-layout-client.js"), read("components/business/kiosk.js")]);
  assert.match(layout, /pathname\.startsWith\("\/business\/kiosk\/live"\)\) return children/);
  assert.match(kiosk, /x-spotly-kiosk-device/);
  assert.match(kiosk, /Create kiosk setup/);
  assert.match(kiosk, /Activate kiosk/);
});

test("Business context selector preserves full business and location names", async () => {
  const source = await read("components/business/shared.js");
  const start = source.indexOf("export function WorkspaceContextSwitcher");
  const end = source.indexOf("export function BusinessSwitcher", start);
  const block = source.slice(start, end);
  assert.match(block, /break-words text-sm font-bold leading-5/);
  assert.doesNotMatch(block, /truncate/);
});

test("delivery reuses the canonical location map pin instead of exposing raw latitude and longitude fields", async () => {
  const [delivery, branches, route] = await Promise.all([
    read("components/business/delivery.js"),
    read("components/business/branches.js"),
    read("app/api/business/branches/route.js")
  ]);
  assert.doesNotMatch(delivery, />Latitude</);
  assert.doesNotMatch(delivery, />Longitude</);
  assert.match(delivery, /Pickup map pin/);
  assert.match(delivery, /Update in Locations/);
  assert.match(branches, /Map pin/);
  assert.match(route, /location: z\.object/);
});

test("Business support listeners avoid composite order indexes for scoped operational reads", async () => {
  const source = await read("lib/firebase-services.js");
  const start = source.indexOf("export function subscribeSupportConversations");
  const end = source.indexOf("export async function sendSupportMessage", start);
  const block = source.slice(start, end);
  assert.doesNotMatch(block, /orderBy\(/);
});

test("initial Business setup captures the same canonical location map pin used by Delivery", async () => {
  const source = await read("components/business/setup.js");
  const start = source.indexOf("function LocationStep");
  const end = source.indexOf("function OfferingStep", start);
  const block = source.slice(start, end);
  assert.match(block, /Add the map pin/);
  assert.match(block, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(block, /location: \{/);
  assert.match(block, /required before this location can offer delivery/);
});

test("Business notifications live at the portfolio workspace level, not inside one selected business", async () => {
  const [routing, account, workspace, archetypes] = await Promise.all([
    read("lib/business-routing.js"),
    read("components/business/business-account.js"),
    read("components/business/business-workspace.js"),
    read("data/business-archetypes.js")
  ]);
  assert.match(routing, /"notifications"/);
  assert.match(account, /BusinessNotificationsView/);
  assert.match(account, /businessOptions/);
  assert.doesNotMatch(workspace, /BusinessNotificationsView/);
  assert.doesNotMatch(archetypes, /href:\s*"\/business\/notifications"/);
});

test("Business context switcher provides direct location management without a redundant page-header button", async () => {
  const [shared, dashboard, branches] = await Promise.all([
    read("components/business/shared.js"),
    read("components/business/dashboard.js"),
    read("components/business/branches.js")
  ]);
  assert.match(shared, /Edit selected location/);
  assert.match(shared, /Add location/);
  assert.match(shared, /action:\s*"add"/);
  assert.doesNotMatch(dashboard, /Manage location/);
  assert.match(branches, /useSearchParams/);
});

test("shared tabs accept semantic icons and shared cards support intentional content insets", async () => {
  const source = await read("components/ui.js");
  assert.match(source, /const Icon = tab\.icon/);
  assert.match(source, /Icon && <Icon/);
  assert.match(source, /padded = false/);
  assert.match(source, /p-4 sm:p-5/);
});

test("customer marketplace separates live ordering discovery from the broader claim directory", async () => {
  const [services, marketplace, directory] = await Promise.all([
    read("lib/firebase-services.js"),
    read("app/api/public/marketplace/route.js"),
    read("app/api/public/directory/route.js")
  ]);
  assert.match(services, /searchLiveBusinesses/);
  assert.match(services, /api\/public\/marketplace/);
  assert.match(services, /api\/public\/directory/);
  assert.match(marketplace, /isLive/);
  assert.match(directory, /directoryVisible/);
  assert.doesNotMatch(marketplace, /orderBy\(/);
  assert.doesNotMatch(directory, /orderBy\(/);
});

test("suspended businesses are not prompted to submit another launch review", async () => {
  const source = await read("lib/business-portfolio-server.js");
  assert.match(source, /Business suspended/);
  assert.match(source, /View suspension status/);
});

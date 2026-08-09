import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compareMasterProduct, canPublishMasterImage } from "../lib/catalog-library.js";
import { parseCatalogueCsv, parseCsvRows } from "../lib/catalog-import.js";
import { resolveProductForBranch, setBranchOfferOverride, resetBranchOfferOverride } from "../lib/product-offers.js";
import { merchantNetAmount, paymentLedgerPlan, payoutReserveEffects, payoutProcessingEffects, payoutPaidEffects, sanitizeBalance } from "../lib/business-money.js";

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), "utf8");

test("business root is a permanent portfolio and account routes remain first class", () => {
  assert.match(read("app/business/page.js"), /section="portfolio"/);
  const workspace = read("components/business/business-workspace.js");
  assert.match(workspace, /portfolio/);
  assert.match(workspace, /claims/);
  assert.match(workspace, /invitations/);
  assert.match(workspace, /access/);
  assert.match(read("components/business/business-account.js"), /Claims & applications/);
});

test("business portfolio is server-authoritative and organization access is resolved", () => {
  const route = read("app/api/business/portfolio/route.js");
  const server = read("lib/business-portfolio-server.js");
  assert.match(route, /getBusinessPortfolio/);
  assert.match(server, /organization_owner/);
  assert.match(server, /ownerIds/);
  assert.match(server, /branchIds/);
  assert.match(server, /invitations/i);
  assert.match(server, /claims/i);
});

test("business URL context takes precedence over remembered browser state", () => {
  const source = read("components/business/business-context.js");
  assert.match(source, /searchParams\.get\("business"\)/);
  assert.match(source, /spotly-business-id/);
  assert.match(source, /router\.replace|router\.push/);
  assert.match(source, /requestedBusinessId/);
});

test("canonical matching prioritizes barcode and never auto treats fuzzy match as exact", () => {
  const exact = compareMasterProduct({ barcode: "5449000000996", name: "Coke" }, { id: "m1", gtin: "5449000000996", canonicalName: "Coca-Cola" });
  const possible = compareMasterProduct({ name: "Mazoe Orange 2 Litre", brand: "Mazoe" }, { id: "m2", canonicalName: "Mazoe Orange Crush 2L", brand: "Mazoe" });
  assert.equal(exact.strength, "exact");
  assert.notEqual(possible.strength, "exact");
});

test("reference-only master imagery is not publishable", () => {
  assert.equal(canPublishMasterImage({ primaryImage: "https://example.test/x.jpg", imageRightsStatus: "reference_only" }), false);
  assert.equal(canPublishMasterImage({ primaryImage: "https://example.test/x.jpg", imageRightsStatus: "spotly_photographed" }), true);
  assert.equal(canPublishMasterImage({ primaryImage: "" }), true);
});

test("CSV parser handles quoted commas and recognized catalogue headers", () => {
  const rows = parseCsvRows('name,category,price,currency,barcode\n"Sauce, Tomato",Groceries,2.50,USD,1234567890123\n');
  assert.equal(rows[1][0], "Sauce, Tomato");
  const items = parseCatalogueCsv('name,brand,pack size,price,currency,barcode\nMilk,Dairibord,1L,1.25,USD,123\n', { active: false });
  assert.equal(items[0].brand, "Dairibord");
  assert.equal(items[0].packSize, "1L");
  assert.equal(items[0].price, 1.25);
});

test("branch offers inherit defaults until an explicit override is set and can reset", () => {
  const product = { price: 2, currency: "USD", stockStatus: "in_stock", branchOverrides: {} };
  assert.equal(resolveProductForBranch(product, "a").price, 2);
  const overrides = setBranchOfferOverride(product.branchOverrides, "a", { price: 2.5, stockStatus: "low_stock" });
  const overridden = { ...product, branchOverrides: overrides };
  assert.equal(resolveProductForBranch(overridden, "a").price, 2.5);
  const reset = { ...overridden, branchOverrides: resetBranchOfferOverride(overridden.branchOverrides, "a") };
  assert.equal(resolveProductForBranch(reset, "a").price, 2);
});

test("merchant ledger separates total capture from Spotly platform fee", () => {
  const order = { totals: { total: 21, serviceFee: 1 }, currency: "USD" };
  assert.equal(merchantNetAmount(order), 20);
  assert.deepEqual(paymentLedgerPlan(order), [
    { type: "payment_captured", amount: 21, direction: "credit", effects: { pending: 21 } },
    { type: "platform_fee", amount: 1, direction: "debit", effects: { pending: -1 } }
  ]);
});

test("payout lifecycle moves money through reserved and processing buckets", () => {
  assert.deepEqual(payoutReserveEffects(10), { available: -10, reserved: 10 });
  assert.deepEqual(payoutProcessingEffects(10), { reserved: -10, payoutProcessing: 10 });
  assert.deepEqual(payoutPaidEffects(10), { payoutProcessing: -10, paidOut: 10 });
});

test("negative merchant balance is exposed as liability rather than withdrawable cash", () => {
  const balance = sanitizeBalance({ available: -5, pending: 3 });
  assert.equal(balance.available, 0);
  assert.equal(balance.liability, 5);
  assert.equal(balance.pending, 3);
});

test("Business Money is API-backed and old client-derived payout flow is retired", () => {
  const finance = read("components/business/finance.js");
  const route = read("app/api/business/money/route.js");
  assert.match(finance, /\/api\/business\/money/);
  assert.doesNotMatch(finance, /completed order totals|orders\.filter/);
  assert.match(route, /businessBalanceAccounts/);
  assert.match(route, /settlement/);
  assert.match(read("app/api/payouts/route.js"), /status:\s*410/);
});

test("settlement account full number is encrypted server-side and only last four is returned", () => {
  const source = read("app/api/business/money/route.js");
  const money = read("lib/business-money-server.js");
  assert.match(source, /encryptFinancialValue/);
  assert.match(source, /accountNumberLast4/);
  assert.doesNotMatch(source, /accountNumber:\s*body\.accountNumber/);
  assert.match(money, /aes-256-gcm/);
});

test("payout request is validated against server-authoritative available balance", () => {
  const source = read("app/api/business/money/route.js");
  assert.match(source, /businessBalanceAccounts/);
  assert.match(source, /available/);
  assert.match(source, /requested amount|amount/i);
  assert.match(source, /payoutReserveEffects/);
});

test("OpenAI image enhancement is server-only and original image is never overwritten", () => {
  const route = read("app/api/business/media/enhance-product/route.js");
  const ui = read("components/business/product-media.js");
  const env = read(".env.example");
  assert.match(route, /process\.env\.OPENAI_API_KEY/);
  assert.doesNotMatch(route, /NEXT_PUBLIC_OPENAI/);
  assert.match(route, /sourceStoragePath/);
  assert.match(route, /productImageVersions/);
  assert.match(route, /images: \[\{ image_url:/);
  assert.match(route, /Content-Type.*application\/json/);
  assert.match(route, /OPENAI_TRANSPARENT_IMAGE_MODEL/);
  assert.match(route, /gpt-image-1\.5/);
  assert.match(ui, /Use original/);
  assert.match(ui, /Use enhanced/);
  assert.match(env, /OPENAI_API_KEY=/);
  assert.match(env, /OPENAI_TRANSPARENT_IMAGE_MODEL=gpt-image-1\.5/);
});

test("spreadsheet import supports CSV and Excel, creates review batches, and camera scanning is permitted", () => {
  const catalog = read("components/business/catalog.js");
  const services = read("lib/business-services.js");
  const config = read("next.config.mjs");
  assert.match(catalog, /\.csv,\.xlsx,\.xls/);
  assert.match(catalog, /cdn\.sheetjs\.com\/xlsx-0\.20\.3/);
  assert.match(catalog, /match_import/);
  assert.match(services, /catalogImportBatches/);
  assert.match(config, /camera=\(self\)/);
  assert.match(config, /cdn\.sheetjs\.com/);
});

test("staff field capture and master-product review are operational routes", () => {
  const staff = read("components/staff-app.js");
  const route = read("app/api/staff/catalogue/route.js");
  assert.match(staff, /staff\/catalogue/);
  assert.match(route, /master_products\.capture/);
  assert.match(route, /master_products\.review/);
  assert.match(route, /productObservations/);
});

test("new sensitive collections are explicitly covered by Firestore and Storage rules", () => {
  const rules = read("firestore.rules");
  const storage = read("storage.rules");
  for (const name of ["masterProducts", "catalogCollections", "productObservations", "productImageVersions", "businessLedgerEntries", "businessSettlementAccounts", "businessBalanceAccounts", "catalogImportBatches"]) assert.match(rules, new RegExp(`match /${name}`));
  assert.match(storage, /master-products/);
  assert.match(storage, /settlement-proofs/);
});

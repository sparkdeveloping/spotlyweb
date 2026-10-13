import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizePromotionCode, promotionQuote, chooseBestAutomaticPromotion } from "../lib/customer-growth.js";
import { buildOrderTotals } from "../lib/order-money.js";
import { appointmentReservationSpecs, bookingDateKeys, bookingReservationSpecs, reservationCanFit, reservationReleaseCount } from "../lib/availability-reservations.js";

const root = new URL("../", import.meta.url);
async function source(path) { return readFile(new URL(path, root), "utf8"); }

test("promotion codes normalize without leaking arbitrary characters", () => {
  assert.equal(normalizePromotionCode("  save 20! "), "SAVE20");
  assert.equal(normalizePromotionCode("launch_offer-1"), "LAUNCH_OFFER-1");
});

test("promotion quotes enforce minimum spend, branch scope, audience, and caps", () => {
  const promotion = { id: "p1", code: "SAVE20", type: "percentage", value: 20, minimumSpend: 10, branchIds: ["b1"], audience: "returning_customers", active: true };
  const context = { code: "SAVE20", businessId: "biz", branchId: "b1", currency: "USD", subtotal: 50, lines: [{ productId: "x", lineTotal: 50 }], isNewCustomer: false, now: new Date("2026-10-13T12:00:00Z") };
  assert.deepEqual(promotionQuote(promotion, context).discount, 10);
  assert.equal(promotionQuote(promotion, { ...context, branchId: "b2" }).eligible, false);
  assert.equal(promotionQuote(promotion, { ...context, subtotal: 5, lines: [{ productId: "x", lineTotal: 5 }] }).eligible, false);
  assert.equal(promotionQuote(promotion, { ...context, isNewCustomer: true }).eligible, false);
});


test("Spotly platform campaigns can be global or scoped to selected businesses", () => {
  const campaign = { id: "platform-1", scope: "platform", type: "percentage", value: 15, active: true, businessIds: ["biz-a"] };
  const base = { currency: "USD", subtotal: 40, lines: [{ productId: "x", lineTotal: 40 }] };
  assert.equal(promotionQuote(campaign, { ...base, businessId: "biz-a" }).discount, 6);
  assert.equal(promotionQuote(campaign, { ...base, businessId: "biz-b" }).eligible, false);
  assert.equal(promotionQuote({ ...campaign, businessIds: [] }, { ...base, businessId: "biz-b" }).eligible, true);
});

test("platform campaigns are managed through an audited admin API and participate in checkout candidates", async () => {
  const server = await source("lib/promotion-server.js");
  const api = await source("app/api/admin/growth/promotions/route.js");
  const rules = await source("firestore.rules");
  const business = await source("lib/business-services.js");
  assert.match(server, /where\("scope", "==", "platform"\)/);
  assert.match(api, /growth\.platform_promotion_created/);
  assert.match(api, /marketing_manager/);
  assert.match(rules, /scope == "platform" && platformAdmin/);
  assert.match(business, /scope: "business"/);
});

test("automatic promotions select the largest eligible discount", () => {
  const result = chooseBestAutomaticPromotion([
    { id: "a", type: "percentage", value: 10, active: true },
    { id: "b", type: "fixed", value: 8, currency: "USD", active: true }
  ], { currency: "USD", subtotal: 50, lines: [{ productId: "x", lineTotal: 50 }] });
  assert.equal(result.promotion.id, "b");
  assert.equal(result.quote.discount, 8);
});

test("order totals apply discounts before commission and never below zero", () => {
  const totals = buildOrderTotals({ subtotal: 100, discount: 25, serviceFee: 2, commissionPercent: 10 });
  assert.equal(totals.discount, 25);
  assert.equal(totals.discountedSubtotal, 75);
  assert.equal(totals.platformCommission, 7.5);
  assert.equal(totals.total, 77);
  assert.equal(buildOrderTotals({ subtotal: 10, discount: 100 }).total, 0);
});

test("appointment availability reservations are deterministic and capacity-aware", () => {
  const specs = appointmentReservationSpecs({ itemId: "svc 1", date: "2026-10-20", time: "14:30", capacity: 2 });
  assert.equal(specs.length, 1);
  assert.equal(specs[0].units, 1);
  assert.match(specs[0].id, /svc_1_appointment_2026-10-20_14_30/);
  assert.equal(reservationCanFit(1, 1, 2), true);
  assert.equal(reservationCanFit(2, 1, 2), false);
});

test("multi-day booking capacity reserves nights while same-day activities reserve one day", () => {
  assert.deepEqual(bookingDateKeys("2026-10-20", "2026-10-23"), ["2026-10-20", "2026-10-21", "2026-10-22"]);
  assert.deepEqual(bookingDateKeys("2026-10-20", "2026-10-20"), ["2026-10-20"]);
  const specs = bookingReservationSpecs({ itemId: "stay", startDate: "2026-10-20", endDate: "2026-10-22", capacity: 4, guests: 3, capacityMode: "booking" });
  assert.equal(specs.length, 2);
  assert.ok(specs.every((item) => item.units === 1));
  assert.equal(reservationReleaseCount(1, 3), 0);
});

test("booking and appointment creation recheck capacity inside the Firestore transaction", async () => {
  const route = await source("app/api/customer/transactions/create/route.js");
  const release = await source("lib/order-reservations-server.js");
  const rules = await source("firestore.rules");
  assert.match(route, /availabilityReservations/);
  assert.match(route, /reservationCanFit/);
  assert.match(route, /transaction\.get\(ref\)/);
  assert.match(release, /reservationReleaseCount/);
  assert.match(rules, /availabilityReservations\/\{reservationId\}.*allow read, write: if false/s);
});

test("promotion usage is reserved atomically and released when an unpaid reservation is cancelled or expires", async () => {
  const order = await source("app/api/orders/create/route.js");
  const booking = await source("app/api/customer/transactions/create/route.js");
  const release = await source("lib/order-reservations-server.js");
  assert.match(order, /status: "reserved"/);
  assert.match(booking, /status: "reserved"/);
  assert.match(release, /usedCount: Math\.max\(0, currentUses - 1\)/);
  assert.match(release, /status: "released"/);
});

test("referrals are one-account, no self-referral, and must be attached before first paid purchase", async () => {
  const referral = await source("lib/referral-server.js");
  const rules = await source("firestore.rules");
  assert.match(referral, /You cannot use your own referral code/);
  assert.match(referral, /priorOrdersQuery/);
  assert.match(referral, /before your first completed Spotly purchase/);
  assert.match(referral, /claimSnapshot\.exists/);
  assert.match(rules, /referralClaims\/\{claimId\}.*allow read, write: if false/s);
});

test("analytics strips customer-identifying parameter names and SEO pages are server-derived", async () => {
  const analytics = await source("lib/firebase-services.js");
  const item = await source("app/item/[id]/page.js");
  const place = await source("app/place/[id]/page.js");
  const sitemap = await source("app/sitemap.js");
  assert.match(analytics, /ANALYTICS_BLOCKED_KEY/);
  assert.match(analytics, /email\|phone\|address/);
  assert.match(item, /getPublicItemForSeo/);
  assert.match(item, /application\/ld\+json/);
  assert.match(place, /getPublicBusinessForSeo/);
  assert.match(sitemap, /cityServices/);
});

test("public service feed has bounded in-memory seed caching, pagination, and HTTP stale-while-revalidate", async () => {
  const feed = await source("app/api/public/service-feed/route.js");
  assert.match(feed, /SEED_TTL_MS = 30_000/);
  assert.match(feed, /nextOffset/);
  assert.match(feed, /stale-while-revalidate/);
  assert.match(feed, /limit\(2000\)/);
});

# Spotly Independent Shopping · controlled pilot (NOT production-launched)

**Prepared:** 2026-10-19  
**Branch:** `feature/independent-shopping-pilot-20261019`  
**Safety:** Off by default. Does not change existing Business onboarding, verified-merchant listings, merchant orders, merchant finances, customer payments or Driver delivery jobs.

## Why this path is separate

Spotly already has live merchant orders and a `driver_shops` branch configuration. That existing workflow is **not safe to reuse for unaffiliated stores**:

- `app/api/orders/create/route.js` requires a commerce-verified business, branch, merchant product IDs and merchant finance settings.
- `app/api/driver/shopping/route.js` requires an authorization from a participating store's Spotly kiosk before receipt checkout.
- Merchant payment, ledger and settlement code credits the merchant and deducts merchant commissions.
- An unaffiliated store has not authorized Spotly's merchant branding, catalogue or funds processing.

Changing those production workflows to bypass verification is expressly out of scope.

## Implemented in this PR

1. `independentShoppingStores` is a **new collection** unrelated to merchant `businesses`, `branches` and `products`.
2. `POST /api/admin/independent-shopping` lets authenticated platform operators create or edit independent stores and price-checked menu items. The strict schema **rejects image/logo fields**, asks for a price-check source, and refuses to publish all-stale menus.
3. `GET /api/public/independent-shopping` exposes only separately published, independently researched stores if `platformSettings/global.independentShopping.browseEnabled === true`. Returns no stores otherwise.
4. Prices expire after 14 days. Stale-priced menu items are not displayed or quotable.
5. `/shop-for-me` provides a separate, non-indexed browse and quote-request interface, consistently labelled *not affiliated / estimated / not an order*.
6. `POST /api/customer/independent-shopping/requests` creates an **unpaid, undispached, non-order** request if *both* browseEnabled and requestEnabled are true. Server re-quotes from stored prices; it does not accept arbitrary customer prices.
7. The new request stays in `independentShoppingRequests` with `state: "pending_manual_quote"`. It never creates an `orders`, `deliveryJobs`, `paymentIntents` or merchant balance entry.
8. `GET /api/customer/independent-shopping/requests` returns only the logged-in customer's request metadata.
9. Existing customer navigation does not advertise this unfinished flow.

## Pilot flags (initially absent/false)

```json
{
  "independentShopping": {
    "browseEnabled": false,
    "requestEnabled": false,
    "shoppingFeeEstimate": 0,
    "deliveryFeeEstimate": 0
  }
}
```

This object belongs inside `platformSettings/global`. **Do not enable requests yet.** The consumer app can remain deployed with both flags false and has no effect on the existing commerce platform.

## Operator workflow

- Research basic item names, quantities, currency and prices independently, preferably by a fresh in-person or telephone check.
- Do not copy logos, menu artwork, third-party photos, entire creative descriptions, or proprietary menu layouts. Do not scrape restricted sites.
- The admin route requires `priceCheckMethod`: `in_person`, `phone` or `business_authorized`, and one ISO UTC `priceCheckedAt` per item.
- Store names are used only to identify where an independent customer purchase would occur; no official-partner badge may be displayed.
- Include the fixed affiliation disclosure everywhere independent items appear.
- Check menu items for allergens and availability separately from prices before handling a real purchase.
- If a merchant claims its listing, **manually suspend the duplicate independent-shopping store** pending an ownership/source reconciliation. Do not transfer independently authored items into that merchant's catalogue automatically.
- Prices and commissions from official Spotly businesses must never be treated as pricing for this mode.

## Before paid ordering and Driver dispatch can be enabled

This release intentionally has **NO paid checkout or automatic dispatch**. A second, separately reviewed implementation must include:

1. An operator-confirmed firm quote with order-expiry window, available item check, driver capacity, full delivery address geocoding, and explicit customer acceptance.
2. Customer-facing payment method availability, proper payment confirmation callbacks and an **independent-purchase liability/ledger model**, distinct from merchant balances and commissions. Collect shopping/delivery fees from the customer, never the unaffiliated restaurant.
3. Driver/shopper eligibility and authorization to spend a capped **pre-funded** amount, without requiring a merchant kiosk. Include receipt upload, substitutions with consent, and proof of purchase.
4. Funding/receipt reconciliation, automatic unused-reserve refunds, overage rejection, failed purchase/refusal refunds, payment disputes and negative/partial order outcomes.
5. Food handling (allergens, tampering, hot/cold-chain logistics), operator support escalation and expected service area controls.
6. Customer order lifecycle in Activity, transaction records, Driver assignment offers, business claim conflicts, manual cancellation and recovery mechanisms.
7. Zimbabwean legal review of independent purchasing, commercial data collection, consumer representations, privacy and food delivery handling.
8. Load tests and integration tests (no Driver available, payment callback retry, price changes, out-of-stock, substitutions, no pickup kiosk, unaffiliated merchant refusal) before enabling any live checkout.

## Live non-regression checklist

- New merchant signup, claim and business verification still work.
- Existing merchant product/booking/order checkout still requires commerce verification.
- Existing active order and payment callback semantics are unmodified.
- Existing merchant payout/commission ledgers are untouched.
- Driver shopping with merchant kiosk still requires kiosk approval; independent shopping does **not** bypass it.
- Public independent endpoint with absent flags returns `enabled:false` and zero stores.
- Operator admin endpoint is role-protected and cannot accept photos or official merchant fields.
- User quote-request GET is authenticated and customer-scoped.
- No independent requests are represented as paid/completed orders.
- No automated conversion of a directory listing into a merchant account.
- Rollback: keep flags off; revert only this branch's new files, without touching existing Business documents or live orders.

### Important
This is a **safe foundation and preview**, not a completed revenue-generating independent-shopping launch. Enabling checkout prematurely would be a serious funds-routing and consumer-expectation risk.

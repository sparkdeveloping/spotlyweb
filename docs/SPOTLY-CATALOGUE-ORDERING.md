# Spotly catalogue and independent ordering

Discovery groups repeated names and chain aliases by country, city and business type before result limits. One card keeps a list of physical locations. A conservative 60m rule coalesces imported points for the same branch; merchant IDs remain distinct. No ownership, claims, products or operational IDs are merged. Exact source IDs still resolve old links and Saved items.

Unclaimed eligible Zimbabwe food and retail listings have Spotly-authored, category-specific request suggestions and a custom shopping list. These describe what a customer wants; they do not assert store stock, current prices or an official merchant relationship. The 16 existing factual restaurant dishes now live in `data/spotly-restaurant-menus.js` and can be selected in the in-app catalogue. Approved existing independent menus retain priority, and expired price references become unpriced requests rather than silently becoming current prices. Public pages have no external menu promotion, vendor branding or source-photo credit; private provenance/review records stay intact.

The catalogue distinguishes unknown amounts (`null`, “Price to confirm”) from real zero amounts. It does not create merchant products, change commerce verification or route independent funds into merchant settlement. Eligible service providers keep the assisted appointment request path.

## Order lifecycle

1. The customer chooses a business and exact location. Firestore branches have separate store IDs and session baskets; mapped locations retain their source business IDs.
2. The server validates the current business and branch, regional policy, ownership and opt-outs. The first submitted request materializes its stable independent store record. An idempotent request is saved in `independentShoppingRequests` and reaches Assist Operations and customer Activity.
3. Operations reviews the requested items, confirms the actual collection address, item total, shopping/delivery fees and quote expiry, then sends a quote. Location/payment readiness attestations are explicit operator actions.
4. Only the owning customer can accept the current quote. Secure Paynow initiation uses the existing independent payment intent and reconciliation path. A repeat attempt reuses the same intent.
5. Captured funds, independently confirmed shopper float and a vetted available shopper are required before assignment. Each shopper job retains its accepted quote’s collection address even if another quote later changes the shared store.
6. Existing substitution approval, spending limits, private receipts, delivery PIN, cancellation, refund and finance-close stages remain in use.

Platform browse/request switches, regional pauses and payment/fulfilment readiness flags still apply. The release does not attest real operating capacity, make test purchases, collect money or auto-dispatch shoppers. Pending ownership claims and regulated categories are excluded from automatic independent shopping intake.

## Validation

`tests/spotly-ordering.test.mjs` exercises real request, quote, customer acceptance, payment initiation and assignment handlers against isolated Firestore/payment doubles. It covers directory-wide grouping/catalogue coverage, unknown totals, branch isolation and opt-outs, pending claims, duplicate submissions/payment intents, payment gates, accepted-address snapshots and absence of external source promotion. Existing finance, driver, refund and merchant-commerce regression checks remain part of the suite.

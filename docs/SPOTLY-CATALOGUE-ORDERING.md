# Spotly catalogue and independent ordering

Discovery groups repeated names and chain aliases by country, city and business type before result limits. One card keeps a list of physical locations. A conservative 60m rule coalesces imported points for the same branch; merchant IDs remain distinct. No ownership, claims, products or operational IDs are merged. Exact source IDs still resolve old links and Saved items.

Eligible Zimbabwe listings support exact customer orders. Generic suggestions such as “Bread” and “Meal request” have been removed. The reviewed catalogue contains 687 menu entries across 15 brands and 128 specific retail product identities, observed on 1 November 2026. Names include published brands, variants, portions and pack sizes where the source actually states them. Dish options are selectable and are validated and preserved in the request sent to Operations, Activity and the shopper. Category filters, search, progressive item loading and a basket summary keep large catalogues usable.

`data/spotly-specific-catalogues.js` holds the reviewed identities and official source references. Cafe Nush’s Avondale/Highland Park and Chop Chop’s Chitepo/Avondale/Pomona menus remain scoped to their source locations. The current Zimbabwe-only Doppio Zero PDFs replace the older brief menu. The previous Fishmonger list had uncertain branch provenance and is no longer automatically assigned. Where a menu or product range cannot be established, an exact custom order remains available without inventing stock or dishes.

Retail products are published product references, not store offers. A matching retailer’s evidence is preferred when available; a product library entry at another shop explicitly requires confirmation that the selected location carries it. No observed online prices, promotional prices, stock counts or sales flags become payable quotes. Older Chicken Inn posters and Nando’s expired linked price validity are never treated as current prices. Approved operator catalogues retain priority. Automatic, previously materialized generic catalogues refresh to the current reviewed version while pauses, addresses and financial/operational controls remain intact.

Item-specific photographs are bundled locally with their published catalogue attribution, separate from illustrative business headers. `data/catalogue-media-review.js` records rejected source photos, including mismatched products and small promotional posters with embedded prices. Missing or unsuitable item photos are omitted; no category picture is substituted. `scripts/import-spotly-catalogue-research.mjs` imports reviewed research; `scripts/refresh-catalogue-media.mjs` rebuilds bounded WebP assets from the source manifest. No image licence or branch ownership is inferred from the source URL.

Recognised food-brand identity now outranks conflicting imported cuisine/cafe/retail tags and parent-company names. All actual single-brand Chicken Inn records resolve to fried chicken, including the previously pizza-tagged records. Mixed-brand outlets retain neutral takeaway imagery. Distinct non-food premises retain their structured category. Grouping uses the named chain before its parent-company tag, preserving all physical branch IDs.

The catalogue distinguishes unknown amounts (`null`, “Price to confirm”) from real zero amounts. It does not create merchant products, change commerce verification or route independent funds into merchant settlement. Eligible service providers keep the assisted appointment request path.

## Order lifecycle

1. The customer chooses a business and exact location. Firestore branches have separate store IDs and session baskets; mapped locations retain their source business IDs.
2. The server validates the current business and branch, regional policy, ownership and opt-outs. The first submitted request materializes its stable independent store record. An idempotent request is saved in `independentShoppingRequests` and reaches Assist Operations and customer Activity.
3. Operations reviews the requested items, confirms the actual collection address, item total, shopping/delivery fees and quote expiry, then sends a quote. Location/payment readiness attestations are explicit operator actions.
4. Only the owning customer can accept the current quote. Secure Paynow initiation uses the existing independent payment intent and reconciliation path. A repeat attempt reuses the same intent.
5. Captured funds, independently confirmed shopper float and a vetted available shopper are required before assignment. Each shopper job retains its accepted quote’s collection address even if another quote later changes the shared store.
6. Existing substitution approval, spending limits, private receipts, delivery PIN, cancellation, refund and finance-close stages remain in use.

Assist Operations → Service settings provides audited platform administrator controls for catalogue browsing, request intake, payment review/collection, shopper fulfilment, float attestation, refunds and closeout. Payment collection cannot be enabled without configured Paynow USD and the corresponding reviewed workflow settings.

Platform browse/request switches, regional pauses and payment/fulfilment readiness flags still apply. The release does not attest real operating capacity, make test purchases, collect money or auto-dispatch shoppers. Pending ownership claims and regulated categories are excluded from automatic independent shopping intake.

## Validation

`tests/spotly-ordering.test.mjs` exercises real request, quote, customer acceptance, payment initiation and assignment handlers against isolated Firestore/payment doubles. It covers directory-wide grouping/catalogue coverage, unknown totals, branch isolation and opt-outs, pending claims, duplicate submissions/payment intents, payment gates, accepted-address snapshots and absence of external source promotion. Existing finance, driver, refund and merchant-commerce regression checks remain part of the suite.

`tests/specific-catalogues.test.mjs` checks source-backed identities, every Chicken Inn record, parent-company grouping, country/branch menu scope, retailer evidence and category matching, menu option validation, real custom-order intake, automatic catalogue refresh and actual shipped image dimensions/budgets. Published reference data never supplies the final item price.

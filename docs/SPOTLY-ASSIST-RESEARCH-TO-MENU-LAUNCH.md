# Spotly Assist: approved Zimbabwe restaurant → reviewed menu → quote request

## Operational process in one Spotly Admin preview

1. In **Admin → Restaurant Research** (`/admin/assist-research`), select the staged Zimbabwe batch. Review the business and branch duplicate candidates. A "0 matches" result **does not prove uniqueness**.
2. Review each real location with an independently checked address, operating status, ownership/claim assessment, source rights and evidence. Save the review. **Approve & Publish** only when these checks are genuine.
3. In the **Prices** tab, verify each item's actual USD price by telephone, in-person check or direct business confirmation. Rejected/old/unconfirmed prices remain unavailable.
4. In **Admin → Assist Operations → Activate verified restaurant menu** (`/admin/assist-menu-launch`), choose that exact published research location and select only approved research prices (verified in the previous 14 days).
5. Attest that Spotly has actual local shopper and operator capacity, and that factual menu sourcing rights were independently checked. **Enable price-check requests**.
6. The item is then represented as an `independentShoppingStores` document with deterministic `assistresearch_<businessId>` identity. It links to the canonical `businesses` and `branches` records. It is not a merchant-owned product or an affiliation.
7. In **Eat**, the existing restaurant card links to the **Spotly Assist** customer menu, with estimated prices and an explicit unaffiliated-shopping disclosure. Customers select items and submit a quote request using the existing shopping basket experience (`/shop-for-me?store=...`).
8. Operations contact the store, quote prices and fees, and the customer can accept/decline. **Quote acceptance is not payment or a confirmed order**.
9. To stop new requests immediately, use **Pause requests** on the Assist menu, turn off location availability in Admin, or stop the whole region/service. A new owner claim also prevents new quote offers and quote acceptance.

## Security gates

- Only Zimbabwe is supported for research menu activation. Malawi remains Ride-only.
- **No approval = no public menu; no current independently verified items = no menu activation**.
- Non-partner restaurant claims, commerce verification, or branch unavailability block menus through a central `independentStoreSafe` check in **public browsing**, **Eat feed**, **customer request submission**, **operator quote-offer**, and **customer quote acceptance**.
- Menus are verified **per business/branch**, not automatically copied to every outlet of a chain. The source batch/location IDs must match the published business. The price's researched brand must match, and its evidence must be 14 days old or less.
- Activation is Firestore-transactional with an Admin audit log and a stable identity. It creates/updates **only** a dedicated `independentShoppingStores` record, not `products`, `orders`, `paymentIntents` or Driver/Send collections.
- The existing claimable business remains unclaimed, unverified and non-merchant-orderable; no fabricated opening hours or availability estimates are introduced.

## Not yet enabled — do not advertise "order now"

This change implements **independent shopping menu browsing and a manual price-confirmation request flow**, not real paid order fulfilment. Payment capture/authorization, third-party purchase float, shopper assignment, receipts/substitutions, refund reconciliation and proof of delivery all remain distinct, unbuilt or unvalidated production dependencies. Do not use the existing merchant checkout, settlement, or Driver-dispatch APIs as a shortcut for unaffiliated purchases.

## Production release prerequisites

- Validate `npm test`, `npm run lint`, Next.js production build and Firebase transaction integration tests, including concurrent activation/pause, ownership claim, and expired quote cases. Vercel build alone does not prove Firestore transaction correctness.
- Verify Firebase App Check setup, Firestore rules and server-side role access, source rights and merchant data privacy.
- Resolve staging/PR #7 merge dependency before promoting V9 to `main`. Deploy the draft only as an authenticated preview.
- First manually approve and price-check one real branch, run a real nonfinancial quote-request smoke test with consenting operators, review notifications and rollback, then expand.

# Spotly V9 — Unified Assist implementation and release gate

Status: DEVELOPMENT BRANCH ONLY; not yet production-ready or merged.
Branch: feature/spotly-v9-unified-assist-20261019

## Delivered to the development branch

- Existing Eat and Shop service feeds can display Firestore-backed unaffiliated listings with a subtle Spotly Assist badge, explanation and independent price-check page.
- Customer booking requests from non-merchant service discovery cards with chosen time, contact details, alternative-time response, cancellation and confirmed-state separation.
- Role-restricted Assist Admin workspace for booking, shopping quote and location availability. Existing live merchant orders/payments are not mutated.
- Customer-assisted shopping quote submission, operator price verification with shopping/delivery fees, quote expiry and customer accept/decline. No money is collected by this flow.
- Country and service coverage controls (Zimbabwe and Malawi presets, ISO2 extensible) and city/area override settings persisted in platformSettings/global.
- Assisted listings are separately curated with price-check timestamps and 14-day price expiry; no restaurant artwork, partner badges or copied menus.
- Manual Firestore importer with source attestation, dry-run preview, duplicate matching and immutable merchant record protection; no real data has been imported.
- Approved ownership claim pauses a corresponding independent listing; ongoing assisted requests are preserved and exceptions create Admin follow-up tasks.
- Existing Spotly notifications are invoked for new requests and price/time decisions.
- Unit tests cover default-on eligibility, explicit pause, regional policies, currency, quote consent and official merchant checkout isolation.

## IMPORTANT: default on does not mean paid fulfilment

An unset Assist availability switch permits an eligible request. A published listing, current independently verified menu price, eligible category, enabled area and staff capacity must still be checked. A customer accepting a final quote does NOT collect payment, create merchant finance entries or dispatch a Driver.

## Hard blockers remaining before the requested complete V9 live launch

1. Independent-purchase payment ledger, Paynow callback integration, multi-country payment provider support, spending authorization for in-person shoppers, purchase float and full refund/reconciliation tests.
2. Independent Driver-shopping flow without merchant kiosk, authorized in-store expense method, receipt capture, substitutions, counter price adjustments, unavailable items, proof of pickup/delivery and driver eligibility.
3. Full unified customer Activity lifecycle, reliable region-scoped operations SLAs, staff ownership and recoverable offline exceptions.
4. Migration of every source-generated directory listing to canonical Firestore without overwriting existing claims, memberships or live merchants; the importer exists but this data migration has not run.
5. Rights-cleared restaurant menus and item prices from actual restaurants in Zimbabwe and Malawi: no unaudited copying or fabricated prices was performed.
6. Africa-wide consumer country selector, local tax rules, currency settings and country-specific financial/regulatory support. Zimbabwe/Malawi operator presets are not proof of operating coverage.
7. Real Firebase emulator, production payment, active Driver, booking-call and regression tests; Next preview build alone is insufficient.
8. Local commercial/IP, privacy, food-handling and operational approval in every actual launch jurisdiction.

## Non-regression rules

- Never merge this branch or automatically activate shopping payments until a complete controlled launch review.
- Do not use a merchant partnership flag or existing merchant commission for unaffiliated assisted purchases.
- Imported businesses are provisional, claimable, and cannot become payment merchants without ordinary Spotly verification/launch.
- The original confirmed merchant order, booking and Driver flows remain the system of record for business-operated transactions.
- Keep historical request records on handover; never silently turn them into merchant orders.
- Maintain rollback and pilot region switches; verify disabled countries, cities and individual locations.

## Validation needed

Run npm test, npm run lint, npm run build, Firebase emulator rules tests, pre-production transaction/refund tests, real business claim scenarios and regional feature-on/off tests. Examine error rates, callback idempotency, finance reconciliation, safe data provenance and support capacity before launching in any city.

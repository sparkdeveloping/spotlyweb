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
- Manual Firestore importer with source attestation, dry-run preview, duplicate matching and immutable merchant record protection. A separate multi-brand Zimbabwe research batch has been staged for review; staging is not publication or a customer launch.
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

## 20 October 2026 — consolidated safety and integration milestone

This feature branch contains isolated independent purchase infrastructure and must stay a DRAFT until external controls are verified.

### Changes in this milestone

- Harden Paynow initiation: a signed provider callback reporting settled funds must not be overwritten by a delayed browser initiation result. Provider poll reference mismatches are rejected, and customer amounts must match exactly to the cent.
- Prevent ambiguous second charge attempts after a previous payment reference; customer checkout must escalate failed/expired attempts to Finance for provider reconciliation instead of assuming no money moved.
- Gate payment availability on separately approved provider, shopper dispatch, confirmed external float procedures, store Finance readiness and an unexpired accepted quote. All flags fail closed.
- Represent real paid-held funding, substitutions, delivery progress and unspent balances in Activity rather than always showing payments as never initiated.
- Add explicit acceptance and rejection by the independently assigned Driver. Rejected offers release Driver presence and can be safely reassigned without a second shopping job. Authorization and central dispatch switches are rechecked before acceptance or shopping begins.
- Add store and delivery address to Driver job projections; unify the existing independent shopping workspace with the Driver work view, including item outcomes, customer substitution consent, receipt uploads, Operations receipt review and customer handoff PIN verification.
- Validate uploaded receipt signatures before accepting content. Operations can download an authorized receipt through a private, role-restricted, rate-limited endpoint instead of exposing Firebase Storage links.
- Add an active funded request queue to Admin fulfillment, backed by Firestore documents.
- Make it impossible for a source-tagged research directory business to gain ordinary merchant checkout or settlement from residual commerce flags, even when its public discovery launch is approved.
- Add regression tests for research isolation, funding/disclosure state, payment callbacks, rejection/reassignment and private receipt handling.

### Important remaining launch blockers

- Paynow and bank/provider reversal execution, partial refund settlement, independent two-person provider reconciliation, account ownership verification and customer refund notifications are NOT proven live. Existing refund requests are back-office instructions, not proof of returned funds.
- A real money-in / purchasing-float / money-out pilot with the provider, bank or card issuer, contracted shoppers and financial counsel has not been conducted. No authorization is granted by the availability of these routes.
- Dispatch is restricted behind explicit settings. Region availability, Driver capacity, shopper funding transfer, financial controls, pickup access, receipt authenticity and merchant rights all require operational verification.
- The single previously public research preview record must be inspected in live Firestore by an authorized operator; do not change or withdraw any records automatically.
- Full Firebase emulator, live provider sandbox, end-to-end Driver field and customer acceptance tests, accessibility/mobile QA and financial reconciliation still require external staging infrastructure.
- Customer-facing launch, activation of financial flags, deployment and merging remain separate explicit decisions.

### Financial safety prerequisites

All of these must be explicitly enabled and reviewed by authorized Spotly personnel for independent checkout: `assistFinance.enabled`, `assistFinance.providerReviewed`, `assistFinance.driverDispatchEnabled`, `assistFinance.manualFloatAttestationEnabled`, `independentShopping.paymentCollectionEnabled`, and each eligible store's `financeReady`. This is a necessary gate, not a substitute for licenses, provider approval, provisioned float, usable staffing or reconciliation.

The independent V9 collection families remain separate: `independentShoppingRequests`, `assistIndependentShoppingJobs`, `assistReceiptUploads`, `assistShopperFloatTransfers`, `assistMoneyLedger`, `assistRefundRequests`, `assistFinanceIssues`, and their audit event collections. They must remain server-only; existing Firestore and Storage catch-all rules deny direct client access. Standard automatic single-field indexes cover the Admin state query. No additional composite index is required by this milestone.

Do not deploy to Vercel just to see whether the build passes. Keep the feature pull request draft until CI, emulators, external financial validation, and explicit launch gates are complete.

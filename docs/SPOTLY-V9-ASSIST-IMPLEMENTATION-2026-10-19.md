# Spotly V9 — Unified Spotly Assist implementation and release report
**Date:** 2026-10-19
**Development branch:** `feature/spotly-v9-assist-unified`
**Target:** `main` (review only; do not merge until exit gates pass)
**Status:** Integrated preview implementation; unverified against live Paynow/Driver/Firebase; production not changed.

## What has been built in source

### Unified customer discovery
- Spotly Assist is attached to eligible canonical Firestore businesses in `/api/public/marketplace` and `/api/public/service-feed`. Participating merchants keep their exact existing checkout paths; eligible unaffiliated listings show a discreet Assist badge and explanatory popup.
- Eat / Shop uses independently researched names and current *indicative* menu prices. Book uses customer-proposed appointment times. Cards explain that the business is not necessarily a Spotly partner.
- Unaffiliated images, logos and copied creative menu descriptions are not accepted by the Admin item schema. Existing editorial category images remain allowable only subject to the app's own valid licences.
- The original `/shop-for-me` browse route remains as an item-selection subflow, accessible from the unified business card; it is **not** a standalone second directory.
- Customer `/assist/activity` tracks shopping quote requests and appointment status changes, including customer acceptance or refusal of an alternative appointment.

### Admin
- `/assist` runs a unified assisted shopping/booking case queue with an agent assignment shortcut, contact attempts, alternatives, business confirmation references, customer notifications, explicit receipt/funding warnings and reviewable case details.
- It supports availability toggles at global, country, city, area and individual canonical-business levels. **Qualified assistance REQUESTS default to enabled** unless Admin disables them.
- `/independent-shopping` manages original item facts and prices with source attestation, timestamps and verified pickup coordinates. The store is linked to a claimable canonical Firestore business.
- `/assist/import` previews a CSV batch, detects possible duplicates and claims, and **creates** Firestore records only. Existing business records cannot be overwritten through bulk imports. Menu price records must be independently checked and current (14-day freshness maximum).
- `/api/admin/assist/geography` allows authorized operators to add supported African countries and their cities. The bundled registry covers all 54 African sovereign countries by ISO code. Initial city datasets support Zimbabwe and Malawi.
- Existing business claims stay canonical; approving a claim pauses the attached independent source and requires catalogue/operational handover review rather than granting new merchant checkout privileges.

### Order and finance integration
- Admin can confirm itemized quoted prices, shopping fee, delivery fee and a maximum reserve; customers may inspect the quote in Activity.
- The funded checkout pathway has an explicit transaction type `assist_shopping`, zero merchant commission, `merchantSettlementStatus:"not_applicable"`, a customer spending cap, delivery coordinates and a Driver shopping checklist with separate Admin checkout authorization.
- Receipt checkout skips the merchant money ledger for this transaction type; receipt reconciliation still identifies unused funds and creates a refund-required adjustment record. Driver completion is reflected back to the Assist request.
- **CRITICAL:** Paid Assist remains disabled unless both `platformSettings/global.independentShopping.paidCheckoutEnabled === true` and `shopperPurchaseFundingReady === true`, and Paynow is configured. This gating is deliberate: a successful card/mobile payment does not itself supply an authorized means for the shopper to pay a non-partner store.
- The UI makes the disabled payment state explicit and still accepts no-fee *requests*. Turning on catalogue/request availability does not turn on paid checkout.
- Malawi MWK payments are **not** accepted by this flow until a supported, locally compliant provider is implemented and verified.

## Critical production exit gates (NOT confirmed)

The following must be completed before live paid Assist purchases:
1. **Shopper purchase funds:** An approved payment-to-store instrument (e.g. audited company purchasing card, merchant-independent wallet/purchase funding, or another lawful tender model), cap enforcement, accounting and shopper confirmation. Never ask a Driver to front personal funds. A bare Admin authorization flag is NOT a disbursement instrument.
2. **Live payment validation:** Real provider sandbox and low-value production tests, payment callback idempotence, reconciliation, failed payment handling, chargebacks, customer-visible refunds, amount mismatch, and no double capture. Existing `customerMoneyAdjustments` currently creates `refund_required` work; that is not proof of automated refunds.
3. **Driver integration:** The actual Driver UI/tender instruction flow and shop-and-deliver eligibility must be end-to-end tested for an unaffiliated store with no business kiosk, including receipt upload, zero-driver availability, substitution approvals and cancellation after funding.
4. **Booking operations:** Verify staff response capacity, customer communications, business refusal, true booking confirmation, no-show/cancellation conditions and cross-country timezones. Do not claim automatic bookings or pre-confirm business capacity.
5. **Legal and regulatory:** Zimbabwe/Malawi legal assessment covering trademark representations, copyright/factual menu collection, data provenance and licensing, third-party purchase agency, consumer protection, refunds, payment/escrow handling, privacy and food-handling responsibilities.
6. **Scale / Firebase costs:** The existing `publicSeed` and legacy curated-data merge still exist to avoid taking live directory records offline. Before mass migration, build bounded, indexed Firestore queries, canonical deduplication and migration/rollback; stop relying on compiled datasets only after migration parity is measured. Avoid unrestricted collection scans.
7. **Authorization and geography:** Enforce scoped Admin access for regional operations; verify no staff can see personally identifiable requests outside their assigned territories. Confirm ZIP/location availability policies and country-specific regulatory/payment settings.
8. **Regression:** Tests for business onboarding, merchant orders, live Paynow callbacks, wallet/commission payouts, Driver kiosk orders, claim verification, booking capacity, directory discovery and basic accessibility.
9. **Real data:** No external restaurants or prices have been mass imported into production. The import system exists; every sourced menu must be separately collected, verified and approved. No fake or unverified prices should be seeded simply to populate cards.

## Feature flags

```js
// platformSettings/global
assistCoverage: { globalEnabled: true, countries: {}, cities: {}, areas: {} },
independentShopping: {
  browseEnabled: true,
  requestEnabled: true,
  paidCheckoutEnabled: false,
  shopperPurchaseFundingReady: false
}
```

Missing browse/request flags default to true for eligible canonical stores; missing **payment** flags default to false. The Admin availability toggle acts on Assist requests, not funded purchases. Direct verified-merchant checkout remains separate.

## Smoke-test checklist

- Open a currently live verified restaurant and place a standard merchant order without new Assist badges/merchant errors.
- Open Admin `/assist`, change area and location availability, then verify the affected store is absent from assisted public GET and cannot create a direct-link request.
- Import one wholly new test restaurant in preview and commit mode; verify its Firestore canonical ID and independent store linkage.
- Attempt a duplicate import against a claimed merchant; it must be skipped without writes.
- Submit an assisted booking and verify the business is contacted before confirmation; customer reviews an alternative in `/assist/activity`.
- Publish one independently researched price with a recent check date; confirm that a stale item disappears and images are absent.
- Submit a price-check request; Admin sends a verified quote; customer sees fees and spending maximum without the pay button unless fully funded readiness was reviewed and enabled.
- Verify the customer/driver merchant ledger never records an Assist purchase as a partnered merchant commission or payout.
- Disable a city and an individual business; test both normal and direct-link customer requests.
- Check Zimbabwe, Malawi, and a newly enabled African country in customer location selection; country-specific payments must not be inferred from discovery availability.
- Verify builds, automation, Firebase rules/App Check, operational staff permissions and regional data access.

## Rollout recommendation
1. Deploy preview and run source tests; keep PR as **draft** until CI and regressions pass.
2. Enable discovery and quote-request-only pilot with trained operators in a constrained Zimbabwe area; customers must see clear confirmation language.
3. Complete all paid purchase exit gates before flipping payment readiness and enabling real money.
4. Extend supported geography and language/currency/address policies to Malawi; enable local payment providers only when independently ready.
5. Expand Firestore sourced data by reviewable batches, not uncontrolled imports.

### Incomplete areas, stated explicitly
This branch does **not** establish a real funds-to-shopper instrument, does **not** prove end-to-end live payment refunds, does **not** seed an exhaustive legally cleared restaurant catalogue, does **not** guarantee staff coverage in 54 countries, and still uses existing legacy compiled marketplace data as a backwards-compatible fallback. It must not be labelled fully production-ready until these items are resolved.

No automatic production deployment or Firebase data migration was requested or performed in this implementation pass.

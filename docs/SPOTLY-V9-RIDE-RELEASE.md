# Spotly V9 Ride — implementation, integration and release controls
Date: 20 October 2026. Branch: feature/spotly-v9-unified-assist-20261019 (draft only).

## Scope implemented in this Ride milestone
- Country-aware customer location search (Zimbabwe and Malawi), optional licensed reverse geocoding for current GPS and separate operator-approved country/city/area availability checks.
- Fail-closed rollout requiring explicit country and city, a separately approved road router, a real externally validated dispatch scheduler, a licensed search provider and a dedicated pickup-code encryption secret.
- Server-side, configured, HTTPS OSRM-compatible route calculations. Road distance and duration are used to price Economy, Comfort and XL. The quote is recomputed on checkout and compared against the amount/customer currency actually shown, rejecting stale pricing.
- Dynamic geographic ride-route overview that can display the most recently observed Driver GPS marker, paired with external turn-by-turn navigation links. This is NOT yet a full mobile map SDK with zoomable street tiles.
- Six-digit cryptographically generated AES-GCM-encrypted pickup verification, legacy existing-trip code read only, constant-time comparisons, a durable attempt counter and ten-minute lock after five wrong attempts.
- Nearby authorized Driver offers, deterministic offer identity, stale-GPS rejection, acceptance transactions, transactional Admin reassignment and secure expiry persistence.
- Configurable dispatch search deadline, Admin exception creation, a protected background redispatch endpoint and bounded authenticated customer-side refresh as a fallback when a rider has the Ride page open. External scheduler availability must be verified before enablement.
- Driver no-show report after five minutes at pickup; Operations review and pre-trip cancellation. Serious incidents place a safety hold on the trip and require separate Operations clearance.
- Customer and Admin pre-trip cancellation preserves finance review on any paid trip; in-progress termination creates a Finance incident rather than claiming any refund was issued.
- Driver Cash completion requires an explicit full-fare cash collection attestation. It is not independent proof of receipt. Cash rides record the platform fee separately.
- Paynow collection for Ride is limited to completed, non-disputed trips. Non-cash Driver earnings are NOT made available at ride completion unless provider payment was already captured. A later Paynow callback posts the Driver ledger only once, or queues review if the trip was already cancelled/failed.
- General refund workflow flags Ride refund review and blocks Driver payout requests while a finance dispute is open. Externally executed refund evidence and independent Finance review are required before staff mark a Ride refund complete. This does NOT initiate a Paynow refund itself.
- Limits Driver GPS write rate and customer dispatch/history refresh to reduce costs and abuse. Cross-work Driver Presence remains shared.
- Added Ride unit/security/source integrity checks to CI and retained the full Next.js production build gate.

## Launch configuration — not automatically enabled
Platform settings global.mobility must be explicitly approved:
- ridesEnabled true only after pilot authorization. Leave false on production while implementing.
- enabledCountries: ["ZW"] or ["MW"] or both as legally and operationally supported.
- enabledCities: exact approved city names. Do not use an empty allowlist.
- enabledAreas: optional approved pickup-area rules per city.
- routingVerified true only after a licensed/operated router and accurate per-vehicle road routes have been field checked.
- dispatchSchedulerVerified true only after an external protected scheduler actually calls the dispatch endpoint at operational cadence, including failure alerts.
- maxSearchSeconds sets a bounded Driver search (default eight minutes).
- approved fare, per-minute/per-km, fee and Driver-share policy.

Server-side secrets/environment: SPOTLY_GEOCODING_URL, SPOTLY_REVERSE_GEOCODING_URL, SPOTLY_ROUTING_URL, SPOTLY_RIDE_PIN_KEY (>=32 chars) and CRON_SECRET. Do NOT put these in NEXT_PUBLIC variables. Configuring a secret does not schedule a background job.

## Operational invariants
- No trip starts without a valid customer pickup code, except existing legacy four-digit rides during migration.
- No Ride payment is declared captured until verified provider state. No Paynow Driver earnings are available before paid capture AND trip completion.
- A cash Driver's attestation is recorded distinctly from provider-confirmed payment; disputes need manual reconciliation.
- No automated no-show fee, fare correction, cancellation fee, refund or bank transfer has been invented.
- Driver payouts need real financial settlement arrangements. Suspended Ride finance holds require Finance investigation, not silent removal.
- Finance and Admin should reconcile a cancellation after a captured payment, a chargeback, trip termination, stranded rider or Driver no-show.
- For a ride whose customer closes the browser, CLIENT dispatch refresh stops; only an operational scheduler can process retries. This is a release blocker until scheduled cadence is verified.
- Public Nominatim is not permitted as a production autocomplete back end. Use a separately licensed/self-operated provider; budget for request quotas and region coverage.

## Real-world release blockers (not resolved by source code)
1. Provision and prove licensed geocoding/reverse geocoding and OSRM-compatible road routing with Zimbabwe and Malawi accuracy, traffic/ETA quality, location rights, timeout handling and SLA.
2. Provision and verify an external protected recurring dispatch worker with monitoring. Vercel Hobby's native cron cadence is not adequate for minute-level Ride redispatch.
3. Verify the real Paynow merchant contract, refund and dispute processes, Cash collections and Driver settlement funds (including negative balances and disputes); obtain legal approval for fare and cancellation rules.
4. Run field trials with real approved Drivers and two mobile devices, including GPS blocked/backgrounded, missed offers, stale GPS, pickup PIN lockout, no-show, breakdown, refunds and payment reconciliation.
5. Complete production-quality map integration with mobile street tiles, routing navigation, geofences, real-time ETA, and native iOS background Driver location tracking. The web route overview is an honest fallback, not parity.
6. Validate Malawi vs Zimbabwe service compliance, local transport licensing, insurance, emergency contacts, operational hours and support staff.
7. Verify all Admin, money, Driver, support, customer, audit and data retention roles, and deliberately approve any live launch.
8. Run non-emulator integration tests and final controlled production acceptance with no demo data before switch-on.

## Test commands
- node --test tests/rides-production.test.mjs tests/rides-v9-integrity.test.mjs
- npm run build
- npm test (entire suite, excluding emulator tests unless explicitly requested)
CI jobs validate the source and Next.js compilation, not external providers or field operations.

No live customer Ride requests, Driver payments or business launch are activated by this feature-branch work.

## Final finance + geofence safeguards (same V9 continuation)

Every enabled Ride city now requires an explicit operator-reviewed service-geofence center and radius, keyed as country:city (for example ZW:harare). Country rectangles alone are not enough to prevent a caller forging a city name in a request. The server validates the pickup distance against the configured geofence; there are no guessed pre-approved city coordinates. Admin Ride Operations can enter verified geofence parameters. This also applies to Malawi.

Provider disputes, initiated customer refunds and serious ride termination record a persistent Ride finance case and set a Driver payout hold. A separately authorized Finance operator must record the outcome, HTTPS bank/provider documentary evidence and a detailed reason; a second Finance reviewer must independently confirm before removing the hold. The system refuses clearance while another tracked Ride finance review remains unresolved. This attests to an external resolution; it never initiates a refund or payout, and does not alter historical external bank balances. Evidence can be reviewed in Admin Ride detail when the user has Finance permission.

Note: Scheduled rides, ride-for-someone-else, street-tile map SDK, traffic-aware navigation, iOS native background location and real external dispatch/payment service provisioning still require their own implementations or operational integrations. Do not interpret CI green as verification of those capabilities.

# Spotly V9 — Send, Product Branding and Service Launch Controls
20 October 2026. V9 feature branch, PR #6 (draft and unmerged).

## Customer names and URLs
- SpotlyBite: customer label Bite, route /bite, legacy /eat redirects.
- SpotlyShopper: customer label Shopper, route /shopper, legacy /shop redirects.
- SpotlyBook: label Book, route /book.
- SpotlyLive: label Live, route /live, legacy /events redirects.
- SpotlyRide: label Ride, /ride.
- SpotlySend: label Send, /send.
- SpotlyAssist continues as an assistance feature in Shopper and Bite, not a separately confusing shopping brand.

Internal service identifiers `eat`, `shop`, `events`, `ride`, `send` and persisted transaction keys DO NOT change. This preserves existing orders, Firestore indexes, third-party integrations, taxonomy and marketplace filters. Legacy /city/:city/eat, /shop and /events redirect to /bite, /shopper and /live while retaining city search support. The sitemap and customer service navigation point to canonical new URLs. Old links preserve query strings through Next.js redirects.

## Admin: an actual place to launch Ride and Send
- Navigate to `/admin/mobility`; Service Launch is now the first/default tab.
- The two service cards show disabled/enabled, geographic coverage, verification flags, and unmet infrastructure requirements.
- Configure pricing, zones and scheduler flags on the Ride or Send tab; saving those settings cannot silently change launch state.
- To enable, an authorized operator must type `ENABLE SPOTLY RIDE` or `ENABLE SPOTLY SEND` into the confirmation field after all prerequisites pass. Pausing uses `DISABLE SPOTLY RIDE` or `DISABLE SPOTLY SEND`. The server checks roles, verifies prerequisites and records an audit event.
- The launch gate requires explicit approved country/city geofences (Send: Zimbabwe only), an approved routing service, licensed geocoding and reverse geocoding, PIN encryption secrets and confirmed running external dispatch scheduler. It does not prove field Driver coverage.
- The verification toggles are the operator's attestations. Do not mark them true until the corresponding provider, cron frequency, alerts and geographic boundary have been tested.

## Send implementation hardening
- The customer and Driver UI still support immediate and scheduled parcel delivery, sizes, weights, sender/recipient details, two handoff codes, restricted goods acknowledgement, proof photography and Activity integration.
- Booking and quoting now require a confirmed OSRM-compatible road route, immutable server-approved Zimbabwe pickup country and approved pickup city geofence, exact confirmed quote currency/amount and a separate secure PIN key. Malawi is Ride only.
- Two independent random six-digit PINs are stored AES-GCM encrypted (legacy old 4-digit records remain readable during existing-trip migration). Driver pickup and recipient handoff enforce a durable counter with ten-minute lock after five invalid attempts.
- Configured proof photography requires an authenticated upload URL scoped to the assigned Driver and parcel. URLs outside that Firebase Storage path are rejected. An actual storage-object existence check before final finance settlement remains a necessary live validation.
- Dispatch rejects stale/missing GPS, honours approved Driver permissions and vehicle suitability, uses stable offer identifiers and creates an Admin incident after exceeding the bounded search window. Customer-triggered retry and scheduled-pickup promotion act as fallbacks while the sender's page is open.
- A real protected recurring background scheduler is still required to recover jobs when the customer/browser is closed. No native frequent Vercel Hobby cron has been assumed.
- Admin manual assignment is transactional, preserving Driver capacity ownership. Cancellation after physical collection is rejected in favor of a documented return or loss workflow.
- Delivery completion for Cash requires an affirmative Driver collection attestation; the UI no longer silently marks cash provider-paid. The platform fee is recorded separately.
- Paynow pre-dispatch payments are processed only from an awaiting-payment Send. Provider callbacks avoid resetting an active/terminal Send and stop duplicate Driver credits. Digital Driver earnings become available only after confirmed provider capture and completed delivery.
- Cancelled paid Send requests, chargeback disputes, returns, and lost parcels open an auditable Finance exception with a Driver payout hold. Operators must use independently corroborated external settlement evidence and a second reviewer; no fake automated refund or payout is performed.
- A Driver can report recipient handoff failure. Operations can arrange a return, declare a parcel lost or cancel an uncollected request, but cannot claim an external refund without evidence. Return verification uses the original sender's secure pickup code.
- Serious Send incidents put the job on an Operations safety hold; unresolved Driver settlement holds block Driver payouts.
- Admin Send tab exposes recovery and documented external financial reconciliation actions.

## Production blockers that code alone cannot solve
1. A separate staging Firestore project and identity/storage namespace. The current repository pins `spotly-africa` project IDs, so preview is NOT an independent test environment.
2. Licensed/operated forward/reverse geocoding and Zimbabwe-accurate OSRM-compatible routing on secure HTTPS endpoints.
3. Externally provisioned and monitored dispatch scheduler triggering `/api/internal/parcel-dispatch` at appropriate operational cadence. A secret without a scheduler does nothing.
4. Real authorized cash/Paynow collection, refund/chargeback, Provider confirmation, Driver settlement/bank liability and compensation policies.
5. End-to-end tests on two physical devices and an Admin account: location tracking with browser backgrounded, delayed callbacks, handoff PIN throttling, no recipient, return, lost parcel and real authorized payment evidence.
6. Validate privacy, transport/courier compliance, prohibited goods, service territory, insurance and emergency support locally. No live customer booking until approved.
7. Complete professional street-tile maps and mobile native background location tracking as applicable. The existing web map/tracking is not a production route-navigation SDK.
8. Verify the configured merchant/provider credentials and customer support workflow in a controlled pilot.

## Tests
`node --test tests/send-production.test.mjs tests/send-v9-integrity.test.mjs tests/spotly-products-v9.test.mjs`
`npm run build`
These are code and pure-rule checks; they do not prove actual external services.

**Production stays unchanged.** Commit only to the V9 draft feature branch; do not merge or enable real payments as part of source implementation.

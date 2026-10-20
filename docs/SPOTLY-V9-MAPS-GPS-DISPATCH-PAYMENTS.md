# Spotly V9 — Maps, street geocoding, routing, live GPS and dispatch acceptance

**Branch scope:** V9 draft feature branch only, unmerged. This file does NOT certify a live financial or transport rollout.

## Selected mapping approach and cost protection
- **Map UI:** MapLibre GL JS (pinned client runtime). Style JSON comes from `SPOTLY_MAP_STYLE_URL`; a domain-restricted **browser-safe** tile token is acceptable in the URL. Do not put a secret server token in this publicly exposed style link.
- **Map tiles:** a licensed OSM-derived map provider such as MapTiler or self-hosted vector tile server. OpenStreetMap Foundation's free `tile.openstreetmap.org` and MapLibre demo tiles are NOT the commercial production backend. Provider obligations, attribution and price/usage ceilings remain yours to approve. Every map displays OSM attribution.
- **Forward/reverse lookup:** existing `/api/public/geocode` and `/api/public/reverse-geocode`. Both require a production-licensed HTTPS **Nominatim-compatible response** format (including `address.country_code`, latitude, longitude, display_name, and address). `SPOTLY_GEOCODING_URL` and `SPOTLY_REVERSE_GEOCODING_URL` preserve their server-side provider query key. We specifically prohibit the free public Nominatim endpoint for autocomplete.
- **Road distance & duration:** OSRM-compatible HTTPS `SPOTLY_ROUTING_URL`, responding with routes[0].distance, duration and GeoJSON geometry. Server independently requotes on booking and checks the previously displayed amount/currency. No fallback to aerial distance for actual quotes.
- **Customer map:** Ride and Send offer separate pickup and destination map-pin selection, zoom, drag/tap location choice, server reverse-geocode confirmation, and a route map from the server's actual road geometry. Route maps display only recent assigned-Driver GPS (and update its marker on new fixes).
- **Coverage:** Ride launch countries ZW and MW, per-city approved geofences. Send remains Zimbabwe only, with approved city geofences. A reverse-geocoded pin is NOT by itself proof the city is approved; quote/request rules continue to enforce policy.
- **Developer responsibility:** The pinned MapLibre UMD bundle is loaded from jsDelivr on map interaction; for strict production CSP or offline resilience, the SDK should be vendored with npm and lockfile pinned before public launch.

## Vercel/server configuration

Set these **server-side environment variables** in the appropriate Vercel project and environment, after setting separate staging Firebase credentials. Never put secrets in NEXT_PUBLIC variables.

| Variable | Required usage |
|---|---|
| `SPOTLY_MAP_STYLE_URL` | HTTPS public/restricted style.json for licensed vector tiles; token if necessary is browser-visible |
| `SPOTLY_GEOCODING_URL` | HTTPS, Nominatim-compatible search endpoint, with its *server-only* credential query if required |
| `SPOTLY_REVERSE_GEOCODING_URL` | HTTPS, Nominatim-compatible reverse endpoint, with private credential query if required |
| `SPOTLY_ROUTING_URL` | Licensed HTTPS OSRM-compatible routing service base |
| `SPOTLY_RIDE_PIN_KEY` | Unique, long high-entropy key; do not rotate without handling active encrypted trips |
| `SPOTLY_SEND_PIN_KEY` | Different high-entropy key for Send handoffs |
| `CRON_SECRET` | 32+ character secret for external recurring dispatcher endpoints |

**Avoid surprise bills:** cap per-provider daily/monthly requests, restrict public tile keys by allowed Spotly domains, rotate compromised keys, monitor quotas/alerts, set low initial budgets and use location-search debouncing and server rate limits. MapLibre itself is open source, but map tiles, geocoding and routing hosting can be billed.

## Dispatch worker setup

An endpoint is not a schedule. Configure an **actual external scheduler** (e.g., your own Cloud Scheduler or another provider that supports approximately 1-minute cadence) to make authenticated GET requests with the header `Authorization: Bearer <CRON_SECRET>`:

- `https://YOUR_STAGING_HOST/api/internal/ride-dispatch`
- `https://YOUR_STAGING_HOST/api/internal/parcel-dispatch`

The functions process eligible pending jobs, expire stale offers, handle scheduled Send promotion and record **real execution heartbeats** in `mobilityDispatchHealth/{ride|send}`. Service Launch requires at least three successive authenticated calls roughly 20–240 seconds apart, the latest within 210 seconds, and no errors in the latest result. Merely checking `dispatchSchedulerVerified` does not bypass this requirement. Monitor failures, schedule outages and response duration independently. If the browser is closed, customer-side retries are not reliable: the worker is mandatory.

No external scheduler service, secret value or billing account was created by this code change.

## GPS and location privacy

- Online Driver web app currently sends browser `watchPosition` updates roughly every 15 seconds when permitted.
- Server now rejects stale fixes, inaccurate fixes above 150m, impossible coordinate values and implausible position jumps. All incoming fixes are attributable to authenticated approved online Driver presence; Firestore records last server-accepted update.
- Customer receives only assigned Driver location, with a timestamp and short freshness window; map should not imply a current position after last accepted fix ages out.
- Driver app shows visible warnings when location errors occur or updates stall. iOS browsers may suspend background location; **native iOS Driver background location, OS-level permission handling and real-device battery/accuracy tests remain required**.
- These controls reduce accidental spoofing but cannot cryptographically guarantee physical GPS legitimacy.

## Real-money acceptance

Spotly's current Paynow integration requires official merchant Integration ID and Key, obtained from the merchant/admin account, configured through server-only Spotly secrets or Vercel's environment. It includes intent lock/idempotence, provider callback parsing/signature handling, a provider poll, exact currency/amount matching and financial exception queues. Cash completion is only a Driver's attestation, not independently verified bank settlement.

Before authorizing payment acceptance, test: a real approved merchant connection, the exact redirect/poll URL contract, successful and failed payment (including callback duplication), a chargeback, cancellation after capture, customer refund and independent Finance evidence, plus Driver payout reconciliation. **No Paynow refund or bank payout is initiated by this work; never claim a refund completed without externally confirmed bank/provider evidence.**

## Staging / operations acceptance
1. Isolate preview Firebase Auth, Firestore and Storage from production. The current V9 preview is NOT automatically isolated.
2. Add map style and providers; test Zimbabwe and Malawi pin search, reverse geocoding, roads, routing accuracy and off-zone failures.
3. Start real signed minute-level cron calls to both dispatch endpoints; Admin Service Launch must show recent authenticated heartbeats.
4. On separate customer/Driver phones, test offers, GPS denied/approximate/stale, lost network, pickup PIN lockout, arrival, completion, recipient unavailable and return.
5. Test Paynow merchant transactions only after the authorized owner approves live test funds and reconciliation procedures.
6. Inspect Admin > Mobility > Service Launch; approve transport compliance, insurance, support hours, Driver vetting and geographic rollout. Do not activate in production until verified.

**CI green proves source checks and the Next.js build, not real external service or field operation.**

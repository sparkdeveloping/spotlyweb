# SpotlyRide + SpotlySend — MapMap routing integration (2026-10-20)

## Confirmed configuration and objective
Vercel project `spotlyweb` lists the following **Production-only** variables:
- `SPOTLY_ROUTING_URL`
- `SPOTLY_ROUTING_API_KEY`
- `SPOTLY_MAP_STYLE_URL`

Their names/targets were confirmed without decrypting or logging secret values.
**Preview has no routing key/URL at the time of implementation.** Preview will
build but cannot perform a live MapMap route until the owner separately grants
a scoped Preview key. Do not copy production Firebase credentials into an
unsafe preview just to run an end-to-end checkout.

MapMap official routing documentation:
https://mapmap.ai/docs/api/get-route-v1-profile-coordinates
It exposes `GET /route/v1/driving/{lon,lat;lon,lat}`, accepts
`Authorization: Bearer snk_...` and supports `geometries=geojson`.

## Changes
- `lib/ride-routing.js` now sends the bearer credential **server side only**
  for the exact `api.mapmap.ai` host; unrelated OSRM hosts never receive
  the MapMap secret. MapMap requests fail closed on missing/malformed keys,
  invalid configuration, quota limits, unauthorised responses, timeouts,
  malformed road geometry and snapped routes too distant from both pins.
- Ride AND Send quote/request routes already share
  `getVerifiedRideRoute()`; they now automatically use the authenticated
  provider and provider-confirmed metres, seconds and geometry.
- The `lib/ride-server.js` informational fare-preview gate checks provider
  credentials, approved country/city and **real on-demand route geometry**;
  it does not require the independent booking launch switch,
  background scheduler or handoff PIN. Actual Ride requests independently
  enforce all launch gates, payment and encrypted PIN prerequisites.
- Send's strict **booking** gate now accepts MapTiler forward/reverse geocoding
  and requires actual MapMap credentials; it still enforces the independent
  Send scheduler, handoff PIN, geofences and service launch.
- Admin > Mobility > Service Launch includes buttons to test fixed real road
  paths in **Harare** and **Lilongwe**, read-only and rate-limited to eight
  manual probes per admin per hour. Tests do not write any launch state,
  dispatch a Driver, or transfer money.
- Every money-related action remains disabled while actual service
  activation is incomplete.

## Required settings and launch steps

1. Vercel **Production**: `SPOTLY_ROUTING_URL=https://api.mapmap.ai`
   (base ORIGIN only, not a specific route path). Set
   `SPOTLY_ROUTING_API_KEY` to your real MapMap `snk_...` key.
   Never use `NEXT_PUBLIC_`, source code or a URL query argument for it.
2. Redeploy the Git commit after merging this PR. Production environment
   variable edits only apply to fresh deployments.
3. Open Spotly Admin > Mobility > Service Launch. Run both test routes;
   review the measured distance, ETA and response time. Failure messages
   explain invalid credentials (401/403), quota (402/429), missing road
   geometry and connectivity. This test spends a small provider request quota.
4. Configure approved countries/cities, city geofences and fare factors in
   Admin > Mobility > Ride (and independently for Send). Informational Ride
   quotes use actual MapMap road geometry, but **do not** mean bookings are
   available. Two distinct pinned points at least 150 m apart are required.
5. Only after real provider/field verification should a role-authorized
   operator set the `routingVerified` configuration flag. Full **booking**
   launch still needs three recent signed dispatch scheduler heartbeats,
   a unique `SPOTLY_RIDE_PIN_KEY` / `SPOTLY_SEND_PIN_KEY` (32+ chars),
   vetted Drivers, country/city coverage, customer support and payment
   reconciliation. Leave launch disabled until independently tested.
6. Monitor MapMap monthly requests, rate limits, usage costs and geographical
   coverage. Validate real routes in Zimbabwe and Malawi, not just a
   route for an unrelated country. Route duration is a map estimate, not
   a live traffic guarantee.

## Safety boundaries
- Production `main` remains unchanged until the PR is merged.
- No externally hosted cron scheduler has been provisioned by this code.
- No real payment acceptance or refunds have been executed.
- The MapTiler style URL is browser-visible. The MapMap secret is not.
- CI green and Vercel READY are not substitutes for live MapMap/Driver tests.

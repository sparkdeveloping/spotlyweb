# Ride fare preview decoupled from live dispatch — October 2026

## Why the previous screenshot failed
Production /ride showed both addresses confirmed but `GET /api/customer/rides/quote`
returned HTTP 409: `Ride dispatch background recovery has not been verified.`.
The quote API called `rideAvailability()` (the **booking and dispatch gate**)
before trying to calculate a price.

Vercel currently contains `SPOTLY_MAP_STYLE_URL` but does not expose
`SPOTLY_ROUTING_URL`, `CRON_SECRET`, or `SPOTLY_RIDE_PIN_KEY`
in its listed environment-variable names. External secret stores were not
audited. A map style is not a licensed road route API.

## This change
- `rideQuoteAvailability()` permits informational estimates without a running
  dispatch scheduler, PIN encryption key, or active booking switch, **but only**
  when approved country/city, verified routing configuration, and licensed
  geocoding are present.
- The quote API calls `validateRideTerritory()` and
  `getVerifiedRideRoute()` before pricing. It never guesses road pricing.
- It separately returns `bookingAvailable` and `bookingReason` from
  the unchanged full `rideAvailability()` check. The customer screen visibly
  labels an informational estimate and disables Request when operational
  bookings are not ready.
- Real Ride POST still independently invokes `rideAvailability()`,
  validates routing/territory, payment and security.
- Changing either location, city, country, or vehicle class clears stale quotes.
- When MapTiler can only say a pin is in Harare and supplies no street,
  the UI displays its exact dropped coordinates rather than implying two
  distinct pins are the same exact address.
- Errors no longer receive the misleading default success title "Done."

## To enable estimates
1. Choose an actual licensed HTTPS **OSRM-compatible** routing endpoint and
   set `SPOTLY_ROUTING_URL` in the appropriate Vercel environment.
   This is a server-side endpoint, not the MapTiler map style. Public/free
   shared demo OSRM routers cannot be assumed production-capable or licensed.
2. Test real Harare roads, blocked routes, provider latency, accuracy,
   domain/response formats, response rate limits and provider billing.
3. Admin > Mobility > Ride: confirm `routingVerified` and approved country,
   city and real city geofence. Never check a flag solely to suppress an error.
4. Deploy; retry the quote for two geographically separated map pins.
   It should show an informational road-based fare only if the above succeeds.
5. To enable **bookings**, separately provision and verify the signed
   background scheduler, authenticated dispatch heartbeats, unique 32+
   character Ride PIN encryption key, payment acceptance, vetted Drivers and
   field-tested location tracking. Admin > Mobility > Service Launch enforces
   readiness. Do not activate these controls just to display quotes.

MapTiler Routing is a **separate beta product**, not supplied by default with
map tiles or MapTiler geocoding.

**This PR is deliberately not merged into main until explicitly approved.**

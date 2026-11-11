# Spotly iOS Ride/Send routing recovery — 2026-11-11

## Root-cause candidates confirmed in source

- Native Ride/Send use the Firebase `customerRideQuote` / `customerSendQuote` callables, **not Apple MKDirections**. The server obtains an OSRM-shaped, OSM-derived route from MapMap (or an explicitly configured trusted OSRM-compatible endpoint).
- The existing Cloud Functions did not bind `SPOTLY_ROUTING_API_KEY`, while the Vercel/web environment has its own settings. No Firebase routing credential can be inferred from a working web route.
- Firebase `platformFoundation` omitted the money contract fingerprint required by the uploaded Phase 45 iOS `RuntimeStore`; a failed preflight also prevents native service readiness from loading.
- The native Ride pickup UI invokes `customerRidePickupSuggestions`, which was missing from the Cloud Functions exports.

These findings identify concrete code mismatches. They **do not prove** which failures occurred in the currently deployed production build without authorized Firebase logs and live probes.

## Changes in this branch

- Synchronize the byte-identical `spotly-money.v1.json` across web and Firebase, expose `moneyContractVersion` and `moneyContractSHA256` from `platformFoundation`.
- Bind `SPOTLY_ROUTING_API_KEY` via `defineSecret` on `customerRuntime`, `customerRideQuote`, `customerSendQuote`, `customerRidePickupSuggestions`, and `adminMobilityRouteCheck`.
- Default routing host to `https://api.mapmap.ai` when `SPOTLY_ROUTING_URL` is unset; still allow a trusted licensed HTTPS OSRM-compatible host by explicit configuration. The provider key remains server-side.
- Restore a **single** pickup suggestion whose coordinates come from a verified drivable route and a road-access snap bounded to 350 m. Never guess a road or draw a straight line.
- Expose an App Check-protected, authenticated, admin-only route probe for fixed points in Harare (ZW) and Lilongwe (MW).

## Required operational steps (NOT performed by source changes)

1. Confirm that the MapMap account is authorized for Zimbabwe and Malawi driving routes and that its full server key starts with `snk_`. Do not put the key in Git, iOS, client bundles, or Vercel's public environment variables.
2. In the authorized Firebase project: `firebase functions:secrets:set SPOTLY_ROUTING_API_KEY --project spotly-africa`. The CLI will privately prompt for the key. If you use an alternative licensed provider, configure `SPOTLY_ROUTING_URL` as a nonsecret HTTPS base URL for Firebase Functions.
3. Deploy the Firebase functions for `platformFoundation`, `customerRuntime`, `customerRideQuote`, `customerSendQuote`, `customerRidePickupSuggestions`, and `adminMobilityRouteCheck` to `europe-west1`; confirm their deployed versions and App Check behavior. Updating the secret alone does **not** redeploy a function.
4. Using an authorized admin account and a trusted App Check token, call `adminMobilityRouteCheck` twice: `{country:"ZW"}` and `{country:"MW"}`. Verify that each returns `routeReady:true`, a nonzero distance, and a duration. A successful ZW probe is not proof of MW coverage.
5. On an iOS device or simulator with working Firebase configuration, check that `platformFoundation` completes, `customerRuntime.nativeMobility.routeReady` is true, and selecting a destination and pickup displays a real road polyline and fare. Repeat with Send and with a pin offset from the road; reject unsafe snaps.
6. Confirm Ride/Send booking and payment/dispatch launch gates separately; **do not** set `routingVerified`, `dispatchSchedulerVerified` or real-money transaction states automatically based only on a routing probe.

## Acceptance / no-go criteria

- At least two supervised point-to-point routes per launch city (a central urban route and an edge-of-service-area route), with real mapped polyline, duration, quote, endpoint snapping and street-level review.
- Test missing key, invalid key, 402/429 quota, 5xx and disconnected road results: customer sees safe error messaging and **no fake fare or straight line**.
- Compare road routes from iOS and web for consistent geometry and tariffs. Ensure stale quotes are invalidated on pickup/destination change.
- Release remains **NO-GO** until functions are deployed, the provider is confirmed operational for both countries, native Xcode tests pass, and production service approval remains separate.

## Map renderer decision

Replacing the Apple **basemap renderer** alone cannot fix backend route-generation failures. Once the above is working, move the visual layer to **MapLibre Native iOS** backed by a licensed OSM vector-tile/style provider, behind a controlled rollout flag. Preserve the existing Ride/Send card choreography and keep server route authority, country validation, safety distances, fares, booking, and real-time vehicle coordinates unchanged. Do not access the donation-funded public OpenStreetMap tile server as a production tile CDN. Attribute OSM and the selected tile provider.

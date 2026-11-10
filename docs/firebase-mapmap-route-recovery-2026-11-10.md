# Firebase customer Ride/Send road-routing recovery — 2026-11-10

## Observed incident

iOS Ride reaches the Route step with two "Pinned location" values but no road polyline; the app then says it could not confirm a nearby road connection.

The backend implementation in `firebase/functions/src/core/mobility-road-access.js` sent OSRM `radiuses=350;350` to `https://api.mapmap.ai/route/v1/driving/...`. MapMap's documented compatibility layer explicitly **rejects** `radiuses`. On failure, the implementation then tried `GET /nearest/v1/driving`, which MapMap does not document; MapMap documents `POST /locate` and its own `snap_retry` route behavior instead.

Provider references:
- https://mapmap.ai/docs/api/get-route-v1-profile-coordinates
- https://mapmap.ai/docs/mapbox-compatible-api
- https://mapmap.ai/docs/api/post-locate

## Correction in this branch

- MapMap route queries now request `snap_retry=true` and omit `radiuses`. Native OSRM retains `radiuses`.
- MapMap NoRoute is not retried through a nonexistent OSRM `nearest` endpoint. MapMap's own route implementation already retries snapping.
- The route payload is still checked for real geometry, distance, duration, proximity to each selected point (350 m), and signed-off drivable access; **no straight-line fare or invented road geometry is introduced**.
- An HTTP 400/404/422 from the provider is classified as upstream integration failure instead of falsely claiming that the user's pinned location has no road access.
- `customerRuntime.nativeMobility.routeReady` now requires an apparently valid MapMap server key when the routing hostname is MapMap. This is a **configuration check**, not proof of a successful provider request.

## Firebase runtime configuration is separate from Vercel

The source uses `SPOTLY_ROUTING_URL` and `SPOTLY_ROUTING_API_KEY` through the Firebase Functions runtime's environment. Vercel Production values do **not** populate Firebase Cloud Functions. Therefore, a successful deployment of the seven core Functions does not imply quotes work.

Current implementation expects:

```dotenv
SPOTLY_ROUTING_URL=https://api.mapmap.ai
SPOTLY_ROUTING_API_KEY=<your-real-MapMap-server-key>
```

To provide these values through Firebase's supported dotenv mechanism, create the project-local file `firebase/functions/.env.spotly-africa` on the deployment computer **without committing it**. The repository's `firebase/functions/.gitignore` excludes `.env.*`. For production key management, prefer moving the provider key to Google Secret Manager and explicitly binding it to quote Functions, with a coordinated credential rollout. Never put the key in Git, JavaScript sent to the browser, mobile app, screenshots, support chat, or build logs. If the original provider key is no longer retrievable, issue or rotate it with MapMap, then coordinate any Vercel instance that also uses the old key.

Re-deploy the corrected quote Functions with the authorized Firebase account after configuring the runtime:

```bash
cd ~/Desktop/spotlyweb
git pull origin main
node --test tests/mobility-road-access-20f.test.mjs
npm --prefix firebase/functions run check
npm run firebase:deploy:functions:core -- --account spotlyafrica@gmail.com
```

## Acceptance checks

1. Firebase callable `customerRuntime` returns `nativeMobility.routeReady: true` for the authorized deployment. This only proves the endpoint and credential shape are set.
2. With a real Harare origin/destination separated by a drivable distance, `customerRideQuote` returns nonempty `quote.routePath` (confirm actual response shape), road distance, duration, and bounded access-point offsets.
3. iOS renders that actual geometry as a road polyline and never turns provider/configuration errors into a "try another pin" message.
4. Test an off-road building pin within 350m of a safe road; confirm the app shows the adjusted access coordinate and asks the rider before relocating a pickup by 35m or more.
5. Test provider missing key, 400, 429, timeout, NoRoute, same point, and cross-border inputs. Distinguish infrastructure failures from inaccessible locations.
6. Verify public preview and normal account scopes independently. A working quote is not a launched, dispatchable ride or a working Driver handoff.

## Remaining separate iOS task

The iOS project is not present in the connected GitHub `sparkdeveloping/spotly` repository (which currently contains a nested web tree), so this web/Firebase PR **does not** modify the native labels, Apple Maps overlay, loading animation, or presentation. `Pinned location` is still a poor address fallback, especially when two different pins share the same label. Native iOS should retain exact coordinates, reverse-geocode only for display, distinguish failed reverse geocoding from failed routing, draw the returned polyline, and avoid letting the lower sheet obscure both selected pins.

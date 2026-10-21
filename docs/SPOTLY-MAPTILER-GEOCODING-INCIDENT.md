# MapTiler geocoding — Spotly Ride/Send pin verification

## Incident
At 2026-10-20 17:12 local time, production `GET /api/public/reverse-geocode`
returned HTTP 503 `Licensed location identification is not configured.`
The visual map was already working with `SPOTLY_MAP_STYLE_URL`.

## Code change
When no Nominatim-compatible `SPOTLY_GEOCODING_URL` and
`SPOTLY_REVERSE_GEOCODING_URL` are configured, Spotly uses MapTiler's
licensed address Search and reverse geocoding API. A server-only adapter reads
`SPOTLY_MAPTILER_GEOCODING_KEY` when explicitly set; otherwise it reads
the **public browser key** already supplied to MapLibre in a MapTiler
`SPOTLY_MAP_STYLE_URL`. This is intentional only for MapTiler's public,
origin-restricted API keys. No keys are placed into source control.

MapTiler endpoint details:
- Search: `GET https://api.maptiler.com/geocoding/{query}.json?country=zw&key=...`
- Pin: `GET https://api.maptiler.com/geocoding/{longitude},{latitude}.json?key=...`

The adapter converts GeoJSON features into existing Spotly objects:
`{lat,lng,label,formattedAddress,area,city,country}`.
Only Zimbabwe/Malawi results with verifiable country and city are accepted.
A map marker never substitutes for a verified address and approved geofence.

**To test on production:** merge the focused PR into `main` (with approval),
redeploy Vercel, ensure `SPOTLY_MAP_STYLE_URL` exists in Production,
then test the pin flow on `www.spotlyafrica.com/ride`. Only merge after
reviewing the effect on real customer geocoding usage and provider quotas.

## Origin-restricted API keys
The adapter forwards the application's actual trusted HTTPS origin to MapTiler
because its Origin-restricted browser keys require an Origin/Referer even when
the API call is proxied through Vercel. In MapTiler API Key settings permit
`www.spotlyafrica.com` and `spotlyafrica.com` for production.
Enable preview deployment hosts only for preview testing, not permanently
unless intended. Do **not** use `?` as a wildcard origin just to make this work.

If MapTiler returns HTTP 403, verify the allowed origins and whether the
subscription permits the geocoding endpoints. Check MapTiler usage quotas and
cost restrictions before enabling real commercial usage.

This change does NOT configure an OSRM-compatible driving route backend;
`SPOTLY_ROUTING_URL` and licensed driver dispatch are still independently
required for fare estimates and bookings.

## Firebase App Check
The screenshot's Firebase App Check 400 responses are a separate issue.
The client code uses `ReCaptchaEnterpriseProvider`, which requires a
score-based reCAPTCHA **Enterprise** Web site key, registered for the exact
Firebase Web App in Firebase Console > Security > App Check. Add both apex and
www Spotly production domains to the reCAPTCHA key's allowed domain list and
the actual preview domains when explicitly testing previews. Do not insert an
ordinary reCAPTCHA v3 key into the Enterprise provider, and do not disable
App Check enforcement as a workaround. Verify token generation and App Check
request metrics before increasing enforcement.

The map sprite-image warnings are nonfatal and unrelated to the 503.

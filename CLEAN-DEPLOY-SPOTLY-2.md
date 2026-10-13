# Clean deployment instructions — Spotly Web 5.7.0

This archive is a full-source replacement for the current Spotly Web project.

## Important

Do **not** merge this archive into the older design-showcase package. Replace the application source with this package while keeping production secrets in Vercel/Firebase environment configuration.

The archive intentionally excludes:

- `.env.local`
- `.git/`
- `.next/`
- `node_modules/`
- macOS metadata

## Vercel

The directory containing `package.json` is the project root.

Recommended validation:

```bash
npm ci
npm run check:js
npm run check:theme
npm test
npm run lint
npm run build
```

## Customer product behavior

- `/` — live Spotly customer marketplace
- `/eat` — opens Eat mode
- `/shop` — opens Shop mode
- `/book` — opens Book mode
- `/events` — opens Events mode
- `/ride` — opens Ride mode; requests remain unavailable until the ride operations feature flag is enabled
- `/send` — opens Send mode; peer delivery remains unavailable until the operations feature flag is enabled
- `/search` or `/?view=search` — customer search
- `/activity` or `/?view=activity` — orders, deliveries, appointments, bookings and tickets
- `/saved` or `/?view=saved` — saved businesses
- `/place/<businessId>` — shareable business detail
- `/item/<itemId>?business=<businessId>` — shareable offering detail
- `/activity/<id>` or `/order/<id>` — direct Activity detail
- `/marketplace` — compatibility marketplace route

## Feature flags

Ride can be exposed when one of these is true in platform settings:

```text
mobility.ridesEnabled
launch.ridesEnabled
```

Peer-to-peer Send can be exposed when one of these is true:

```text
commerce.peerDeliveryEnabled
launch.sendEnabled
```

Until then the customer interface communicates that the service is opening area-by-area. It does not simulate transactions.

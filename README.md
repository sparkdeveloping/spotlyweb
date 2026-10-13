# Spotly Web Platform

Spotly is one operating network with five role-specific production origins backed by one Next.js/Firebase platform. The customer root is now the live marketplace experience rather than a marketing/launch presentation:

```text
https://spotlyafrica.com/              Customer, marketing and Marketplace
https://business.spotlyafrica.com/     Spotly Business
https://driver.spotlyafrica.com/       Spotly Driver
https://staff.spotlyafrica.com/        Spotly Staff
https://admin.spotlyafrica.com/        Spotly Admin
```

Public production URLs use **clean product-local paths**. The old path-prefixed URLs remain compatibility redirects only:

```text
spotlyafrica.com/business/staff   → business.spotlyafrica.com/staff
business.spotlyafrica.com/business/staff → business.spotlyafrica.com/staff
spotlyafrica.com/admin/drivers    → admin.spotlyafrica.com/drivers
spotlyafrica.com/driver/active    → driver.spotlyafrica.com/active
spotlyafrica.com/staff/schedule   → staff.spotlyafrica.com/schedule
```

The internal App Router still uses `/business`, `/driver`, `/staff`, and `/admin` route trees. `proxy.js` maps clean product-domain URLs into those internal routes so the application does not need five duplicated codebases.

This repository is **Spotly Web Platform 7.0.0**. V7 keeps the production marketplace, payments, Ride, Send, Business, Driver, Staff and Admin operating systems from the 6.x releases, while rebuilding the presentation layer as a coherent experience system: one Customer Shell, progressive onboarding, honest personalization, designed empty/loading/error states, bespoke service identity, restrained motion, normalized geometry and stronger role-aware workspaces.


## Spotly V7 experience system

V7 is an experience-system refactor rather than a cosmetic theme pass. Production transaction and operational logic is retained while customer and role surfaces are normalized around user state, intent, next action, feedback and continuity.

Customer-facing changes include:

- one persistent Customer Shell across Home, Search, Activity, Saved, Profile, Notifications, Help and Referrals;
- desktop navigation split into identity/discovery, primary destinations and context/account utilities;
- five-destination mobile navigation: Home, Search, Activity, Saved, Profile;
- Currency removed from global navigation and moved into Profile → Preferences;
- progressive, skippable first-run onboarding for city, interests and optional useful places;
- honest Home personalization: `Again` only follows completed history and `Near you` only follows precise location;
- a live `Now` accessory for active orders, deliveries, rides, bookings, tickets and Send activity;
- bespoke Spotly service artwork for Ride, Eat, Shop, Book, Events and Send with reduced-motion support;
- intentional empty, loading, error, offline, signed-out and unavailable states;
- semantic Activity identity for orders, deliveries, bookings, tickets, rides and Send;
- flat, categorized Saved and intelligence-first Search experiences;
- one coherent Profile/settings architecture without raw currency or language dropdowns in premium navigation;
- restrained motion tokens, canonical radii and a 1320px discovery canvas.

The internal portals retain their role identities: Business stays approachable and setup-oriented, Driver is action/glance-first, Admin remains dense and operational, and Staff is task-first. Shared primitives and geometry keep them visibly related without forcing identical layouts.

## Canonical routes

| Product | Canonical examples |
|---|---|
| Spotly | `spotlyafrica.com/`, `/eat`, `/shop`, `/book`, `/events`, `/ride`, `/send`, `/activity`, `/saved`, `/search`, `/place/<id>`, `/item/<id>`, `/order/<id>`, `/marketplace`, `/account`, `/claim`, `/drive`, `/support` |
| Business | `business.spotlyafrica.com/`, `/today`, `/activity`, `/catalog`, `/branches`, `/delivery`, `/kiosk`, `/staff`, `/finance`, `/support`, `/settings` |
| Driver | `driver.spotlyafrica.com/`, `/jobs`, `/active`, `/earnings`, `/history`, `/notifications`, `/support`, `/profile` |
| Staff | `staff.spotlyafrica.com/`, `/work`, `/schedule`, `/leave`, `/learning`, `/performance`, `/pay`, `/notifications`, `/profile` |
| Admin | `admin.spotlyafrica.com/`, `/operations`, `/businesses`, `/people`, `/drivers`, `/customers`, `/finance`, `/platform`, `/audit` |

### Business account root

`business.spotlyafrica.com/` is the Business account/portfolio entrance. Opening a specific Business sends the operator to the clean Business-local operating route while preserving `?business=<id>` context where needed. Business `/staff` means **that Business's Team**; it must not redirect to the Spotly Staff product.

## Shared sign-in across subdomains

Firebase browser persistence is origin-scoped, so sibling subdomains cannot simply read each other's Firebase local storage. Spotly uses a server-issued parent-domain session bridge instead:

```text
Firebase sign-in on any Spotly origin
        ↓
/api/auth/session verifies the Firebase ID token
        ↓
Secure HttpOnly session cookie on .spotlyafrica.com
        ↓
A sibling product opens
        ↓
/api/auth/session/bootstrap verifies the shared session
        ↓
Firebase Admin issues a custom token
        ↓
That origin silently restores its normal Firebase client session
```

Sign-out sets a long-lived parent-domain sign-out marker so an old Firebase session left in another sibling origin cannot later recreate the shared session. Active product tabs also reconcile the shared session on focus, visibility changes, and periodically while in use.

The user's theme preference is also mirrored to a safe `.spotlyafrica.com` preference cookie so changing light/dark/system mode in one Spotly product follows them to the others.

## Firebase production-domain configuration

Firebase Authentication must authorize every hostname that can render an authentication flow:

```text
spotlyafrica.com
www.spotlyafrica.com
business.spotlyafrica.com
admin.spotlyafrica.com
driver.spotlyafrica.com
staff.spotlyafrica.com
```

If Firebase App Check with reCAPTCHA Enterprise is enabled, the corresponding reCAPTCHA key/domain configuration must also permit the production hostnames. Phone authentication and OAuth providers must be tested from each product hostname after deployment.

## Vercel domain configuration

All product hostnames should point to the same `spotlyweb` Vercel project. Vercel owns the canonical apex/www redirect direction. Application code intentionally does **not** redirect `www.spotlyafrica.com ↔ spotlyafrica.com`, preventing an application/Vercel redirect loop.

Configure only one canonical direction in Vercel Domains, for example:

```text
www.spotlyafrica.com → spotlyafrica.com
```

Do not configure the opposite redirect at the same time.

## Driver + delivery architecture

```text
Customer checkout
      ↓
Order + delivery job
      ↓
Business preparation
      ↓
Dispatch + Driver offers
      ↓
Driver assignment
      ↓
Business / kiosk pickup
      ↓
Live delivery
      ↓
Customer PIN handoff
      ↓
Driver earnings ledger
      ↓
Driver payout lifecycle
```

Admin can review Driver applications and evidence, inspect Driver eligibility and live location, dispatch/reassign deliveries, inspect the unified delivery timeline, apply holds, investigate incidents, verify payout destinations and process Driver payouts.


## Spotly Ride 6.1

Spotly Ride is implemented as an operational network rather than a customer-only screen:

```text
Customer quote + request
        ↓
Server-authoritative rideTrip + Activity order
        ↓
Dispatch watchdog + nearby eligible Driver offers
        ↓
Driver accepts atomically
        ↓
To pickup → arrived → pickup PIN → in trip → drop-off → complete
        ↓
Driver Money + Customer Activity + rating/support
        ↓
Admin live ride operations, reassignment and exceptions
```

The global ride switch remains **off by default**. Admin Ride Operations controls enabled cities, optional city service areas, pricing, Driver share, and cash availability. The customer API independently rechecks those settings before quoting or creating a ride.

The ride lifecycle is mediated by server APIs. Direct browser access to `rideTrips`, `rideOffers`, and `rideEvents` is denied by Firestore rules. Pickup verification uses a customer-visible four-digit PIN before a Driver can start the trip.

Cash ride completion does not create a second Driver payout: the Driver keeps the collected cash and Spotly's platform fee is posted to the Driver Money ledger. Non-cash ride completion credits Driver earnings normally.

Ride offer redispatch is driven by `/api/internal/ride-dispatch`, protected by `CRON_SECRET`, with a Vercel cron configured in `vercel.json`.


## Spotly Send 6.2

Spotly Send is now an operational parcel network that reuses the same Driver availability, dispatch, Driver Money, Activity, support and Admin Operations infrastructure as Ride:

```text
Customer quote + Send request
        ↓
Immediate or scheduled parcelJob + Activity order
        ↓
Nearby eligible Driver offers
        ↓
Driver accepts atomically
        ↓
Pickup → pickup PIN → collected → delivery → drop-off PIN
        ↓
Optional proof-of-delivery photo
        ↓
Driver Money + Customer Activity + support
        ↓
Admin Send Operations, reassignment, exceptions and proof review
```

Send is **off by default**. Admin Send Operations controls enabled cities/areas, pricing, Driver share, cash availability, scheduled pickup, parcel-size limits and whether proof-of-delivery photography is required.

The lifecycle is server-authoritative. Direct browser access to `parcelJobs`, `parcelOffers`, and `parcelEvents` is denied by Firestore rules. Customer ownership, Driver assignment and Admin privileges are rechecked by the relevant APIs.

Pickup and handoff use separate four-digit verification PINs. Drivers never receive those PINs in the generic bootstrap payload. A required proof photo is uploaded only to the Driver's scoped `driver-send-proof` Storage path and can be reviewed by authorized operations/support roles.

Immediate cash requests can enter dispatch as soon as they are created. Paid immediate Paynow requests enter dispatch after confirmed payment. Scheduled jobs stay reserved until the protected `/api/internal/parcel-dispatch` scheduler promotes them shortly before pickup, avoiding premature Driver assignment.

Cash Send completion follows the same accounting principle as cash Ride: the Driver keeps the collected customer cash and Spotly's platform fee is posted against the Driver Money ledger. Digital Send credits Driver earnings normally.

## Kiosk

Kiosk uses a dedicated branch/mode-scoped device credential. It does **not** require the Business owner's browser session. The live kiosk canonical route is:

```text
https://business.spotlyafrica.com/kiosk/live
```

The device can be enrolled, heartbeated and revoked, reveals only the minimum data required for check-in, resets customer information automatically, and supports Driver pickup mode.

## Payments and notifications after the domain split

Customer payment provider callbacks and return URLs are pinned to `https://spotlyafrica.com`, regardless of which sibling domain happens to call shared server code.

Operational notification records, push notification links, and transactional email buttons are canonicalized to the workspace that owns the event, for example:

```text
Business review → business.spotlyafrica.com/notifications
Driver offer    → driver.spotlyafrica.com/jobs
Admin queue     → admin.spotlyafrica.com/queues/...
Customer activity → spotlyafrica.com/?view=activity
```

Legacy stored notification paths remain readable and are normalized when opened.

## Security model

Sensitive Driver/Delivery resources are mediated by server APIs. Firestore rules explicitly deny direct client writes to high-impact operational collections including Driver approval, presence, delivery jobs/offers/events, Driver Money, incidents and kiosk devices. Driver documents use private Storage paths. Customer handoff PINs and pickup verification codes are never returned in general Driver bootstrap payloads.

The cross-subdomain auth bridge uses:

- Firebase Admin session-cookie verification;
- `HttpOnly`, `Secure`, `SameSite=Lax` cookies on `.spotlyafrica.com` in production;
- same-site origin validation for shared-auth endpoints;
- no-store responses;
- custom-token bootstrap rather than exposing the shared cookie to JavaScript;
- a global browser sign-out marker to prevent stale sibling-origin sessions from resurrecting SSO.

## Technology

- Next.js App Router / hostname-aware `proxy.js`
- React 19
- JavaScript source
- Tailwind CSS 4
- Firebase Authentication, Firestore, Storage, Admin SDK, App Check and Cloud Messaging
- Paynow payment integration
- Resend transactional email integration
- Vercel deployment and custom domains

## Local setup

Requirements:

- Node.js 22.x
- npm 10.9 or later

```bash
cp .env.example .env.local
npm ci
npm run dev
```

Do not commit `.env.local`, service-account JSON, private keys, payment secrets or live provider credentials.

## Release validation

```bash
npm run check:js
npm run check:theme
npm test
npm run test:rules
npm run lint
npm run build
```

Always run the actual Next.js production build in CI/Vercel before promoting a release. Source-level checks are additional safeguards, not a substitute for `next build`.

## Production configuration outside source code

- Vercel domain assignments and one-direction-only apex/www canonical redirect
- Firebase Authentication authorized domains for all six Spotly hostnames including `www`
- reCAPTCHA Enterprise/App Check allowed-domain configuration when App Check is enabled
- OAuth/phone-auth smoke tests from each product hostname
- deployment of supplied Firestore/Storage rules and indexes
- FCM credentials and VAPID configuration
- Paynow/provider credentials and callbacks
- `SPOTLY_FINANCE_ENCRYPTION_KEY`
- Resend verified sender/domain
- reviewed Driver compliance/legal requirements
- staging smoke tests on real mobile devices and all five web origins

Historical implementation reports under `docs/history/` and version-specific root reports describe earlier releases and should not be treated as the current canonical routing or capability state.

## Spotly 5.8.0 — Customer Utility Layer

Search 2.0, Activity 2.0, Saved 2.0, customer Notifications, saved places, shopping defaults, and contextual customer Help are implemented against the production Firebase/auth/transaction systems. See `SPOTLY-CUSTOMER-UTILITY-2.0-2026-10-13.md`.

## Spotly 5.9.0 — Dedicated Customer Service Experiences

Eat, Shop, Book and Events are now first-class marketplace destinations backed by a live public service-feed API. Each service has purpose-built discovery, filters, categories, cross-business offerings, responsive cards, Saved/Activity continuity and direct handoff into the existing transaction system. Ride and Send remain feature-gated until their operational backends are enabled.

See `SPOTLY-CUSTOMER-SERVICE-EXPERIENCES-2.0-2026-10-13.md` for the implementation details.


## Spotly 6.0.0 — Production Hardening + Growth

The 6.0 release hardens the existing marketplace rather than adding a fake new service surface. It includes:

- server-revalidated merchant and Spotly-funded promotions with atomic usage reservations and release on failed/cancelled reservations;
- customer referrals with first-purchase qualification, self-referral/late-claim prevention, configurable rewards and Admin reward review;
- verified-purchase business reviews and rating aggregates;
- booking/appointment capacity reservations that are rechecked inside the Firestore transaction;
- safer payment recovery, checkout idempotency and expired/cancelled reservation release;
- recent/repeat behavior for customer discovery;
- privacy-filtered Firebase Analytics funnel instrumentation;
- public business/item metadata, structured data, city/service landing pages and dynamic sitemap entries;
- service-feed pagination, bounded server caching, stale-while-revalidate responses, Next Image optimization and trust-adjusted business ranking.

Spotly-funded campaigns are operated from **Admin → Content & growth → Campaigns**. Referral campaign amounts and auto-approval are configured under **Admin → Platform configuration**. Merchant-funded promotions remain in each Business workspace.

The 6.0 growth accounting collections (`promotionRedemptions`, `referralProfiles`, `referralCodes`, `referralClaims`, `referralRewards`, `businessReviews`, `availabilityReservations`) are server-authoritative. Deploy the matching Firestore rules with this release.

See `SPOTLY-WEB-6.0-PRODUCTION-HARDENING-GROWTH-2026-10-13.md` for the release implementation record.

6.3 additions
- Launch readiness static audit
- Customer-safe global error recovery
- Offline connectivity banner
- Public lead abuse protection
- Public geocode App Check participation
- Expanded Admin launch gates for credentials, storage, origin, finance encryption, Ride/Send cron + geography, indexing, and bootstrap lock-down

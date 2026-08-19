# Spotly Web Platform

Spotly is one operating network with five role-specific production origins backed by one Next.js/Firebase platform:

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

This repository is based on **Spotly Web Platform 5.5.3** and includes the Driver + Delivery activation, Business production hardening, notification architecture, Marketplace/marketing conversion work, Lottie motion system, and the full subdomain/SSO migration.

## Canonical routes

| Product | Canonical examples |
|---|---|
| Spotly | `spotlyafrica.com/`, `/marketplace`, `/account`, `/claim`, `/drive`, `/support` |
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
Customer order  → spotlyafrica.com/marketplace?view=orders
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

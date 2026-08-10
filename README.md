# Spotly Web Platform

Spotly is one operating network with five role-specific entrances:

```text
/          Public launch experience and customer marketplace
/business  Merchant, branch, delivery and kiosk operations
/driver    Driver application, live availability, delivery execution and earnings
/staff     Spotly workforce
/admin     Platform governance, Driver review, dispatch and operational queues
```

This repository is based on **Spotly Web Platform 5.5.3** and includes the Driver + Delivery production activation pass. The existing Business lifecycle, Money, claims, support and platform-security foundations are preserved and extended into one server-authoritative delivery domain.

## Current delivery architecture

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

## Main routes

| Route | Purpose |
|---|---|
| `/` | Public Spotly launch and marketplace entry |
| `/marketplace` | Customer discovery, basket, pickup/delivery checkout and order tracking |
| `/drive` | Public Driver acquisition |
| `/driver` | Driver application or live Driver home |
| `/driver/jobs` | Live delivery offers |
| `/driver/active` | Current delivery workflow |
| `/driver/earnings` | Earnings, balances and payouts |
| `/driver/history` | Delivery history |
| `/driver/support` | Driver incident and safety reporting |
| `/business` | Business Portfolio and operating workspace |
| `/business/delivery` | Branch delivery configuration and live handoff operations |
| `/business/kiosk` | Kiosk device management |
| `/business/kiosk/live` | Dedicated enrolled kiosk runtime |
| `/staff` | Staff workspace |
| `/admin` | Platform operations |
| `/admin/drivers` | Driver review and delivery/dispatch operations through the Admin Driver section |
| `/support` | Context-aware support |
| `/account` | Profile, workspaces, security and build information |

## Driver lifecycle

```text
Application started
→ Application submitted
→ Spotly review
→ Information required / approved
→ Ready
→ Online
→ Delivery offers
→ Active delivery
→ Earnings / payout
```

Driver operational state, delivery assignment, verification, earnings and payouts are server-authoritative. The old seeded `data/driver.js` and `driver-training-workflow` session simulator have been retired.

## Delivery and Kiosk

Delivery is opt-in per exact Business branch. A delivery-enabled branch stores its coordinates, radius/service settings, preparation time, pickup instructions, operating state and supported vehicle types. Customer delivery checkout requires a map position and confirmable digital payment before dispatch.

Kiosk uses a dedicated branch/mode-scoped device credential. It does **not** require the Business owner's authenticated browser session. Devices can be enrolled, heartbeated and revoked, reveal only the minimum data needed for check-in, reset customer information automatically and support Driver pickup mode.

## Security model

Sensitive Driver/Delivery resources are mediated by server APIs. Firestore rules explicitly deny direct client writes to high-impact operational collections including Driver approval, presence, delivery jobs/offers/events, Driver Money, incidents and kiosk devices. Driver documents use private Storage paths. Customer handoff PINs and pickup verification codes are never returned in general Driver bootstrap payloads.

## Technology

- Next.js App Router
- React 19
- JavaScript source only
- Tailwind CSS 4
- Firebase Authentication, Firestore, Storage, Admin SDK and Cloud Messaging
- Paynow payment integration
- Resend integration point
- Vercel deployment configuration

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

In the generation environment used for this delivery activation, the JavaScript check, theme-safety check and repository test suite passed. The environment could not restore locked npm dependencies because its internal package mirror returned HTTP 404 for `zod-validation-error-4.0.2.tgz`; therefore ESLint, Next production build and Firebase Emulator execution are not claimed as passed here. Run those commands in staging/CI with normal npm registry access before deployment.

## Production configuration still required outside source code

- Firebase web/Admin credentials and authorized domains
- Deployment of the supplied Firestore/Storage rules and indexes
- FCM production credentials and service-worker configuration
- Paynow/provider credentials and callbacks
- `SPOTLY_FINANCE_ENCRYPTION_KEY` for encrypted merchant/Driver financial identifiers
- Actual Driver compliance requirements and reviewed legal agreements
- Maps/routing provider choices if richer in-app routing is required
- Operations staffing, incident escalation and payout execution procedures
- Staging smoke tests on real mobile devices, including location permission and intermittent-network scenarios

Historical implementation reports under `docs/history/` and version-specific root reports describe earlier releases and should not be treated as the current Driver capability state.

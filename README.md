# Spotly Web Platform

Spotly is one operating network with five role-specific entrances:

```text
/          Public launch experience and customer marketplace
/business  Merchant and location operations
/driver    Internal driver training until live dispatch is connected
/staff     Spotly workforce
/admin     Platform governance and operational queues
```

This repository is the **5.1 production-depth candidate**. It preserves the organization → brand → location model while correcting product truth, account/session state, customer pickup availability, business claiming, merchant mobile operations, staff routing, admin queues, support context, accessibility overlays, and release traceability.

## Capability truth

| Area | Current classification |
|---|---|
| Public homepage and waitlist | Pilot-ready UI; launch content and approved businesses require production configuration |
| Customer marketplace | Pilot-ready candidate with real location/branch availability and transactional order creation; payments and cancellation release require production completion |
| Business claiming | Pilot-ready progressive flow with account drafts and persisted evidence |
| Merchant operations | Pilot-ready for pickup-oriented retail/food workflows; additional archetype depth remains staged |
| Driver | Training-only; no live dispatch, earnings, GPS proof, or production job assignment |
| Staff | Pilot-ready internal workflow foundation; external payroll and richer training content remain integrations |
| Admin | Pilot-ready queue and review foundation; provider health and high-volume operations require production signals |
| Payments and notifications | Pending production credentials, provider tests, reconciliation, and delivery enforcement |

See [SPOTLY-CAPABILITY-MATRIX.md](./SPOTLY-CAPABILITY-MATRIX.md) for the detailed status.

## Main routes

| Route | Purpose |
|---|---|
| `/` | Public launch page, waitlist, approved featured businesses, and business finder |
| `/marketplace` | Customer discovery, basket, checkout, orders, and saved businesses |
| `/claim` | Ten-stage business claim and access request |
| `/claim/drafts` | Saved account claim drafts |
| `/claim/status/[claimId]` | Claim review timeline and next actions |
| `/business` | Merchant Today and capability-based operations |
| `/driver` | Internal training scenarios only |
| `/staff` | Staff agenda, scoped work, learning, leave, pay, assets, and support |
| `/admin` | Urgent operations, queues, health, configuration, and governance |
| `/admin/queues/[queue]` | Exact filtered operational queues |
| `/support` | Context-aware customer, merchant, driver, and staff support |
| `/account` | Profile, contact, preferences, workspaces, security, and build information |

## Technology

- Next.js App Router
- React 19
- JavaScript source only
- Tailwind CSS 4
- Framer Motion
- Firebase Authentication, Firestore, Storage, Admin SDK, Analytics and Messaging integration points
- Paynow integration routes
- Resend integration point
- Vercel deployment configuration

## Local setup

Requirements:

- Node.js 22.x
- npm 11 or later

```bash
cp .env.example .env.local
npm ci
npm run dev
```

Open `http://localhost:3000`.

Do not commit `.env.local`, service-account JSON, private keys, payment secrets, or live provider credentials.

## Release validation

```bash
npm test
npm run check:js
npm run lint
npm run build
```

Also validate Firestore and Storage rules with the Firebase Emulator Suite and run authenticated browser smoke tests against the exact staging deployment.

The generation environment could not complete `npm ci` because outbound package downloads repeatedly failed with `EAI_AGAIN`; therefore lint and production build are **not claimed as passed** in this package. See [SPOTLY-VALIDATION-REPORT.md](./SPOTLY-VALIDATION-REPORT.md).

## Release traceability

Set these values for every preview and production deployment:

```env
NEXT_PUBLIC_APP_VERSION=5.1.0-depth-pass
NEXT_PUBLIC_BUILD_COMMIT=<git commit SHA>
NEXT_PUBLIC_BUILD_DATE=<ISO timestamp>
NEXT_PUBLIC_APP_ENV=preview
```

The safe version label appears in authenticated Account and Admin surfaces and can be included in support diagnostics.

## Production dependencies still requiring owner configuration

- Approved launch city, areas, categories, and featured businesses
- Firebase web and Admin credentials
- Firebase Authentication authorized domains and providers
- Production Firestore indexes and rules deployment
- Paynow credentials, callback URLs, settlement and reconciliation procedures
- Resend and push notification configuration
- Support staffing, response targets, escalation ownership and final help content
- Final legal text and consent versions
- Order cancellation/refund workflow that releases inventory and pickup reservations
- Monitoring, backup/restore, incident and rollback procedures

## Documentation

- [SPOTLY-DEPTH-PASS-IMPLEMENTATION-REPORT.md](./SPOTLY-DEPTH-PASS-IMPLEMENTATION-REPORT.md)
- [SPOTLY-CAPABILITY-MATRIX.md](./SPOTLY-CAPABILITY-MATRIX.md)
- [SPOTLY-ROUTE-INVENTORY.md](./SPOTLY-ROUTE-INVENTORY.md)
- [SPOTLY-INTERACTION-INVENTORY.md](./SPOTLY-INTERACTION-INVENTORY.md)
- [SPOTLY-BROWSER-STATE-INVENTORY.md](./SPOTLY-BROWSER-STATE-INVENTORY.md)
- [SPOTLY-VALIDATION-REPORT.md](./SPOTLY-VALIDATION-REPORT.md)
- [SPOTLY-PLATFORM-BLUEPRINT.md](./SPOTLY-PLATFORM-BLUEPRINT.md)
- [FIREBASE-SETUP.md](./FIREBASE-SETUP.md)
- [VERCEL-DEPLOYMENT.md](./VERCEL-DEPLOYMENT.md)

Historical implementation reports are stored under `docs/history/` and must not be treated as current release status.

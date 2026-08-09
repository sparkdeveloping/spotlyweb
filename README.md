# Spotly Web Platform

Spotly is one operating network with five role-specific entrances:

```text
/          Public launch experience and customer marketplace
/business  Merchant and location operations
/driver    Internal driver training until live dispatch is connected
/staff     Spotly workforce
/admin     Platform governance and operational queues
```

This repository is the **5.4 Business Operating System candidate**. It preserves the hardened 5.3 security/commerce and 5.2 semantic-theme work while adding a permanent multi-business portfolio, claims/access centres, explicit business routing, the Spotly Master Product Library, Staff product capture, reviewed AI-assisted product media, and a server-authoritative Business Money ledger/settlement foundation.

## Capability truth

| Area | Current classification |
|---|---|
| Public homepage and waitlist | Pilot-ready UI; launch content and approved businesses require production configuration |
| Customer marketplace | Pilot-ready candidate with real location/branch availability, transactional order creation, and reservation release; production payments and provider reconciliation remain |
| Business claiming | Pilot-ready progressive flow with account drafts and persisted evidence |
| Merchant operations | Business OS candidate with portfolio, multi-business context, catalogue library and Money; exact staging/build verification remains |
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
| `/business` | Business Portfolio; selected-business operations live under explicit `?business=` context |
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
npm run check:js
npm run check:theme
npm test
npm run test:rules
npm run lint
npm run build
```

Also validate Firestore and Storage rules with the Firebase Emulator Suite and run authenticated browser smoke tests against the exact staging deployment.

The generation environment could not complete `npm ci` because its internal npm mirror returned HTTP 404 for `zod-validation-error-4.0.2.tgz`; therefore ESLint, Next.js build, browser screenshots, and runtime accessibility checks are **not claimed as passed**. See [SPOTLY-BUSINESS-VALIDATION-REPORT.md](./SPOTLY-BUSINESS-VALIDATION-REPORT.md).

## Release traceability

Set these values for every preview and production deployment:

```env
NEXT_PUBLIC_APP_VERSION=5.4.0-business-os
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
- Monitoring, backup/restore, incident and rollback procedures

## Documentation

- [SPOTLY-DEPTH-PASS-IMPLEMENTATION-REPORT.md](./SPOTLY-DEPTH-PASS-IMPLEMENTATION-REPORT.md)
- [SPOTLY-CAPABILITY-MATRIX.md](./SPOTLY-CAPABILITY-MATRIX.md)
- [SPOTLY-ROUTE-INVENTORY.md](./SPOTLY-ROUTE-INVENTORY.md)
- [SPOTLY-INTERACTION-INVENTORY.md](./SPOTLY-INTERACTION-INVENTORY.md)
- [SPOTLY-BROWSER-STATE-INVENTORY.md](./SPOTLY-BROWSER-STATE-INVENTORY.md)
- [SPOTLY-THEME-INTEGRITY-IMPLEMENTATION-REPORT.md](./SPOTLY-THEME-INTEGRITY-IMPLEMENTATION-REPORT.md)
- [SPOTLY-ROUTE-THEME-MATRIX.md](./SPOTLY-ROUTE-THEME-MATRIX.md)
- [SPOTLY-TOKEN-INVENTORY.md](./SPOTLY-TOKEN-INVENTORY.md)
- [SPOTLY-FIXED-COLOR-EXCEPTIONS.md](./SPOTLY-FIXED-COLOR-EXCEPTIONS.md)
- [SPOTLY-FORM-MIGRATION-REPORT.md](./SPOTLY-FORM-MIGRATION-REPORT.md)
- [SPOTLY-VISUAL-REGRESSION-REPORT.md](./SPOTLY-VISUAL-REGRESSION-REPORT.md)
- [SPOTLY-FUNCTIONAL-REPAIR-REPORT.md](./SPOTLY-FUNCTIONAL-REPAIR-REPORT.md)
- [SPOTLY-THEME-VALIDATION-REPORT.md](./SPOTLY-THEME-VALIDATION-REPORT.md)
- [SPOTLY-PLATFORM-BLUEPRINT.md](./SPOTLY-PLATFORM-BLUEPRINT.md)
- [FIREBASE-SETUP.md](./FIREBASE-SETUP.md)
- [VERCEL-DEPLOYMENT.md](./VERCEL-DEPLOYMENT.md)

Historical implementation reports are stored under `docs/history/` and must not be treated as current release status.

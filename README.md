# Spotly Web Platform

Spotly is one operating network with five role-specific entrances:

```text
/          Public launch experience and customer marketplace
/business  Merchant and location operations
/driver    Internal driver training until live dispatch is connected
/staff     Spotly workforce
/admin     Platform governance and operational queues
```

This repository is the **5.5 Business Lifecycle Orchestration candidate**. It preserves the hardened 5.3 security/commerce and 5.2 semantic-theme work while retaining the 5.4 multi-business portfolio, Master Product Library and Business Money foundation and adding one five-stage merchant lifecycle, deterministic setup resume, a Launch Checklist, final Spotly launch review, lifecycle-gated navigation, persistent Business shell state, and server-authoritative go-live/suspension controls.

## Capability truth

| Area | Current classification |
|---|---|
| Public homepage and waitlist | Pilot-ready UI; launch content and approved businesses require production configuration |
| Customer marketplace | Pilot-ready candidate with real location/branch availability, transactional order creation, and reservation release; production payments and provider reconciliation remain |
| Business claiming | Pilot-ready progressive flow with account drafts and persisted evidence |
| Merchant operations | Business Lifecycle candidate with portfolio, deterministic basics setup, Launch Checklist, lifecycle-gated preparation and live operations; exact staging/build verification remains |
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
| `/business` | Business Portfolio; preparing businesses open their Launch Checklist and live businesses open Today under explicit `?business=` context |
| `/driver` | Internal training scenarios only |
| `/staff` | Staff agenda, scoped work, learning, leave, pay, assets, and support |
| `/admin` | Urgent operations, queues, health, configuration, and governance |
| `/admin/queues/[queue]` | Exact filtered operational queues |
| `/support` | Context-aware customer, merchant, driver, and staff support |
| `/account` | Profile, contact, preferences, workspaces, security, and build information |


## Business lifecycle

Selected businesses now use one merchant-facing lifecycle:

```text
Verify access → Set up business basics → Prepare for launch → Spotly launch review → Live
```

Before launch, `/business/launch?business=<id>` is the authoritative home. It separates merchant-controlled progress from Spotly reviews, points to the exact next task, and keeps operational pages such as Orders, Insights, Promotions and Kiosk gated until the business is actually live.

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
- npm 10.9 or later

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

The generation environment could not complete `npm ci` because its internal npm mirror returned HTTP 404 for `zod-validation-error-4.0.2.tgz`; therefore ESLint, the Next.js production build, Firebase emulator execution, browser screenshots, and runtime accessibility checks are **not claimed as passed in this environment**. See [SPOTLY-BUSINESS-LIFECYCLE-VALIDATION-REPORT.md](./SPOTLY-BUSINESS-LIFECYCLE-VALIDATION-REPORT.md).

## Release traceability

Set these values for every preview and production deployment:

```env
NEXT_PUBLIC_APP_VERSION=5.5.1-business-lifecycle-hotfix
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

- [SPOTLY-BUSINESS-LIFECYCLE-IMPLEMENTATION-REPORT.md](./SPOTLY-BUSINESS-LIFECYCLE-IMPLEMENTATION-REPORT.md)
- [SPOTLY-BUSINESS-SETUP-RESUME-REPORT.md](./SPOTLY-BUSINESS-SETUP-RESUME-REPORT.md)
- [SPOTLY-BUSINESS-NAVIGATION-ARCHITECTURE-REPORT.md](./SPOTLY-BUSINESS-NAVIGATION-ARCHITECTURE-REPORT.md)
- [SPOTLY-BUSINESS-LAUNCH-CHECKLIST-REPORT.md](./SPOTLY-BUSINESS-LAUNCH-CHECKLIST-REPORT.md)
- [SPOTLY-BUSINESS-LAUNCH-REVIEW-REPORT.md](./SPOTLY-BUSINESS-LAUNCH-REVIEW-REPORT.md)
- [SPOTLY-BUSINESS-LIFECYCLE-ROUTE-INVENTORY.md](./SPOTLY-BUSINESS-LIFECYCLE-ROUTE-INVENTORY.md)
- [SPOTLY-BUSINESS-STATE-VOCABULARY.md](./SPOTLY-BUSINESS-STATE-VOCABULARY.md)
- [SPOTLY-BUSINESS-LIFECYCLE-TEST-REPORT.md](./SPOTLY-BUSINESS-LIFECYCLE-TEST-REPORT.md)
- [SPOTLY-BUSINESS-LIFECYCLE-VALIDATION-REPORT.md](./SPOTLY-BUSINESS-LIFECYCLE-VALIDATION-REPORT.md)
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

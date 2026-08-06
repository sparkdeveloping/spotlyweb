# Spotly Web Platform

Spotly is one operating network with five role-specific entrances:

```text
/          Customer marketplace
/business  Merchant and branch operations
/driver    Delivery and field operations
/staff     Spotly workforce
/admin     Platform governance
```

Version 5 adds the complete Spotly workforce application, expands administrator People Operations and organization governance, and connects every portal to the same identity, permissions, notifications, support, audit, payment, and workflow foundations.

## Included applications

| Route | Purpose |
|---|---|
| `/` | Coming-soon experience, launch waitlist, partnerships, discovery, and business claim entry |
| `/marketplace` | Admin-controlled customer marketplace |
| `/claim` | Search-first business listing and ownership-claim workflow |
| `/business` | Guided merchant setup and adaptive retail, food, events, services, accommodation, and listing operations |
| `/driver` | Driver onboarding, shifts, delivery work, earnings, safety, and fleet operations |
| `/staff` | Spotly employee and contractor Today view, work, hiring, scheduling, leave, learning, performance, pay, assets, support, and profile |
| `/admin` | Platform control centre, organizations, businesses, People Operations, drivers, customers, money, content, support, compliance, configuration, and audit |
| `/admin/platform-map` | Interactive entity/workforce maps and plain-language record diagnostics |
| `/admin/support-view/[businessId]` | Audited, read-only administrator business support context |
| `/support` | Public and authenticated help centre and realtime support |
| `/account` | Shared identity, linked providers, phone, and notification preferences |
| `/devstatus` | Implementation and launch-readiness report |

## Version 5 operating model

### Organization hierarchy

```text
Organization
└── Brand
    ├── Location
    └── Location
```

The organization owns legal identity and consolidated governance. The brand owns the customer-facing identity and shared catalogue. The location owns local hours, staff, availability, inventory, fulfilment, and location-specific operations.

### Workforce separation

```text
/staff            Spotly internal workforce
/business/team    Merchant employees and operators
/driver           Drivers and fleet personnel
```

The three systems share people infrastructure without conflating their employment or membership relationships.

### Staff lifecycle

The `/staff` and `/admin/people` modules support the full relationship:

```text
Workforce request → vacancy → candidate → screening → interview → offer
→ preboarding → first day → probation → active employment → development
→ role change → leave/absence → exit → alumni record
```

Implemented workforce domains include:

- Employee profiles and employment records
- Reusable role packs, permissions, approval limits, and scopes
- Role-adaptive Today queues and operational assignments
- Workforce requests and recruitment pipeline
- Shifts, attendance, exceptions, and scheduling
- Leave requests, coverage, and manager approval
- Training paths, acknowledgements, assessments, and manager sign-off
- Probation, check-ins, goals, feedback, and performance reviews
- Payroll preparation, allowances, deductions, reimbursements, and payslip records
- Asset issue, condition, return, and incident history
- Internal People Operations, technical support, policy, and concern channels
- Offboarding, access revocation, ownership transfer, and audit history

## Technology

- Next.js App Router
- JavaScript only; no TypeScript source
- React 19
- Tailwind CSS 4
- Framer Motion
- Firebase Authentication
- Cloud Firestore
- Cloud Storage
- Firebase Analytics and Messaging integration points
- Firebase App Check integration point
- Firebase Admin SDK in protected route handlers
- Paynow Node SDK
- Resend REST integration
- Vercel deployment configuration

## Start locally

Requirements: Node.js 22 and npm 11 or later.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`.

Private Firebase Admin, Paynow, Resend, App Check, Web Push, and bootstrap values must be supplied by the project owner. Never commit `.env.local`, service-account JSON, or private keys.

## Validation

Run the complete local release gate:

```bash
npm run check
```

This executes the JavaScript-only source check, ESLint, and a production Next.js build. Also test Firestore and Storage rules using the Firebase Emulator Suite before production deployment.

## First administrator

1. Add the first administrator email to the server-only allowlist:

```env
BOOTSTRAP_ADMIN_EMAILS=founder@example.com
```

2. Add valid Firebase Admin credentials.
3. Deploy or restart the application.
4. Create a Spotly account using that email and password.
5. Open `/admin` and request the one-time super-administrator bootstrap.
6. Assign later platform roles from **Admin → People**.
7. Remove `BOOTSTRAP_ADMIN_EMAILS` after confirming access.

## Firebase data and security

Production drafts are included:

- `firestore.rules`
- `storage.rules`
- `firestore.indexes.json`

Development-only open rules are also included:

- `firestore.test.rules`
- `storage.test.rules`

Do not deploy the test rules publicly.

Version 5 introduces protected workforce collections for profiles, tasks, shifts, leave, training, performance, payroll, assets, workforce requests, candidates, and internal support. Access is resolved through employment or membership, role pack, permission set, scope, approval limits, and temporary exceptions.

## Directory and starter data

The project includes provisional Zimbabwe business and location starter data. Directory records remain unverified until Spotly reviews identity, location details, ownership evidence, media rights, catalogue accuracy, and source attribution.

After deploying to a backup or non-production environment first, open `/admin/businesses` and run the directory upgrade/refresh flow. Review organizations, brands, locations, memberships, claims, and archived legacy branch-as-business records before production use.

A command-line seed is also available:

```bash
npm run seed
```

It requires Firebase Admin environment variables.

## Adaptive business operations

Business setup is staged and resumable. Navigation and terminology adapt to the selected operating model:

- Grocery and retail
- Restaurant and prepared food
- Events and ticketing
- Services and appointments
- Accommodation and activities
- Public listing and enquiries

Branch access is location-scoped. Parent-company policy can centrally control, accept suggestions, auto-approve changes, or delegate full control for each operational field.

## Driver operations

The driver portal supports Spotly-employed drivers, independent drivers, business-employed drivers, fleet partners, and dispatchers. The operational model covers onboarding, document review, shifts, job offers, pickup verification, delivery proof, failed-delivery recovery, cash handling, expenses, earnings, incidents, training, and fleet visibility.

## Marketplace and payments

Marketplace availability is controlled through platform settings and private-beta access. The first transaction focus remains grocery pickup, with architecture for products, food pickup, appointments, tickets, accommodation, activities, and enquiries.

Paynow integration is handled by protected route handlers:

- `/api/payments/paynow/initiate`
- `/api/payments/paynow/status`
- `/api/payments/paynow/result`

The server re-reads orders and validates amounts rather than trusting browser totals. No real payment should be enabled until credentials, callbacks, settlement details, reconciliation, and commercial policies are configured and tested.

## Supporting documentation

- [SPOTLY-PLATFORM-BLUEPRINT.md](./SPOTLY-PLATFORM-BLUEPRINT.md)
- [RELEASE-NOTES-PLATFORM-V5.md](./RELEASE-NOTES-PLATFORM-V5.md)
- [BUILD-REPORT.md](./BUILD-REPORT.md)
- [FIREBASE-SETUP.md](./FIREBASE-SETUP.md)
- [VERCEL-DEPLOYMENT.md](./VERCEL-DEPLOYMENT.md)
- [UX-ARCHITECTURE.md](./UX-ARCHITECTURE.md)
- [BUSINESS-OPERATIONS.md](./BUSINESS-OPERATIONS.md)
- [ADMIN-DIRECTORY.md](./ADMIN-DIRECTORY.md)

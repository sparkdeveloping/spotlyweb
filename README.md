# Spotly Web Platform

Spotly is a JavaScript-only Next.js platform for Zimbabwean business discovery, guided merchant onboarding, adaptive business operations, and grocery pickup. Version 4 upgrades the existing Firebase-backed project with a correct organization-to-brand-to-location hierarchy, step-by-step business setup, business-type-specific workspaces, kiosk modes, synchronized customer/admin experiences, support, notifications, and payment architecture while preserving the dormant driver portal for a future delivery phase.

## Included applications

| Route | Purpose |
|---|---|
| `/` | Light-mode coming-soon website, launch waitlist, partnerships, and business-claim entry point |
| `/marketplace` | Admin-controlled public/private-beta customer marketplace |
| `/claim` | Search-first business listing and ownership-claim flow |
| `/business` | Guided business setup and adaptive operations for retail, food, ticketing, appointments, accommodation/activities, and profile businesses |
| `/admin` | Platform controls, claims, businesses, access, finance, content, support, seed data, settings, and audit |
| `/admin/support-view/[businessId]` | Audited, read-only administrator support context |
| `/support` | Public and authenticated help centre and realtime support chat |
| `/account` | Shared Spotly identity, linked providers, phone, and browser notifications |
| `/devstatus` | Client-facing implementation and launch-readiness report |
| `/driver` | Preserved but intentionally dormant driver experience |

## Technology

- Next.js App Router
- JavaScript only; no TypeScript
- React
- Tailwind CSS
- Framer Motion
- Firebase Authentication
- Cloud Firestore
- Cloud Storage
- Firebase Analytics
- Firebase Cloud Messaging
- Firebase App Check integration point
- Firebase Admin SDK in protected Next.js route handlers
- Paynow Node SDK
- Resend REST API integration
- Vercel deployment configuration

## Start locally

Requirements: Node.js 22 and npm 11 or later.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`.

The Firebase Web configuration supplied for `denzeltinashe-spotly` is already present as a public fallback and in `.env.example`. Server-side Firebase Admin, Paynow, Resend, App Check, Web Push, and bootstrap values must be added by the project owner.

## First administrator

1. Add the first administrator email to the server-only allowlist:

```env
BOOTSTRAP_ADMIN_EMAILS=founder@example.com
```

2. Add valid Firebase Admin credentials.
3. Deploy or restart the application.
4. Create a Spotly account using that email and password.
5. Open `/admin` and choose **Request one-time super-admin bootstrap**.
6. After the first super administrator exists, further access should be assigned from **Admin → People & access**.
7. Remove `BOOTSTRAP_ADMIN_EMAILS` after confirming administrative access.

The actual role assignment is performed by a protected server route. The allowlist is never exposed through a `NEXT_PUBLIC_` variable.

## Firebase setup

See [FIREBASE-SETUP.md](./FIREBASE-SETUP.md) for the complete console checklist.

Development test-mode files are included:

- `firestore.test.rules`
- `storage.test.rules`

Production drafts are also included:

- `firestore.rules`
- `storage.rules`
- `firestore.indexes.json`

Do not deploy open test rules to a public production project. Test the production drafts with the Firebase Emulator Suite and role-specific regression tests first.

## Directory and starter data

The project includes 347 provisional Zimbabwe locations representing 125 real business brands across multiple cities and categories. Directory version 4 stores one business-brand record per brand and its exact locations separately in Firestore. These records are designed to reduce onboarding friction by allowing owners to find and claim an existing profile.

They are not automatically verified. Before publication or commercial use, Spotly must review:

- Correct legal/business identity
- Current branch location and contact details
- Ownership and claim evidence
- Logos and image usage rights
- Catalogue, price, inventory, and opening-hour accuracy
- Source attribution and removal/correction requests

After deploying version 4, open **Admin → Businesses** (`/admin/businesses`) and use **Upgrade / refresh directory**. This is a required migration action: the protected route creates business brands, exact locations, organizations, role templates, help resources, and catalogue templates; archives legacy branch-as-business duplicates; and migrates related memberships and claims where possible. Claim search and public directory search intentionally use Firebase only and do not fall back to browser-local records.

A command-line seed is also available:

```bash
npm run seed
```

This requires Firebase Admin environment variables in the local shell.


## Adaptive business experience release

This archive includes Spotly Business Experience v4. See:

- [UX-ARCHITECTURE.md](./UX-ARCHITECTURE.md) for the product and interaction model.
- [BUSINESS-OPERATIONS.md](./BUSINESS-OPERATIONS.md) for operational workflows.
- [ADMIN-DIRECTORY.md](./ADMIN-DIRECTORY.md) for Firestore population and administrator operations.
- [RELEASE-NOTES-BUSINESS-V4.md](./RELEASE-NOTES-BUSINESS-V4.md) for the complete release summary.

## Authentication model

Email and password are the mandatory primary credential. Google, Apple, and phone are linked to the existing account rather than creating separate Spotly identities.

Supported flows:

- Email/password registration and sign-in
- Email verification request
- Password reset
- Google provider linking
- Apple provider linking
- Phone-number linking
- Anonymous session for public support and browsing
- Shared account across customer, business, and admin portals

Google, Apple, Phone, Anonymous, and Email/Password must be enabled in Firebase Console. Apple requires its own Apple Developer and OAuth configuration. Phone authentication requires billing/quota readiness and authorized deployment domains.

## Adaptive business portal

Business setup is a resumable, staged flow. Before setup is complete, the portal exposes only setup, home, support, and account/access. After setup, navigation and terminology adapt to the selected model:

- shop/grocery retail
- restaurant/café/food
- events and ticketing
- appointments and services
- accommodation and activities
- public profile and enquiries

Business brands and exact locations are selected separately. Location-scoped staff see only assigned locations. Full-screen processing and completion states are used for important operations. Kiosk modes support pickup arrival, ticket admission, and appointment/guest arrival.

## Marketplace and grocery pickup

The public root remains a coming-soon experience by default. The customer marketplace is controlled through Firestore platform settings and private-beta access.

Implemented marketplace architecture includes:

- Real/provisional business directory
- Business search and categories
- Business and branch context
- Product catalogue listeners
- Favorites
- Pickup cart
- Currency selection for USD and ZiG
- Pickup contact, date, slot, notes, and substitution preference
- Server-calculated order totals
- Cash, bank transfer, Paynow, EcoCash, OneMoney, and card configuration
- Customer order history
- Payment initiation and recovery
- Helpful empty and unavailable states

The first transaction focus is grocery pickup. Driver delivery is intentionally not a release dependency.

## Payments

Paynow integration is handled by protected Next.js route handlers:

- `/api/payments/paynow/initiate`
- `/api/payments/paynow/status`
- `/api/payments/paynow/result`

The server re-reads the order and validates the amount rather than trusting totals from the browser. Separate USD and ZiG Paynow integration values can be configured, or one shared integration can be used.

No real payment can be processed until valid Paynow credentials, return/result URLs, merchant settlement details, and approved commercial policies are configured and tested.

## Support and notifications

The support system includes:

- Public anonymous chat
- Customer and business chat
- Realtime messages
- Admin support queue
- Assignment and statuses
- Internal notes
- Escalation-ready metadata
- Help resources and unlisted YouTube video IDs
- Audited administrator business support view

Notifications include:

- In-app notification documents
- Browser push token registration
- Firebase Cloud Messaging server route
- Notification preferences
- Background service worker
- Transactional email route using Resend

External credentials and verified sender/domain configuration are required.

## Vercel deployment

See [VERCEL-DEPLOYMENT.md](./VERCEL-DEPLOYMENT.md).

The minimum sequence is:

```bash
npm install
npm run check:js
npm run lint
npm run build
```

Then import the repository into Vercel, add all required environment variables, deploy, add the Vercel domains to Firebase Authentication authorized domains, and verify every route and integration in Preview before promoting Production.

## Project validation

This generated archive was validated for:

- JavaScript syntax across application, component, library, data, and script files
- Absence of TypeScript source files
- JSON parse validity
- Local alias import resolution
- Firebase configuration files and route structure
- No OpenAI internal npm-registry URLs

JavaScript validation and ESLint completed successfully. A production Next.js build could not complete in the Linux generation container because the matching Next.js SWC binary could not be downloaded through its restricted package gateway. Run `npm install && npm run check` locally and in Vercel Preview before release. See [BUILD-REPORT.md](./BUILD-REPORT.md).

## Production boundaries

This is a substantial integrated beta foundation, not a claim that external systems have been configured or certified. Public production release still requires:

- Firebase provider and domain configuration
- Firebase Admin credentials
- Tested production Firestore and Storage rules
- App Check and Web Push configuration
- Paynow sandbox and live verification
- Resend and sending-domain verification
- Approved legal entity and policy documents
- Verified business and catalogue data
- Merchant and customer pilot
- Role, security, privacy, accessibility, performance, backup, restore, monitoring, reconciliation, and incident-response testing

The `/devstatus` page presents these boundaries to the client in the application itself.

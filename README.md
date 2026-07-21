# Spotly Unified Web Platform

A single production-oriented Next.js web project for the four Spotly products:

- `/` — Spotly Customer
- `/business` — Spotly Business
- `/driver` — Spotly Driver
- `/admin` — Spotly Admin

The project is JavaScript-only. It uses the App Router, Tailwind CSS, Framer Motion, Lucide icons, optional Firebase connectivity, responsive layouts, dark mode, accessible controls, and the four approved Spotly icons supplied with the source apps.

## Technology

- Next.js 16
- React 19
- Tailwind CSS 4
- Framer Motion 12
- JavaScript, not TypeScript
- Optional Firebase Auth, Firestore, and Storage
- Zod validation for server endpoints

## Included product areas

### Customer

Discovery home, category browsing, live search, filters, place details, saved places, bookings/orders, event tickets, account settings, app-family switching, responsive desktop and mobile navigation.

### Business

Dashboard, operational order queue, reservations, order status actions, catalog CRUD demo, insights and charts, promotions, staff invitations, finance and payouts, business configuration, capability toggles, app-family navigation.

### Driver

Availability state, live job offers, accept/decline flow, active delivery timeline, route panel, delivery progress actions, earnings, payout history, job history, safety/support, verification and driver profile.

### Admin

Platform dashboard, critical incident queue, resolution workflow with reason capture, orders, business and driver verification decisions, customers, finance, categories/cities, platform service health, audit history, role/security settings.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Production build

```bash
npm run check
npm start
```

Node.js 20.9 or newer is required.

## Environment configuration

The app runs immediately with high-fidelity local demo data. For a live backend, copy `.env.example` to `.env.local` and add the Firebase web app values:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

`lib/firebase.js` initializes Auth, Firestore, and Storage only when the required values exist. Replace the in-memory state used by the portal components with repository functions that read and write your production collections. This separation lets the complete interface run before credentials are added without embedding secrets.

For the optional lead endpoint, configure:

```env
LEAD_WEBHOOK_URL=https://your-secure-server.example/spotly-leads
```

## Routes

```text
/
/login
/business
/business/activity
/business/catalog
/business/insights
/business/promotions
/business/staff
/business/finance
/business/settings
/driver
/driver/jobs
/driver/active
/driver/earnings
/driver/history
/driver/support
/driver/profile
/admin
/admin/operations
/admin/businesses
/admin/drivers
/admin/customers
/admin/finance
/admin/content
/admin/platform
/admin/audit
/admin/settings
/api/health
/api/lead
```

## Design-system mapping

The web implementation follows the design contracts in the uploaded SwiftUI projects:

- Shared neutral surfaces, borders, semantic status colors, 16px card radius, 20px hero radius, 52px primary controls, 44px minimum interaction targets.
- Customer violet: `#6657D9`
- Business green: `#147A4A`
- Driver cobalt: `#2563EB`
- Admin navy: `#28466F`
- Dark mode uses semantic surfaces rather than tinted light colors.
- Product accent never replaces success, warning, error, or information colors.

## Production hardening checklist

The project already includes security response headers, strict input validation for the included POST endpoint, a health endpoint, metadata, sitemap, robots, web manifest, error/loading states, responsive navigation, reduced-motion support, and no embedded credentials.

Before a public launch:

1. Connect Firebase repositories and remove any demo-only data source from authenticated production sessions.
2. Enforce Firebase custom claims for Business, Driver, and Admin routes on the server, not only in the UI.
3. Require MFA for Admin and privileged Business roles.
4. Add App Check, rate limits, abuse controls, and server-side authorization for every mutation.
5. Connect payment, dispatch, maps, messaging, and notification providers through server-side APIs.
6. Add Playwright end-to-end tests for sign-in, order flow, driver flow, incident handling, and permissions.
7. Add structured logging, error monitoring, analytics consent, backups, and data retention policies.
8. Replace remote demo photography with approved/licensed Spotly media or your CDN.

## Source structure

```text
app/                 Next.js routes, metadata, APIs, error states
components/          Shared shell, UI components, charts, and four portals
data/                 Demo/domain data adapted from the uploaded Swift projects
lib/                  Formatting, class helpers, optional Firebase client
public/brand/         Approved Spotly family app icons
```
# spotlyweb

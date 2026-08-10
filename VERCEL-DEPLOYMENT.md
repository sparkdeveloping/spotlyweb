# Vercel deployment

## Required runtime

- Node.js 22.x
- npm 11 or later

Use a committed lock file and install with:

```bash
npm ci
npm test
npm run check:js
npm run lint
npm run build
```

Do not promote a deployment when any command fails.

## Import into Vercel

- Framework preset: Next.js
- Node.js: 22.x
- Install command: `npm ci`
- Build command: `npm run build`
- Output: automatic Next.js output

## Release metadata

Set for Preview and Production:

```env
NEXT_PUBLIC_APP_URL=https://<deployment-domain>
NEXT_PUBLIC_APP_ENV=preview
NEXT_PUBLIC_APP_VERSION=5.2.0-theme-integrity
NEXT_PUBLIC_BUILD_COMMIT=<git commit SHA>
NEXT_PUBLIC_BUILD_DATE=<ISO-8601 timestamp>
```

Use `NEXT_PUBLIC_APP_ENV=production` only after the exact Preview build has passed acceptance testing.

## Environment variables

Configure the Firebase Web and Firebase Admin variables from `.env.example` using Vercel secret storage. Add Paynow, Resend, push and lead-webhook values only when those integrations are actively tested.

Never put a private key, Paynow secret, service-account credential or server token in a `NEXT_PUBLIC_` variable.

## Firebase preparation

1. Add Preview and Production domains to Firebase Authentication authorized domains.
2. Configure provider redirect URLs.
3. Deploy required composite indexes.
4. Validate Firestore and Storage rules in the Emulator Suite.
5. Deploy rules only after the emulator test matrix passes.
6. Confirm Storage CORS and upload policies for claim and support attachments.

## Preview smoke test

Test the exact build ID shown in Account/Admin:

- `/`
- `/login`
- `/marketplace`
- `/claim`
- `/claim/drafts`
- one `/claim/status/[claimId]`
- `/business`
- `/drive` public Driver acquisition
- `/driver` live Driver application/operations
- `/staff`
- `/admin`
- one `/admin/queues/[queue]`
- `/support`
- `/account`
- `/payment/return`

Verify:

- Waitlist submit, edit and reset
- Keyboard business finder
- Customer location changes results
- User/session-scoped cart and logout cleanup
- Branch-derived pickup slots and capacity rejection
- Order idempotency
- Claim save/resume and evidence persistence
- Mobile merchant order cards
- Driver application save/resume, review state, online/location state and live delivery progression
- Driver offer accept/decline, pickup verification, handoff PIN and earnings refresh
- Business delivery configuration and dedicated kiosk device enrollment
- Staff task deep link and learning progress
- Admin exact queue filters, assignment and decisions
- Support attachments, close/reopen and satisfaction
- Keyboard focus for all overlays
- Browser console and network failures
- 320px reflow and zoom

## Production promotion

Before promotion:

1. Confirm the Preview commit SHA matches the candidate.
2. Configure approved launch content and businesses.
3. Confirm payment methods and currencies per location.
4. Complete Paynow sandbox and reconciliation tests.
5. Configure email/push notification delivery and preference enforcement.
6. Staff support and escalation ownership.
7. Approve legal content.
8. Test cancellation/refund reservation release.
9. Confirm backups, monitoring and rollback.

## Rollback

1. Pause ordering or publication through platform configuration where possible.
2. Promote the last known-good Vercel deployment.
3. Restore the matching rules/indexes when required.
4. Reconcile orders, reservations and provider payments created during the incident window.
5. Record the incident, affected records, remediation and re-open decision.

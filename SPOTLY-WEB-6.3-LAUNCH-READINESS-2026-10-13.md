# Spotly Web 6.3 — Launch Readiness & Cross-Role Remediation

This release freezes major feature development and strengthens launch controls across Customer, Business, Driver, Admin, Staff, payments, Firebase, Ride, Send, support, and public traffic.

## Remediation completed

- Added a root-level production error boundary so catastrophic render failures do not expose a blank screen.
- Added a persistent offline banner with accessible live-region messaging across the platform.
- Protected public lead intake with distributed Firestore-backed rate limiting and Firebase App Check participation.
- Added App Check participation to public geocoding while retaining public read behavior when enforcement is disabled.
- Expanded Admin Launch Readiness with hard gates for Firebase Admin credentials, Storage, production origin, finance encryption, Ride/Send dispatch authentication, launch geography, marketplace indexing, and post-bootstrap administrator lock-down.
- Added a static launch audit covering all API routes, privileged namespace authentication, internal cron authentication, public API rate limiting/App Check, payment callback validation, security headers, Ride/Send rules, storage proof rules, and Vercel dispatch schedules.
- Added 6.3 launch-readiness regression tests.

## Operational release gates

Do not enable Ride or Send until Admin Launch Readiness shows no blocked gates and the following have been verified in the deployed production environment:

1. Firebase Admin credentials and Storage bucket.
2. Firestore and Storage rules deployed and emulator-tested.
3. `NEXT_PUBLIC_APP_URL=https://spotlyafrica.com`.
4. `NEXT_PUBLIC_MARKETPLACE_INDEXABLE=true` only for the public production release.
5. `SPOTLY_FINANCE_ENCRYPTION_KEY` configured.
6. Strong `CRON_SECRET` configured when Ride or Send is enabled.
7. Explicit launch cities/areas for Ride and Send.
8. Paynow production credentials and a live low-value payment test.
9. Transactional email and push credentials where enabled.
10. App Check enforcement enabled after verifying production clients send valid tokens.
11. Monitoring alert test completed.
12. Backup restore test completed.
13. Legal identity, privacy, terms, refund/cancellation policy, and staffed support channels configured.
14. Remove `BOOTSTRAP_ADMIN_EMAILS` after the initial super administrator is established.

## Required live smoke tests

- Customer: Eat/Shop order -> Business -> Driver delivery -> payment -> Activity.
- Customer: Book -> reservation -> Business -> cancellation/release.
- Customer: Event -> ticket -> Paynow -> Activity.
- Ride: quote -> request -> Driver offer -> pickup PIN -> trip -> completion -> earnings -> rating.
- Send: quote -> request -> Driver offer -> pickup PIN -> recipient PIN -> proof -> completion -> earnings.
- Admin: observe and intervene in each live lifecycle without direct Firestore browser authority.
- Staff: support conversation, escalation, and scoped access.
- Business: onboarding, launch review, catalogue, order/booking handling, Money.
- Failure tests: expired auth, poor network, payment failure, duplicate submit, stale Driver location, Driver double-claim, sold-out capacity, cancellation during each allowed state.

## Release posture

6.3 is a release-hardening build, not a declaration that external infrastructure has been verified. The Admin Launch Readiness screen intentionally distinguishes configured, blocked, and needs-verification states. Production enablement should happen only after those external checks are completed on the deployed environment.

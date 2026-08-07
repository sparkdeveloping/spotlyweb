# Spotly 5.3 Launch Readiness Checklist

The Admin Platform screen now contains a live `Pilot launch gates` checklist sourced from `/api/admin/launch-readiness`. It distinguishes Ready, Not configured, Needs verification and Blocked rather than treating a toggle or environment variable as proof.

## Source-complete gates
- Scoped authorization architecture implemented.
- Invitation grant hardening implemented.
- Trusted audit/order events server-only.
- Public marketplace query predicates aligned in source.
- Paynow immutable-total charge implemented.
- Payment initiation idempotency lock implemented.
- Monotonic payment transition model implemented.
- Callback replay ledger implemented.
- Actor-specific terminal order actions implemented.
- Reservation release idempotency implemented.
- Manual full-refund workflow implemented.
- Server-controlled payouts implemented.
- Server/rate-limited support and public forms implemented.
- Optional API App Check enforcement implemented.
- CSP report-only policy implemented.
- Health/build metadata centralized.
- Staff timer-based readiness removed.
- Admin detailed queues use cursor-backed server pagination.

## Must still be verified externally before transactional pilot
- Firestore rules emulator matrix passes.
- Storage rules emulator matrix passes.
- Production `npm ci`, lint and build pass.
- Exact candidate deployed to protected staging.
- Light/dark/mobile/accessibility browser matrix passes.
- Paynow production/sandbox amount, replay and delayed-callback tests pass.
- Refund/reconciliation operating procedure is staffed.
- App Check enabled in Firebase and `SPOTLY_ENFORCE_APP_CHECK=true` only after clients are verified.
- Email/push providers verified if enabled.
- Support contact and stated hours are actually staffed.
- Legal identity/contact values configured.
- Final refund/cancellation policy configured and externally reviewed.
- Monitoring/alert delivery verified.
- Backup restore test completed and documented.
- Support attachment malware scanning/quarantine added before broad file-upload exposure.

## Recommended pilot scope after all blocking verification
- One city/area
- 3–5 manually verified businesses
- Retail/grocery + prepared food only
- Pickup only
- Invite-only customers
- One primary payment method initially
- Staffed support window
- Daily payment/reconciliation review
- Driver remains Training-only

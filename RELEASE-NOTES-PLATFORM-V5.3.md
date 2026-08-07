# Spotly Platform 5.3 — Pilot Readiness

Spotly 5.3 is a security and commerce-integrity pass built on the 5.2 semantic theme foundation.

Major changes:
- Scoped Firestore/Storage business authorization.
- Server-only membership/invitation/trusted event mutation.
- Hardened invitation acceptance.
- Public marketplace query/rule alignment.
- Server-controlled privileged user access, payouts and support writes.
- Public-form/support rate limiting.
- Optional Firebase App Check API enforcement.
- Immutable Paynow order-total charging.
- Payment initiation locks and callback replay ledger.
- Monotonic payment state machine and reconciliation issues.
- Actor-specific customer/merchant/admin/provider order terminal actions.
- Transactional idempotent reservation release.
- Explicit manual full-refund workflow.
- Cursor-backed admin queue API.
- Admin pilot launch-gate checklist.
- Remaining dark-mode named-color regressions removed and theme scanner expanded.
- Health endpoint aligned to build metadata.
- CSP introduced in report-only mode.

The candidate is not declared production-ready until Firebase emulator tests, dependency installation, lint, Next production build, staging browser QA and provider verification pass in an environment with the required tooling.

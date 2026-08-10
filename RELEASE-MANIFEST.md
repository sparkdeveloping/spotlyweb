# Spotly Platform 5.5.3 release manifest

Generated: August 10, 2026
Project: `spotly-web-platform`
Version: `5.5.3`
Release: Business Lifecycle Consistency Full Fix

## Release contents

- One authoritative five-stage Business lifecycle: Access → Basics → Prepare → Final review → Live.
- Server-authoritative selected-business lifecycle endpoint with no client readiness fallback.
- Portfolio/selected-business lifecycle synchronization using one public lifecycle snapshot shape.
- Canonical primary Business location established by Stage-2 setup through the trusted branch API.
- Branch normalization that never trusts first-array ordering for lifecycle readiness.
- Foundational setup completion separated from current launch-readiness health.
- Stage-3 preparation navigation preserved when a later launch requirement needs attention.
- Correct Business Basics progress: Review is confirmation, not a percentage unit.
- Review blocker aggregation instead of silent multi-step bounce-back.
- Protected settlement-account status included in authoritative lifecycle evaluation.
- Structured final launch-review 422 blockers and visible merchant Fix actions.
- Duplicate launch-submit protection in both client and server layers.
- Trusted direct-owner access parity between Portfolio and selected-business APIs.
- Explicit no-store lifecycle/Portfolio API behavior.
- Existing security, commerce integrity, Master Product Library, Staff capture, AI media and Business Money functionality preserved.

## Validation completed here

- `npm run check:js` passed.
- `npm run check:theme` passed: 123 source files / 23 classified route patterns.
- `npm test` passed: 102/102.
- Modified non-JSX server/library/test modules passed `node --check`.
- JSON and SVG parsing passed.

## Validation blocked by environment

The internal npm registry returns HTTP 404 for `zod-validation-error-4.0.2.tgz` and `firebase-tools`. Dependency installation cannot complete, so ESLint, Next.js production build and Firebase emulator execution cannot be claimed as passed in this environment. See `SPOTLY-5.5.3-VALIDATION-REPORT.md`.

## Archive exclusions

- `.git`
- `.next`
- `node_modules`
- runtime `.env` files and real secrets
- logs/temp/OS metadata

`.env.example` is included because it contains placeholders only.

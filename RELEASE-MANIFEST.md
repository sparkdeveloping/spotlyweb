# Spotly Platform 5.5 release manifest

Generated: August 9, 2026
Project: `spotly-web-platform`
Version: `5.5.0`
Release: Business Lifecycle Orchestration candidate

## Release contents

- One authoritative five-stage Business lifecycle: Access → Basics → Prepare → Final review → Live
- `/business/launch?business=<id>` Launch Checklist as the pre-live selected-business home
- Completion-based foundational setup progress and deterministic next-incomplete-step resume
- URL-addressable setup steps through `step=`
- Merchant-controlled progress separated from Spotly-owned reviews
- Exact next-action routing into Business details, Products, Locations, Money and other launch requirements
- Lifecycle-gated Business navigation and locked-feature explanations
- Persistent `/business` provider/shell architecture to remove sidebar collapse during section navigation
- Canonical Business URL helper preserving explicit `business=<id>` deep-link context
- Server-authoritative final launch-review submission and Admin decision workflow
- Live-business re-review policy for launch-critical edits without reopening foundational onboarding
- Trusted business suspension/resume controls
- Trusted branch structural API and hardened public customer-live gates
- Existing 5.4 Portfolio, claims/access, Master Product Library, Staff capture, AI media and Business Money preserved
- Updated Firestore rules and emulator test matrix

## Validation completed here

- `npm run check:js` passed
- `npm run check:theme` passed
- `npm test` passed: 85/85
- All `app/api/**/route.js` files passed `node --check`
- JSON and SVG parsing passed

## Validation blocked by environment

The internal npm registry returns HTTP 404 for `zod-validation-error-4.0.2.tgz` and `firebase-tools`. Dependency installation cannot complete, so ESLint, Next.js production build and Firebase emulator execution cannot be claimed as passed in this environment. See `SPOTLY-BUSINESS-LIFECYCLE-VALIDATION-REPORT.md`.

## Archive exclusions

- `.git`
- `.next`
- `node_modules`
- runtime `.env` files and real secrets
- logs/temp/OS metadata

`.env.example` is included because it contains placeholders only.

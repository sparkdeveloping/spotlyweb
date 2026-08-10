# Spotly Business Lifecycle 5.5.3 — Consistency Full Fix

Generated: August 10, 2026

## Fixed

- Removed selected-business client lifecycle guessing; selected lifecycle now comes from the authoritative server lifecycle API.
- Unified Portfolio, Launch Checklist, sidebar gating, locked-feature blockers and final launch submission around the same lifecycle snapshot semantics.
- Canonicalized the setup location into a real primary branch/location relationship instead of relying on branch array order.
- Prevented a completed foundational Business setup from collapsing back into Stage 2 when a later launch requirement becomes invalid.
- Corrected Business Basics progress so Review is confirmation rather than a percentage unit.
- Allowed Review to aggregate current blockers instead of silently bouncing the merchant several steps backward.
- Added protected settlement state to the authoritative lifecycle loader so Money readiness is consistent across Portfolio and selected Business.
- Added no-store behavior to lifecycle/Portfolio API responses to reduce stale-state divergence.
- Added structured 422 blockers and authoritative lifecycle data to final launch-review rejection responses.
- Added visible launch-submit blocker feedback and precise Fix actions in the Launch Checklist.
- Added synchronous client submission locking on top of server duplicate-review transaction protection.
- Aligned trusted direct-owner access between Portfolio discovery and selected-business APIs.
- Added regression coverage for the exact state-divergence scenarios observed in production screenshots.

## Validation in this environment

- `npm run check:js`: PASS
- `npm run check:theme`: PASS — 123 source files / 23 classified route patterns
- `npm test`: PASS — 102/102
- Modified non-JSX server/test modules: PASS `node --check`
- JSON parsing: PASS — 7 files
- SVG parsing: PASS — 5 files

Dependency installation is blocked by the execution environment's internal npm registry returning HTTP 404 for `zod-validation-error-4.0.2.tgz`; therefore ESLint and Next.js production build cannot be claimed as passed here. The Firebase emulator command is also blocked because the same registry cannot retrieve `firebase-tools`.

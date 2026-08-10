# Spotly Theme-Integrity Validation Report

**Candidate:** 5.2 theme-integrity pass
**Date:** 6 August 2026

## Commands completed

| Command/check | Result |
|---|---|
| `node scripts/check-javascript.mjs` | Passed |
| `node scripts/theme-safety.mjs` | Passed: 86 application/component source files and 23 route patterns |
| `npm test` | Passed: 18 tests, 0 failed |
| TypeScript parser-transpile validation | Passed: 120 JavaScript-family files |
| Local import resolution | Passed: 120 JavaScript-family files |
| JSON parse validation | Passed: 6 files |
| SVG parse validation | Passed: 5 files |
| Legacy `.input` scan | 0 occurrences |
| `bg-white` scan | 0 occurrences |
| Fixed gray/slate adaptive utility scan | 0 occurrences |
| Malformed semantic utility scan | 0 occurrences |

## Test coverage completed

- Account/session-scoped browser state
- Logout state cleanup
- Light and dark semantic text contrast
- Light and dark control/focus contrast
- Business/Driver/Admin accent foreground contrast
- Pickup availability from branch hours
- Fully booked slot exclusion
- Paused location behavior
- Reservation quantity safety
- Idempotent pickup-slot release math
- Required semantic tokens
- Legacy form class absence
- Fixed-white adaptive surface absence
- Paired primary button foreground/background
- Pre-hydration and resolved system theme
- Access-record workspace detection
- Explicit workspace settings destinations

## Dependency-install failure

`npm ci --ignore-scripts` did not complete.

Environment:

- Node: `v22.16.0`
- npm: `10.9.2`
- Package requirement: Node 22.x, npm >=11

Exact blocking error:

```text
npm error code E404
npm error 404 Not Found - GET https://packages.applied-caas-gateway1.internal.api.openai.org/artifactory/api/npm/npm-public/zod-validation-error/-/zod-validation-error-4.0.2.tgz
```

## Not claimed as passed

- `npm run lint`
- `npm run build`
- `npm run start`
- Browser smoke tests
- Automated screenshot regression
- Runtime console/hydration review
- NVDA or VoiceOver testing
- 200%/400% zoom review
- 320px real-browser reflow
- Forced-colors manual review
- Firebase Emulator concurrency/rules tests

## Required commands in a normal environment

```bash
npm ci
npm run check:js
npm run check:theme
npm test
npm run lint
npm run build
npm run start
```

Then run the staging visual matrix in `SPOTLY-VISUAL-REGRESSION-REPORT.md`.

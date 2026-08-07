# Spotly 5.3 Runtime Validation Report

## Environment
- Node: v22.16.0
- npm: 10.9.2
- Repository requires Node 22.x and npm >=11.

## Passed
```text
npm run check:js
JavaScript-only check passed.

npm run check:theme
Theme safety check passed for 100 source files and 23 classified route patterns.

npm test
39 tests passed, 0 failed.
```

The 39 tests include scoped browser state, contrast/token checks, pickup availability, reservation release arithmetic/idempotency, authorization static assertions, public query predicates, server-only trusted writes, invitation hardening, payment monotonicity, callback replay keys, authoritative Paynow total, payment initiation locking, manual refund constraints, App Check wiring, support/payout/user-access server authority, and launch-readiness verification semantics.

## Firebase rules emulator — prepared, blocked here
Command:
```bash
npm run test:rules
```
Result: **not executed** because the environment cannot install `firebase-tools`:
```text
404 Not Found .../firebase-tools
'firebase-tools@*' is not in this registry.
```
The matrix is implemented in `tests/emulator/rules-emulator.mjs` and must run in a normal Firebase CLI environment.

## Dependency installation — blocked here
```bash
npm ci --ignore-scripts --no-audit --no-fund
```
failed because:
```text
npm 10.9.2 does not meet npm >=11
404 Not Found .../zod-validation-error-4.0.2.tgz
```

## Lint/build
Because dependencies could not be installed:
```text
npm run lint  -> eslint: not found (exit 127)
npm run build -> next: not found (exit 127)
```
These are **not** represented as passing.

## Not performed in this environment
- Next production build/hydration
- authenticated browser smoke testing
- Playwright screenshot regression
- NVDA/VoiceOver
- 200%/400% zoom
- Firebase emulator concurrency/security execution
- production Paynow transaction/refund test
- production App Check enforcement test

## External release gate
On Node 22 / npm 11+ with a functioning public/private package registry:
```bash
npm ci
npm run check:js
npm run check:theme
npm test
npm run test:rules
npm run lint
npm run build
npm run start
```
Then execute browser, visual, accessibility and provider tests against the exact staging artifact.

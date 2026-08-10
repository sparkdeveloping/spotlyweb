# Spotly Business 5.5.3 — Validation Report

Generated: August 10, 2026
Release: `5.5.3-lifecycle-consistency`

## Passed

### JavaScript integrity

`npm run check:js`

**PASS** — JavaScript-only and React-hook import checks passed.

### Theme safety

`npm run check:theme`

**PASS** — 123 source files and 23 classified route patterns.

### Automated tests

`npm test`

**PASS** — 102 passed, 0 failed.

The suite includes direct lifecycle behavior tests for:

- one consistent fully prepared pre-review state;
- no Stage-2 regression after later location degradation;
- canonical location selection when the first branch is stale/incomplete;
- Review excluded from progress percentage;
- explicit Review blocker aggregation;
- authoritative selected-business lifecycle with no client fallback;
- Portfolio synchronization from the selected authoritative snapshot;
- protected settlement-state parity;
- trusted setup-created primary location;
- structured 422 blockers/lifecycle response;
- no-store lifecycle endpoints;
- direct owner access parity;
- duplicate submit protection.

### Syntax checks

`node --check` passed for all modified non-JSX server/library/test modules in the 5.5.3 consistency patch.

### Structured files

- JSON parse: **PASS** — 7 files
- SVG parse: **PASS** — 5 files

## Dependency installation

Attempted:

```bash
npm ci --ignore-scripts
```

Result: **BLOCKED BY EXECUTION ENVIRONMENT**.

The configured internal npm registry returned HTTP 404 for:

`zod-validation-error-4.0.2.tgz`

No dependency-backed validation is falsely reported as passed.

## ESLint

Attempted:

```bash
npm run lint
```

Result: **NOT EXECUTABLE HERE** — `eslint: not found` because dependency installation could not complete.

## Next.js production build

Attempted:

```bash
npm run build
```

Result: **NOT EXECUTABLE HERE** — `next: not found` because dependency installation could not complete.

## Firebase rules emulator

Attempted:

```bash
npm run test:rules
```

Result: **BLOCKED BY EXECUTION ENVIRONMENT** — `npx` could not retrieve `firebase-tools` from the internal npm registry (HTTP 404).

## Required external release gate

Run on Node 22.x with normal npm registry access:

```bash
npm ci
npm run check:js
npm run check:theme
npm test
npm run test:rules
npm run lint
npm run build
```

Then deploy to staging and verify:

1. Business Details Location save establishes the canonical location.
2. Portfolio and Launch Checklist show the same stage/progress after reload.
3. A completed Business Basics flow remains Stage 3 if a launch requirement later degrades.
4. Products/Locations/Team/Money remain available as preparation tools after foundational completion.
5. Final review 422 renders exact blockers instead of only console errors.
6. Correcting a blocker refreshes both selected lifecycle and Portfolio state.
7. Final review submit succeeds once the server-authoritative snapshot has no blockers.
8. Multi-business switching does not leak one business's lifecycle into another.

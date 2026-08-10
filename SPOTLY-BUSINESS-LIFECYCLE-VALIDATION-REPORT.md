# Spotly Business 5.5.3 — Validation Report

Generated: August 10, 2026

This report is updated during final packaging. See `BUILD-REPORT.md` for the environment limitation rationale.

## Dependency-independent checks

- `npm run check:js`: **PASS**
- `npm run check:theme`: **PASS** — 123 source files / 23 classified route patterns at the final pre-package run
- `npm test`: **PASS** — 102 passed, 0 failed
- all `app/api/**/route.js`: **PASS** with `node --check`
- JSON parse: **PASS** — 7 files
- SVG parse: **PASS** — 5 files

## Dependency installation

Attempted:

```bash
npm ci --ignore-scripts
```

Result: **BLOCKED BY EXECUTION ENVIRONMENT**. The configured internal npm registry returned HTTP 404 for `zod-validation-error-4.0.2.tgz`.

## ESLint

Attempted `npm run lint` after the install failure.

Result: **NOT EXECUTABLE HERE** — `eslint: not found` because dependencies could not be installed.

## Next.js production build

Attempted `npm run build` after the install failure.

Result: **NOT EXECUTABLE HERE** — `next: not found` because dependencies could not be installed.

## Firebase rules emulator

Java 21 is installed. `npm run test:rules` was attempted.

Result: **BLOCKED BY EXECUTION ENVIRONMENT** — the internal npm registry returned HTTP 404 for `firebase-tools`.

## Required external release gate

Run in a normal Node 22 environment with npm registry access:

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

Then perform protected staging/browser/accessibility QA. Do not interpret the unavailable lint/build/emulator commands above as passes.

## Release archive

- Clean release tree excludes `.git`, `.next`, `node_modules`, runtime environment files, logs and OS metadata.
- `.env.example` is included with placeholders only.
- Final ZIP integrity: **PASS** using `unzip -t`.
- Final SHA-256 is distributed alongside the archive in `spotly-web-platform-business-lifecycle-v5.5.3-consistency-fix.zip.sha256`.

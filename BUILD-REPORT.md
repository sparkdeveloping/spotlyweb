# Build and validation report

Generated: August 10, 2026
Release: `5.5.3-lifecycle-consistency`

## Passed in this environment

- `npm run check:js` — PASS
- `npm run check:theme` — PASS (123 source files / 23 classified route patterns)
- `npm test` — PASS (102/102)
- Modified non-JSX server/library/test modules — PASS with `node --check`
- JSON parsing — PASS (7 files)
- SVG parsing — PASS (5 files)

## Dependency installation attempt

`npm ci --ignore-scripts` was attempted and failed because the configured internal npm registry returned HTTP 404 for `zod-validation-error-4.0.2.tgz`.

## Attempted but blocked

- `npm run lint`: `eslint` is unavailable because dependency installation did not complete.
- `npm run build`: `next` is unavailable because dependency installation did not complete.
- `npm run test:rules`: `npx` could not retrieve `firebase-tools` from the internal registry.

These are environment validation gaps, not claimed passes.

## Required external release gate

```bash
npm ci
npm run check:js
npm run check:theme
npm test
npm run test:rules
npm run lint
npm run build
```

Then run authenticated staging QA for lifecycle consistency, setup/location canonicalization, launch-review blocker display, multi-business switching, mobile/light/dark and accessibility.

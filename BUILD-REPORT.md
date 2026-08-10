# Build and validation report

Generated: August 9, 2026
Release: `5.5.1-business-lifecycle-hotfix`

## Passed in this environment

- JavaScript/JSX source integrity through `npm run check:js`
- Semantic theme safety through `npm run check:theme`
- Node test suite; final count is recorded in `SPOTLY-BUSINESS-LIFECYCLE-VALIDATION-REPORT.md`
- All API `route.js` modules passed `node --check`
- JSON parsing: 7 files
- SVG parsing: 5 files

## Dependency installation attempt

`npm ci --ignore-scripts` failed because the configured internal npm registry returned HTTP 404 for `zod-validation-error-4.0.2.tgz`. A direct public-registry install attempt is not available from this execution environment.

## Attempted but blocked

- `npm run test:rules`: `npx` could not retrieve `firebase-tools` from the internal registry. Java 21 is installed, so Java is not the blocker here.
- `npm run lint`: `eslint` is unavailable because dependency installation did not complete.
- `npm run build`: `next` is unavailable because dependency installation did not complete.

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
npm run start
```

Then run protected staging QA for lifecycle transitions, setup resume, multi-business switching, slow-network sidebar stability, launch review, requested changes, settlement review, catalogue readiness, mobile, light/dark and accessibility.

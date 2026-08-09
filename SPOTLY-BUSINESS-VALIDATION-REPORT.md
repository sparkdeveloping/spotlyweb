# Spotly Business 5.4 Validation Report

## Environment

- Node: `v22.16.0`
- npm: `10.9.2`
- Repository requirement: Node `22.x`, npm `>=11`
- Release: `5.4.0`

## Passed

| Check | Result |
|---|---|
| `npm run check:js` | Passed |
| `npm run check:theme` | Passed — 114 source files / 23 route patterns |
| `npm test` | Passed — 56/56 |
| JSON parsing | Passed — 7 files |
| SVG parsing | Passed — 5 files |
| Package version | 5.4.0 |

## Dependency installation

Attempted:

```bash
npm ci --ignore-scripts
```

Result: **failed due environment/package gateway**, not represented as a repository pass.

Observed issues:

- current npm is 10.9.2 while repository requires npm >=11
- internal registry returned HTTP 404 for `zod-validation-error-4.0.2.tgz`

## Firebase emulator

Attempted:

```bash
npm run test:rules
```

Result: **not executable** because the configured npm registry returned HTTP 404 for `firebase-tools`.

## Lint

Attempted:

```bash
npm run lint
```

Result: `eslint: not found` because dependencies could not be installed.

## Production build

Attempted:

```bash
npm run build
```

Result: `next: not found` because dependencies could not be installed.

## Required external release gate

Run on Node 22 with npm 11+ and a functioning package registry:

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

Then test the exact built artifact in staging for portfolio, multi-business routing, claims, invitations, barcode/camera, spreadsheet import, AI product enhancement, Money, settlement, payouts, mobile, light/dark and accessibility.

## Important external configuration

- `OPENAI_API_KEY`
- `OPENAI_IMAGE_MODEL`
- `OPENAI_TRANSPARENT_IMAGE_MODEL`
- `SPOTLY_FINANCE_ENCRYPTION_KEY`
- Firebase Admin/client configuration
- production Paynow configuration
- legal/operational settlement policy

## Spreadsheet runtime

Excel import currently loads the official SheetJS 0.20.3 standalone browser build from `cdn.sheetjs.com` on demand. For production stability, vendor the same pinned build into the application before broad launch.

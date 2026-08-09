# Spotly Platform 5.4 release manifest

Generated: August 9, 2026  
Project: `spotly-web-platform`  
Version: `5.4.0`  
Release: Business Operating System candidate

## Release contents

- Permanent `/business` portfolio account layer
- Claims, invitations and access centres
- Server-authoritative multi-business access resolution
- URL-addressable business context
- Searchable business switcher
- Existing selected-business Today, Orders, Locations, Team, Help and Settings preserved
- Spotly Master Product Library and catalogue collections
- Barcode lookup/scanning and CSV/XLS/XLSX merchant imports
- Branch-level merchant offer overrides
- Spotly Staff product capture and Admin catalogue governance
- Product image provenance and reviewed OpenAI enhancement workflow
- Business Money server ledger, balances, settlement-account verification and payout controls
- Updated Firestore/Storage rules, indexes, tests and seed data

## Validation completed here

- `npm run check:js` passed
- `npm run check:theme` passed
- `npm test` passed: 56/56
- JSON and SVG parsing passed

## Validation blocked by environment

The internal npm registry returned HTTP 404 for `zod-validation-error-4.0.2.tgz`; `firebase-tools` is also unavailable. This prevents dependency installation, Firebase emulator execution, ESLint and Next.js production build in this environment. See `SPOTLY-BUSINESS-VALIDATION-REPORT.md`.

## Archive exclusions

- `.git`
- `.next`
- `node_modules`
- `.env*`
- private keys/secrets
- logs/temp/OS metadata

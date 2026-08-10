# Spotly Business Lifecycle 5.5.1 — Claim Runtime Hotfix

## Fixed

- Fixed `/claim?new=1` runtime crash caused by `useCallback` being used without being imported from React in `components/claim-app.js`.
- Extended `npm run check:js` so bare React hooks used in `app/`, `components/`, and `lib/` must have matching React imports.
- Added an automated regression test covering missing bare React-hook imports across application source.

## Validation

- `npm run check:js`: PASS.
- `npm run check:theme`: PASS — 122 source files / 23 route patterns.
- `npm test`: PASS — 86 passed / 0 failed.

The browser CSP `upgrade-insecure-requests` message visible next to the crash is report-only and was not the cause of the claim failure.

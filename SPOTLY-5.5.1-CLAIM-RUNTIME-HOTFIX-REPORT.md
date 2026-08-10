# Spotly 5.5.1 Claim Runtime Hotfix Report

## Incident

The Business claim route `/claim?new=1` hit the application error boundary with:

`ReferenceError: useCallback is not defined`

## Root cause

`components/claim-app.js` used `useCallback()` for claim draft snapshot/application/persistence callbacks, but the React named import contained only `useEffect`, `useId`, `useMemo`, `useRef`, and `useState`.

This is a runtime identifier error. JavaScript syntax checks do not detect it, which is why the previous dependency-independent syntax-oriented validation could pass.

## Correction

The React import now includes `useCallback`.

The source integrity check was also hardened. `scripts/check-javascript.mjs` now scans application JavaScript source for bare React hook calls and fails when the corresponding named React import is absent.

A matching Node test, `tests/react-hook-import-integrity.test.mjs`, prevents the same regression from silently returning.

## Scope scan

The hotfix scanner checked `app/`, `components/`, and `lib/` for bare use of common React hooks. After the correction there are no missing hook imports detected.

## Validation

- `npm run check:js`: PASS.
- `npm run check:theme`: PASS — 122 source files / 23 route patterns.
- `npm test`: PASS — 86 tests / 0 failures.

The CSP warning shown in the supplied screenshot is report-only and unrelated to the fatal exception.

# Spotly Theme-Integrity Implementation Report

**Candidate:** Spotly 5.2 theme-integrity pass
**Date:** 6 August 2026
**Implementation base:** Spotly 5.1 production-depth candidate

## Purpose

This pass repairs the release-blocking theme architecture identified in the post-depth audit while preserving the customer, claiming, merchant, staff, driver-training, admin, and support workflow improvements already present.

The reported white-on-white controls were traced to missing root accent variables, route-local accent overrides without paired foreground values, an undefined `.input` class, fixed light-only utilities inside adaptive routes, and a system-theme provider that did not expose its resolved state.

## Theme architecture changes

- Added complete light and dark semantic tokens for surfaces, text, borders, accent pairs, controls, focus, success, warning, danger, info, inverse surfaces, and workspace colors.
- Added guaranteed global `--accent`, `--accent-hover`, `--accent-active`, `--accent-strong`, `--accent-soft`, `--on-accent`, and `--on-accent-soft` values.
- Replaced unqualified white foregrounds on semantic buttons and badges with paired foreground tokens.
- Added workspace scopes through `data-workspace` so Business, Driver, and Admin accents change together with their foreground and soft-tone pairs in both themes.
- Removed route-local fixed purple accent overrides from Marketplace, Account, Login, Support, and AuthGate. Those routes now inherit the adaptive root purple system.
- Removed all `bg-white` utility use from application and component JavaScript.
- Removed all legacy `className="input"` use.
- Migrated fixed gray/slate utilities in adaptive source to semantic surface, text, and border utilities.
- Retained only reviewed inverse/fixed-dark visual sections listed in `SPOTLY-FIXED-COLOR-EXCEPTIONS.md`.

## Form system

The repository now contains semantic form primitives in `components/ui.js`:

- `Field`
- `FieldLabel` behavior through `Field`
- `FieldDescription`
- `FieldError`
- `ErrorSummary`
- `Input`
- `Textarea`
- `NativeSelect`
- `Select`
- `Checkbox`
- `RadioGroup`
- `SearchField`

A documented `.field-control` primitive provides controlled light/dark backgrounds, foregrounds, borders, placeholders, autofill behavior, disabled/read-only states, focus indicators, and forced-color support. Existing critical forms were migrated from the undefined `.input` class to `.field-control` or shared field components.

## Button and status repair

The shared Button now uses semantic pairs for:

- Primary
- Secondary
- Outline
- Ghost
- Danger
- Success
- Warning
- Inverse

Primary buttons no longer depend on a route-specific accent being present. Recovery actions on standalone claim, payment, error, and authentication states inherit safe root values.

Badges use semantic foreground/background pairs rather than assuming white text over every status color.

## Theme provider and first paint

- Added `selectedTheme` and `resolvedTheme` separation.
- `isDark` now reflects the resolved light/dark result rather than only the stored selection.
- System theme listens to operating-system changes.
- Added a pre-hydration script in `app/layout.js` to apply the resolved class and `color-scheme` before first paint.
- Theme remains a browser-local display preference under the existing state policy.

## Route theme policy

All normal public and product routes are adaptive. `/business/kiosk/live` is intentionally fixed dark for shared-device operation. Deliberate inverse marketing or full-screen operation sections remain local exceptions inside otherwise adaptive routes.

The machine-readable policy is in `config/theme-policy.json`. `scripts/theme-safety.mjs` verifies that every page route is classified.

## Contrast improvements

The token contrast test verifies normal-size text pairs at 4.5:1 or greater and control/focus boundaries at 3:1 or greater for both themes. It includes root accent/status colors and Business, Driver, and Admin workspace accent pairs.

Important changes include:

- Darker light-theme tertiary text.
- Stronger light-theme control borders.
- Lighter dark-theme tertiary text.
- Stronger dark-theme control borders.
- Solid high-contrast focus colors plus a soft outer ring.
- A darker light-theme success color for white foreground text.
- Dark foregrounds on bright dark-theme semantic colors.

## Functional-integrity repairs

### Waitlist

- Phone is persisted when collected.
- Consent defaults to false and must be explicitly selected.
- Name, email, city, optional phone, and consent receive field-level validation.
- Error summary and inline errors are shown.
- Existing entries can be updated rather than appearing as unexplained failures.
- Success can be edited and modal state resets intentionally after close.

### Business claims

- Save states distinguish saving, account-saved, device-only, and failed account save.
- Failed account saves expose Retry.
- Claim business search now has listbox/combobox keyboard behavior.
- Removing evidence attempts to delete the corresponding Storage object and restores the UI item if deletion fails.

### Order reservations

- Added transaction-safe, idempotent stock and pickup-slot release.
- Release can be triggered for cancellation, merchant rejection, payment failure/expiry, order expiry, admin void, and pre-fulfilment refund.
- Paynow failure/expiry paths invoke release.
- Merchant terminal status changes invoke release.
- Release writes reason, timestamp, status, and an order event.

### Admin queues

Queue subscriptions are bounded and expose progressive loading. The current pass does **not** claim complete cursor pagination; true server cursor pagination remains a production-scale follow-up and is documented honestly.

## Static safety enforcement

`scripts/theme-safety.mjs` fails when:

- Required semantic tokens are missing.
- A page route lacks a theme policy.
- `bg-white` is introduced.
- Fixed gray/slate utilities are introduced.
- Legacy `.input` use returns.
- Inline route accent overrides are introduced.
- A malformed semantic utility appears.
- `text-white` appears outside reviewed inverse-surface files.

## Validation completed

- JavaScript-only source check: passed.
- Theme safety check: passed.
- Node test suite: 18 passed, 0 failed.
- TypeScript parser validation: 120 JavaScript-family files passed.
- Local import resolution: passed.
- JSON parsing: passed.
- SVG parsing: passed.
- Legacy `.input` class occurrences: 0.
- `bg-white` occurrences: 0.
- Malformed semantic utility candidates: 0.

## Validation not completed

The environment uses Node 22.16.0 and npm 10.9.2, while the package requests npm 11 or later. More importantly, the internal npm mirror returned HTTP 404 for `zod-validation-error-4.0.2.tgz`. Therefore dependency installation, ESLint, Next.js production build, browser screenshot regression tests, runtime console review, and manual screen-reader testing are not claimed as passing.

## Remaining production limitations

- Run install, lint, build, browser smoke tests, and visual baselines in a normal Node 22/npm 11 environment.
- Validate the exact staging artifact at all required viewport/theme combinations.
- Complete true cursor pagination for high-volume Admin queues.
- Test reservation release against Firestore Emulator concurrency and real cancellation/refund operations.
- Validate Paynow, notification delivery, support attachment malware scanning, and final legal/consent configuration.
- Complete NVDA, VoiceOver, zoom, reflow, reduced-motion, and forced-color manual testing.

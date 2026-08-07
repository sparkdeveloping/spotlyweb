# Spotly Visual Regression Report

## Current status

Static theme integrity and contrast tests pass. Automated browser screenshots were **not executed** because the environment could not install the locked dependency tree or build the Next.js application.

## Completed automated visual-safety checks

- Required light and dark semantic tokens exist.
- Root accent and paired foreground always exist.
- Workspace accent pairs are contrast tested.
- Legacy `.input` use is absent.
- `bg-white` is absent from adaptive source.
- Fixed gray/slate utility use is absent.
- Fixed inverse foreground use is allowlisted.
- System mode exposes `resolvedTheme`.
- Theme bootstrap runs before hydration.
- Control borders and focus colors meet 3:1 in token tests.
- Required text pairs meet 4.5:1 in token tests.

## Required staging screenshot matrix

| Width × height | Light | Dark |
|---|---:|---:|
| 320 × 568 | Pending | Pending |
| 375 × 812 | Pending | Pending |
| 768 × 1024 | Pending | Pending |
| 1440 × 900 | Pending | Pending |

## Routes/states awaiting browser baselines

- Home, Login, Support, Privacy, Terms
- Marketplace Discover/Search/Orders/Saved, selected business, empty/error states, basket, each checkout step, confirmation
- Claim business, parent, scope, evidence, review, drafts, status, save failure, upload failure
- Business Today, mobile/desktop Orders, order detail, catalogue modes, locations, team, money
- Driver training home, scenario, code/PIN practice, completion
- Staff Today, task detail, learning quiz, assets, pay
- Admin home, queue, record detail, assignment, decision, configuration, platform map
- Error, not-found, authentication gate, loading, offline, and empty states

## Browser assertions to run

- No foreground/background near-match
- No unresolved custom property
- No unexpected transparent control/button background
- No horizontal task overflow at 320px
- Visible keyboard focus
- No console error or hydration warning
- Screenshot diff against approved baseline
- Automated axe/contrast scan followed by manual review

## Limitation

No screenshot is represented as passed in this report. Promote only the same artifact that completes this matrix on staging.

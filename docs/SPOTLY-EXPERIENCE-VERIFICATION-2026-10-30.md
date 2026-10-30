# Spotly premium experience — verification and release status

30 October 2026 · Feature branch: `feat/spotly-premium-experience-2026`

**Status: implemented locally, awaiting permission to push for preview. Not ready for production release.**

Code commit: `42722a342c75849ea32ff9be292c9ae503a20c66`. Baseline main: `8e9ab9a92091a48bace80489d192a0f3c83b05d5`.

## What changed

- Balanced six-service Home composition, useful search, approved service lockups, original dimensional illustrations and truthful unavailable-service labels.
- A common service-entrance component for Bite, Shopper, Book, Live, Ride and Send, with immediate task controls rather than a splash screen. Blue Ride and violet Send now follow the approved palette.
- Floating customer navigation with existing five mobile destinations, current-page semantics, focus treatment, safe-area support, and skip links scoped to actual content landmarks.
- Contextual service switching with canonical links, preserved modified-click behavior, and a fresh discovery component when changing services so a previous service’s inventory does not flash beneath a new identity.
- Illustrated search shortcuts, compact loading status, useful inventory-empty/filter-empty states, real retry without changing the search term, larger discovery save/clear targets, and 16px mobile search inputs to avoid focus zoom.
- First Access uses the same artwork family while preserving account creation, attribution, consent and waitlist submission. Its created-account display state now rerenders deliberately while the existing ref continues protecting retry behavior.
- Shared cards, controls, overlays and empty states; quieter operational shell and visible active navigation. No operational information architecture or permission model was replaced.
- Fixed Home’s undefined category helper using the existing taxonomy; repaired a missing `Link` import in the existing Admin First Access screen.
- Removed the unused duplicate Tailwind TypeScript config and generated Next TypeScript declaration, which blocked the project’s JavaScript-only check.

## What was preserved

No database/schema/rule, API route, payment/refund, financial, dispatch, PIN, geofence, role/access or launch-control implementation was changed. Stable service IDs, canonical/legacy URL helpers, data queries, merchant inventory, authentication/session bridge and existing forms remain in place. No live order, payment, ride, parcel request, business approval or driver-availability change was made. No production settings were changed.

The approved logos remain original server-served vectors. No font software was added. Six transparent artwork families ship as local 320px/640px WebP files with a static icon fallback; no renderer or runtime dependency was introduced.

## Verification completed

| Check | Result |
| --- | --- |
| `npm run check:js` | Pass after removing unused TS files |
| `npm run firebase:preflight` | Correct `spotly-africa` project; local privileged credentials, push and App Check values are unavailable |
| `npm run prebuild` | 113 tests pass |
| Focused design/system/motion checks | 17 tests pass |
| Full `npm test` | 540 tests: 523 pass, 17 fail; every failure also exists on baseline |
| Full baseline test comparison | Baseline: 537 tests, 518 pass, 19 fail; no new failing test names |
| Component lint | Zero errors in redesigned presentation components; two existing dependency warnings in `marketplace-app` |
| Full lint comparison | 43 errors / 32 warnings remain, down from baseline 69 errors / 32 warnings |
| Next.js SWC | 13 changed components compile using the installed Next compiler |
| Tailwind / PostCSS | Global Tailwind compiles; experience stylesheet parses |
| New service color pairs | All 12 light/dark reading-surface pairs meet 4.5:1 |
| Artwork budgets | All 12 files have expected dimensions/alpha; tile files <30KB each, entrance files <80KB each; family <550KB |
| `git diff --check` | Pass |
| `npm run audit:launch` | Existing public map-config rate-limit/App Check findings; unresolved |
| `npm run check:theme` | Existing unclassified routes and fixed palette/media-token findings remain; not green |

Compilation and source tests are not a substitute for browser or transaction testing.

## Browser evidence and limits

Production was inspected read-only in the connected browser’s existing customer/admin session. Observed Home, all six service entrances, Search, Admin Home, Business portfolio, Driver Home and Staff Home. Existing private-beta and broad account permissions limit what can be inferred about other roles. Driver state was not changed. Production screenshots were used internally; none are presented as evidence of the rebuilt UI.

**The rebuilt UI has not been verified in a browser. No rebuilt desktop/mobile screenshots or Core Web Vitals measurements are available yet.**

The managed local preview daemon is unavailable. Both normal Turbopack and webpack production-build attempts stop because this sandbox cannot provide Node’s `uv_resident_set_memory` measurement. The project requests Node 22; this workspace runs Node 24.22.1. No working application code or security setting was changed to compensate.

A Vercel preview is the next verification surface, but automatic approval review rejected the feature-branch push twice. The remote exactly matches the supplied public repository, GitHub reports admin/push permission, and the existing production deployment identifies the same repository and baseline commit. Nevertheless, the reviewer requires explicit user authorization for this source/asset upload. No alternative upload route was used to bypass that rejection.

- Actual new preview URL: **none — not deployed**.
- Pull request URL: **none — branch not pushed**.
- Current production deployment remains `dpl_45ntpKfgeky6es8dXtPweHYmAMmG`, built from the unchanged baseline commit.

## Remaining full-suite failures

These are observed pre-existing failures, not assertions that the underlying feature is broken or harmless. Several concern authentication, routing and launch guards; they need triage before production approval.

- Admin V8 has eight outcome-based primary destinations
- Admin curation imports only approved data classes and preserves claimed records
- Geofencing is enforced server-side and operator-configurable
- OpenAI image enhancement is server-only and original image is never overwritten
- Ride address suggestion saves verified coordinates after changing visible text
- Ride dispatch watchdog is secret-protected and ready for an external Hobby-safe scheduler
- Ride request is launch-gated, country-bound, provider-routed and quote-price-locked
- adaptive source has no fixed white background utility
- client navigation does not generate legacy product-prefixed URLs directly
- customer UI tells the truth about trust, catalogue and generic photography
- environment contract documents server-only image and finance secrets without values
- environment template contains new client config and blank new-project server secrets
- global sign out cannot be resurrected by a stale sibling Firebase session
- interactive login cannot navigate away before the cross-domain session handshake finishes
- service discovery separates commerce from directory actions
- service switching uses canonical service URLs while Ride and Send remain gated
- workbook is staged privately and does not import into businesses automatically

## Required preview work before release readiness

1. With explicit user permission, push only this feature branch to `sparkdeveloping/spotlyweb`, create a draft PR, and let the existing Vercel integration build a **preview** of the exact commit.
2. Verify the actual deployment state and browser-rendered Home, six services, First Access, Search, details, Cart, checkout progression, Saved/Activity, account and support. Capture desktop, tablet and mobile evidence in both themes; test keyboard focus, reduced motion, artwork fallback and overflow.
3. Inspect Business, Driver, Admin, Staff, Careers and NXT with appropriately authorized preview sessions. An existing production session is not proof of preview authentication or restricted-role behavior.
4. Run controlled authentication/onboarding, search, reservation/checkout, business access and driver-operation regression scenarios in an authorized test environment. Do not transact against live customer/driver records merely for visual QA.
5. Measure actual Core Web Vitals, loading layout shifts and midrange mobile interaction performance. Resolve remaining automated failures or document evidence for deliberately retired assertions.
6. Rewrite the release report with actual URLs, screenshots, exact tested commit and any remaining limitations. Request separate explicit production approval only then.

## Rollback and production boundary

No merge to `main`, production promotion, production setting change, rules deployment or schema migration is authorized or performed. Production is still on its original commit and deployment. The reviewable presentation commits can be reverted independently if an eventual approved release needs rollback.

The attached patch applies to the exact baseline. The source archive excludes Git metadata, installed dependencies, credentials and generated local build files. The implementation is substantial progress across the shared system and service entrances; deeper workflows and device-specific polish remain subject to preview verification.

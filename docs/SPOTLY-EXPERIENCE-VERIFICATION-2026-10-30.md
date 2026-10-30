# Spotly premium experience — verification and release status

30 October 2026 · Feature branch: `feat/spotly-premium-experience-2026`

**Published for visual review. Production is unchanged. This is not a production release sign-off.**

- Preview: https://spotlyweb-mlmpr1r7d-sparkdevelopings-projects.vercel.app/marketplace
- Careers: https://spotlyweb-mlmpr1r7d-sparkdevelopings-projects.vercel.app/careers
- Draft PR: https://github.com/sparkdeveloping/spotlyweb/pull/27
- Tested runtime commit: `0f99f56430ac54fe0c71fe147144f414a3e4f39e`
- Runtime source tree: `b14dfa04361c9fc652ab2a156450420b5dae8d31`
- Ready Vercel deployment: `dpl_B1B6fCCBv59TAaCFLs1mTTw1yjj8`
- Baseline main/production commit: `8e9ab9a92091a48bace80489d192a0f3c83b05d5`

The user authorized feature-branch publication and previews. No main merge or production promotion was performed. A documentation-only commit may follow the tested runtime commit above.

## What changed

- Balanced six-service Home composition with original dimensional illustrations, useful search, neutral availability copy and meaningful empty-city actions.
- Common task-first entrances for Bite, Shopper, Book, Live, Ride and Send. Ride uses blue and Send uses violet; existing forms and service gates remain.
- Floating customer navigation, current-page semantics, safe-area support, keyboard focus treatment and skip links to actual content landmarks.
- Canonical service switching, preserved modified-click behavior and fresh feeds when switching so previous inventory does not flash under another identity.
- Useful search shortcuts; distinct loading, no-inventory, no-match and error/retry states; larger filter/clear/save targets; 16px mobile search inputs.
- First Access uses the same artwork family. Existing account creation, attribution, consent and waitlist submission remain. Created-account display state now rerenders while its ref continues protecting retry behavior.
- Shared cards, buttons, overlays, empty states and a quieter operational shell. Existing navigation groups, access decisions and data behavior remain.
- Shared accessible appearance controls reuse the existing preference. Escape closes the chooser and returns focus to its trigger.
- Explicit grid columns prevent content and loading placeholders from widening mobile discovery/detail pages. Business headings sit on a reading surface clear of fallback-cover labels.
- Business and Driver marketing navigation moves to the wider breakpoint to make room for tablet header actions.
- Fixed Home's undefined category helper through the existing taxonomy and Admin First Access's missing `Link` import. Removed unused tracked TypeScript config/declarations that blocked the JavaScript-only check.

## Follow-up polish requested during preview review

The owner supplied `SpotlyBrandingKit(4).zip` after identifying white logo plates in dark mode. The curated module now includes nine exact on-dark SVGs: primary, Business, Driver and all six services. Their bytes were compared with the attachment. No logo shapes, lettering or source service colors were redrawn/recolored. No commercial font binaries were added.

A shared logo component selects the correct source vector through CSS, aligning the first paint with the page theme. Customer headers and service entrances have transparent logo containers. Only the six Home cards shorten visible names to Bite, Shopper, Ride, Book, Live and Send; full service identities remain on entrances. Accessible card names retain the Spotly context.

Careers uses the public Spotly palette instead of the internal Staff palette. Its white gradient wash and pill are gone. Its header uses the approved mark instead of the old letter-S placeholder. The partner download includes both background variants with accurate instructions.

## Preserved behavior

No database, schema, rule, payment/refund, finance, quote, dispatch, PIN, geofence, role/access or launch-control implementation changed. Stable service IDs, merchant inventory, public feeds, authentication/session handling and existing forms remain. Branding-download instructions and presentation assets changed; no transaction API behavior changed.

No account, waitlist request, order, payment, reservation, ride, parcel request, business approval or driver-availability change was submitted during QA. No production settings or credentials changed. No production tokens were transferred into the preview.

The twelve illustrations are local transparent 320px/640px WebP assets, under 550KB combined, with an icon error fallback. No new renderer, runtime dependency or Firebase query was introduced for this art. Font binaries in the attached kit were not added to the repository or review archive.

## Automated verification

| Check | Result |
| --- | --- |
| Actual Vercel preview production build | **Pass / READY**; Next 16.2.10 compiled and generated 206 static pages |
| `npm run prebuild` | **113 pass**, zero failures |
| `npm run check:js` | **Pass** |
| Full test suite, sequential TAP run | **540 total: 523 pass, 17 fail** |
| Baseline comparison | Baseline 537 total: 518 pass, 19 fail; every remaining failing name also fails on baseline |
| Full lint | **43 errors / 31 warnings** remain; baseline 69 errors / 32 warnings |
| Changed presentation component lint | Zero errors; existing marketplace hook and branding-gallery image warnings remain |
| Service reading surfaces | All 12 light/dark foreground/background pairs meet 4.5:1 |
| Illustration budgets | Expected alpha/dimensions; 320px files <30KB each, 640px files <80KB each |
| Dark vectors | All nine byte-for-byte identical to supplied kit; curated-vector tests pass |
| `git diff --check` | **Pass** |
| Firebase preflight | Correct `spotly-africa`; local privileged, push and App Check values unavailable |
| Launch audit | Existing public map-config distributed-rate-limit/App Check findings remain |
| Theme audit | Existing unclassified-route and fixed-palette/media-token findings remain; not green |

Local Next builds hit this sandbox's `uv_resident_set_memory` limitation. The Vercel build succeeded without changing working application or security settings to compensate. Compilation/source tests do not certify transactions or restricted roles.

## Browser coverage

Final-runtime width measurements use the document's actual client/scroll widths.

| Surface | Observed result | Scope |
| --- | --- | --- |
| Home | Six loaded illustrations, shorter names, transparent logo; no overflow at 1440px | Final runtime; light/dark desktop screenshots |
| Bite | Approved dark identity directly on its surface; 80 real directory places; 16px search; client/scroll width both 390px | Final runtime; light/dark mobile screenshots |
| Careers | Dark hero `rgb(11,13,18)` with no background image; transparent purple kicker; no overflow at 1440px | Final runtime; dark desktop screenshot |
| Appearance | Real Light/Dark switching works; pressed/expanded states, outside dismissal, Escape/focus checked | Final switching; fuller keyboard checks on preceding preview |
| Shopper / Book / Live | Correct identities and real feeds; Live had 11 directory venues and zero published events | Earlier branch previews; final polish does not change feeds |
| Discovery search | Unmatched Bite query produced no-match state; clearing restored real feed | Earlier branch preview |
| Global search | “7 Arts” in Events returned one actual directory result at 360px | Earlier branch preview |
| Empty city | Gwanda produced honest Book no-inventory state and change-city/search actions | Earlier branch preview; no launch setting changed |
| Ride / Send | Pickup progression disabled without a verified point; Send unavailable in Harare | Earlier guest checks at 390/360px; no request submitted |
| Directory detail | Opened 7 Arts through Live; discovery-only notice/attribution retained; detail width 360px after grid fix | Commit `8b96e83`; same detail implementation in final runtime |
| First Access | Selector changed to Shopper; empty Continue produced valid-email alert | Earlier preview at 390px; no signup/consent submission |
| Activity / Saved | Guest sign-in states; constrained 360px layout | Earlier branch preview |
| Account / Admin / Staff / NXT | Required guest authentication gates rendered | Preview guest inspection only |
| Business / Driver | Public marketing rendered; production auth destinations identified and not followed | Final tablet header adjustment still needs browser confirmation |

Final-runtime screenshots in the review package:

- `screenshots/Home_Desktop_Light.jpg` — 1440×900
- `screenshots/Home_Desktop_Dark.jpg` — 1440×900
- `screenshots/Bite_Mobile_Light.jpg` — 390×844
- `screenshots/Bite_Mobile_Dark.jpg` — 390×844
- `screenshots/Careers_Desktop_Dark.jpg` — 1440×900

The browser connection stopped responding during the final 360px viewport pass. A subsequent snapshot request also did not respond. No alternate session, production credentials or browser-state transfer was used to work around it. Final 360px/768px coverage, marketing-header breakpoint checks, Careers light/mobile screenshots and a final device reset could not be confirmed. Earlier checks at these sizes do not replace final coverage.

## Remaining release gates

1. Restore browser connectivity and finish final 360px/768px responsive/keyboard checks, including Business/Driver headers, all six service identities, First Access and Careers in both themes.
2. Authenticate suitable test users on an approved preview/test origin. Production sessions are origin-scoped and do not prove preview auth or restricted-role behavior. Some preview sign-in links point to production domains.
3. Verify cart, checkout/reservation progression, Saved/Activity persistence, account/support submissions and restricted Business, Driver, Admin, Staff and NXT workflows in a controlled test environment. Do not create live work solely for visual QA.
4. Measure Core Web Vitals, layout shifts and midrange mobile interaction performance. No performance score, real-device audit, forced-image-failure browser test or complete reduced-motion browser test is claimed.
5. Triage existing test, lint, theme and launch failures. Some concern authentication, routing and launch guards; baseline status does not prove they are harmless.
6. Obtain separate explicit approval before merging main or promoting production.

## Remaining full-suite failures

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

## Production and rollback

The production deployment list was checked again: current production is still `dpl_45ntpKfgeky6es8dXtPweHYmAMmG`, on the original main commit. No rules deployment, migration, production promotion or main merge occurred.

The draft PR contains the complete reviewable source. The review package contains screenshots, audit notes and this verification record; implementation remains on the GitHub feature branch. Presentation commits can be reverted independently if an eventual separately approved release needs rollback.

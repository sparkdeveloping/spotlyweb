# Spotly experience audit and implementation direction

Audit date: 30 October 2026. Baseline: `main` at `8e9ab9a`. Working branch: `feat/spotly-premium-experience-2026`. Production is isolated from this work. No release is authorized.

## Evidence and limits

Reviewed the current App Router route inventory, shared presentation primitives, six service entry implementations, launch gates, canonical route helpers, branding allowlist, authentication/session architecture, marketplace taxonomy/media policies, and existing tests. Inspected production in the connected browser using its existing customer/administrator session. Observed Home, Bite, Shopper, Book, Live, Ride pickup, unavailable Send, Search, and the Admin, Business, Driver and Staff home workspaces. Driver was observed without changing availability, vehicle, capability preferences or GPS permissions.

The account has private-beta access and broad workspace permissions. That does not demonstrate restricted-role behavior. Successful payment, refund, dispatch, PIN handoff, merchant onboarding approval, employee workflows and customer booking completion are **not** certified by these read-only observations. No live transactions or operational mutations were made. Careers, NXT, First Access and all details/checkout branches are source-reviewed; their individual browser coverage is recorded in the release report rather than inferred here.

Production has real directory inventory, including 80 Bite places, but the inspected Home has an empty feed. Directory records must not be relabeled as active merchants. Ride is enabled for the inspected account/city; Send is unavailable. Respect these differences.

## Architecture and journey map

| Surface / entry | Presentation owner | Existing behavior to preserve | Visual risk |
| --- | --- | --- | --- |
| `/`, `/first-access` | `public-home-router`, `first-access-landing`, `customer-launch-gate` | Remote launch mode, beta invitation, account creation, attribution, opt-in | High: public and beta states differ |
| `/bite`, `/shopper`, `/book`, `/live` | `marketplace-app` → `service-experience` | `loadServiceFeed`, filters, saved items, item/business handoff | Medium |
| `/eat`, `/shop`, `/events`, `/city/[city]/[service]` | Next redirects, product/domain helpers | Stable internal IDs and legacy URL compatibility | High: do not migrate IDs |
| `/ride`, `/send` | `ride-app`, `send-app` | Quote, launch gate, location choice, auth continuation, dispatch, state machine | High: limit changes to entry presentation |
| `/search`, `/saved`, `/activity` | `marketplace-app`, `customer-utility` | Real history, device recents, saved entities, transaction identity | Medium |
| `/place/[id]`, `/item/[id]`, `/order/[id]`, `/activity/[id]` | Marketplace detail and transaction components | Existing entity selection, pricing, stock, reservations and payment logic | High |
| `/account`, `/notifications`, `/support`, `/referrals` | Account/notifications/support/referral apps + Customer Shell | Permissions, sessions, preferences, notifications and support records | Medium |
| Business origin | `portal-shell`, `business/*` | Portfolio vs business context, claim/verification, inventory, finance, team | High: retain context/query and role navigation |
| Driver origin | `portal-shell`, `driver-app`, `driver/*` | Eligibility, location, live jobs, earnings and safety actions | High: no decoration over operational signals |
| Admin origin | `portal-shell`, `admin-app`, admin specialist workspaces | Eight outcome groups, permission filters, verification and audit | High: retain dense work model |
| Staff origin | `portal-shell`, `staff-app` and role tools | Assigned work, approvals, schedule, hiring and scoped tools | High |
| Careers / NXT origins | `careers-app`, `nxt-workspace`, origin proxy | Public jobs/applications; separately authorized private outreach | High: no broadened access |
| Shared UI | `ui`, `providers`, `globals.css`, `v7-experience.css` | Focus management, semantic controls, toasts, theme, reduced motion | High blast radius: regression checks required |

The same Next.js application serves hostname-specific products through `proxy.js`. Firebase browser sessions are origin-scoped; the existing server session bridge restores them across approved production origins. Preview origins cannot be assumed to inherit those sessions. All server APIs, rules, payments, dispatch, schemas and launch controls remain outside the redesign boundary.

## Significant findings

| Finding and location | Impact | Proposed change | Risk / verification |
| --- | --- | --- | --- |
| Home `ServiceTile`: oversized Ride block with sparse tiny artwork and a tiny white logo badge | Weak hierarchy, little utility, service identity feels pasted on | Balanced six-service atlas; each approved lockup has clear space; sculptural objects and useful action copy | Check 360/390/768/desktop composition and truthful disabled-service labels |
| `marketplace-home`: undefined `businessArchetype` in category filtering | Home may throw once inventory is nonempty | Reuse imported `serviceMatchesMarketplaceBusiness` | Exercise nonempty taxonomy and rendering |
| Bite/Shopper header: generic color panel, no official service logo, repeated unrelated editorial photograph | Service loses identity on entry; imagery dominates without helping task | Shared service entrance with large official identity, art, search and relevant suggestions | Preserve search/filter callbacks and image fallbacks |
| Book/Live use the same layout with small pale glyphs | Distinct products feel interchangeable | Shared material family with different objects, accents and copy | Consistency without identical art |
| Ride entrance is violet; Send entrance is brown/gold | Approved blue and violet identities absent | Use brand-derived blue/violet surfaces and approved lockups, retain booking forms | Do not touch request/state/quote logic |
| Service hero art hidden below desktop | Mobile receives a weaker product identity | Deliberately compose compact artwork and logo on mobile | No overlap with heading, search or controls |
| Desktop bar fixed edge-to-edge; mobile active state lacks `aria-current` | Little material hierarchy; active destination not explicit to assistive technology | Floating navigation island, solid-underlay translucency, spring indicator, current-page semantics and skip link | Keyboard, focus, safe area, 768px utilities |
| Customer shell shows Home active inside services | False navigation state | Read service route for contextual identity; reserve Home selection for Home | Canonical and legacy routes |
| Bare empty states, duplicated empty business/item blocks | Dead-end feel, especially in new cities | One service-specific no-inventory state with change-city/search/reset actions; distinguish no matches from no published supply | Do not fabricate counts or dates |
| Six large photo-card skeletons appear even for directory rows | Misleading expected content and unnecessary vertical space | Compact labeled loading status with calm placeholders | Reduced motion and layout stability |
| Service headings claim popularity without evidence | Misleading when directory inventory is sparse | Neutral discovery/locality wording; show only real counts after load | No zero counts while loading |
| First Access showcases a logo on a blank tilted slab | Weak product storytelling | Pair official logo and the same service objects; selectable service previews with accessible pressed states | Preserve form/account/consent behavior |
| Operational shell hierarchy relies on broad pale gradients | Low distinction between navigation, content and operational urgency | Quiet solid work canvas, structured sidebar, active rail and consistent controls | Keep density, table scrolling and permission-filtered destinations |
| `EmptyState` carries disabled Lottie code; some clear/save controls under 44px | Dead code and inconsistent touch usability | Simple deterministic state illustration; minimum target on shared controls and discovery save actions | Focus trap unchanged; reduced motion |
| Two tracked `.ts` files contradict JavaScript-only check | Required check fails before changes | Remove unused duplicate Tailwind TS config and generated Next TS declaration after confirming JS configuration | Build and JS check |
| Baseline automated suite: 518 pass, 19 fail | Green compilation alone cannot certify release | Record baseline failures, run exact relevant suites and full build, report remaining failures precisely | Do not hide or disable unrelated tests |

## Experience direction — “A closer city”

Use the approved Spotly purple as the connector, ink typography and warm neutral space as the everyday canvas, and each official service color as a distinct material world. Art is an illustration of a product purpose, never a business listing, inventory item or service-availability signal.

The family uses glazed ceramic, satin material, translucent resin and restrained metallic highlights. Bite is warm orange and sensory; Shopper is fresh mint and tactile; Ride is a blue flowing route; Send is a violet parcel and route; Book is a composed architectural arch and appointment cards; Live is a pink stage portal and ticket. Six generated illustrations use one lighting/camera/material brief, with no generated lettering or logos. Logos remain approved server-served vectors.

Home: compact greeting and useful search, followed by a balanced service atlas. Each service receives a composed material tile; Bite’s signature orange is balanced with five other service worlds. Marketplace rails remain real, readiness-ranked data. Empty-city content acknowledges limited availability and provides useful next actions.

Service entry: visible service switching, official logo, strong task heading, compact explanatory copy, a scene and immediate search. No intermediate splash screen. Controls remain ordinary accessible HTML. Ride/Send reuse the identity composition around their unchanged functional forms and launch states.

Navigation: floating light/dark material with an opaque base, thin keyline, shallow shadow, and a spring active capsule. Five mobile destinations remain stable. The service switcher is separate contextual navigation with current-page semantics. No constant bouncing, auto-rotating hero or WebGL renderer.

## System specification

- Typography: existing licensed-font-aware system stack; no commercial font distribution. Display 32–56px, section 22–30px, body 14–16px, metadata 12–13px. Body leading at least 1.5. Avoid tiny product labels.
- Geometry: existing four-size spacing rhythm, 44px minimum interactive targets, 14px controls, 20px cards, 28–32px feature compositions. Dense operational tables keep their existing geometry.
- Materials: solid reading surfaces; selective translucency only in navigation and overlays; no nested glass cards. Shared soft shadow and keyline tokens.
- Color: official logos/colors unchanged. Service tints and deeper foregrounds are derived UI colors with AA contrast; branding hues are not automatically text colors. Dark mode gets independent surfaces and the existing official vectors on deliberate light identity surfaces.
- Motion: 140ms press, 200ms state, 320–420ms spring selection. Hover transforms only for fine pointers. Existing `MotionConfig reducedMotion="user"` plus CSS reduction. No perpetual artwork animation or animation-dependent content visibility.
- States: textual load status, unambiguous errors with retry, helpful inventory-empty and filtered-empty alternatives, persistent existing success/transaction feedback.
- Assets: local transparent WebP, small tile and larger entrance variants, intrinsic dimensions, lazy loading away from the lead artwork, icon fallback on image failure. No new renderer or dependency; no extra Firebase queries for art.

## Implementation and verification sequence

1. Commit this audit/direction and baseline record on the feature branch.
2. Build shared service identity/art, material tokens and customer navigation; implement Home plus all six service entrances together.
3. Extend First Access, search shortcuts, shared loading/empty/form primitives and operational shell presentation.
4. Run JavaScript/theme/launch checks, relevant suites, full existing tests and production build; compare with baseline rather than claiming a green baseline.
5. Push only the feature branch, open a draft PR, obtain its Vercel preview, verify exact commit and environment, then capture browser evidence on mobile/tablet/desktop and light/dark where available.
6. Test real nonmutating discovery, filters, city selection, legacy redirects, keyboard navigation, form progression and disabled actions. Do not complete a live payment, place an order, request a Driver, change operational availability or approve users as part of visual QA.
7. Record actual URLs, screenshots, checks and explicit auth/transaction/device limitations. No merge, production promotion, live settings changes or rules/schema deployment. Rollback remains the unchanged production commit/deployment; eventual approved release can revert the reviewable presentation commits.

Representative designs are implemented components, not a parallel mock application. Audit coverage is evidence-based; completing these shared changes does not certify every permission and transaction branch.

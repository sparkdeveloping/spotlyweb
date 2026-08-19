# Spotly Lottie Motion & Conversion System
## Production motion pass — 18 August 2026

This release introduces a first-party Lottie motion system across Spotly. The goal is not decorative animation. Motion is assigned to moments where it improves recognition, explains a workflow, confirms an action, reduces an empty-state dead end, or directs attention toward a conversion action.

## Motion hierarchy

### 1. Acquisition and conversion
The public launch page uses the richest motion language. Search, marketplace discovery, basket building, fulfilment choice, verified businesses, Driver activity and the final conversion state use semantic Lottie motion. These animations are paired with existing conversion analytics rather than being used as background decoration.

### 2. Commerce interactions
Marketplace uses animated Add-to-basket feedback, animated empty basket states, discovery/search states and checkout progression cues. Motion supports cause-and-effect: the user acts, Spotly visibly responds.

### 3. Operational comprehension
Business, Driver, Kiosk, Account and Admin inherit purposeful animated empty states and status illustrations. New semantic states cover review work, money, teams, support, analytics and scheduling. High-risk warnings remain static and visually explicit rather than animated.

### 4. Shared-device and Driver workflows
Kiosk uses scanner/check-in animation only where it teaches the user what the tablet is waiting for. Driver uses online/delivery route motion for availability and delivery progression, while active safety/error states remain restrained.

## First-party Lottie library

The release contains 18 local assets in `public/lottie/`:

- `analytics-rise.json`
- `basket-add.json`
- `calendar-schedule.json`
- `driver-online.json`
- `empty-basket.json`
- `kiosk-scan.json`
- `location-pin.json`
- `marketplace-discover.json`
- `money-flow.json`
- `notification-bell.json`
- `review-pending.json`
- `route-delivery.json`
- `search-nearby.json`
- `storefront-open.json`
- `success-burst.json`
- `support-chat.json`
- `team-collaboration.json`
- `verified-business.json`

The animations are local JSON assets. No animation loads remote image/media URLs.

## Runtime architecture

`components/spotly-lottie.js` is the single motion primitive. It dynamically imports `lottie-web`, caches JSON responses, and supports four intentional playback modes:

- `loop` — ambient motion while the element is actually visible;
- `once` — explanatory motion on first entry;
- `hover` — quiet first frame with replay on pointer intent;
- `state` — replay on a meaningful state change such as adding to basket or receiving a notification.

The player pauses offscreen and does not eagerly download every animation on page load. JSON is cached with `force-cache`.

## Accessibility and performance

- `prefers-reduced-motion` / Framer Motion reduced-motion preference resolves every Lottie to a still first frame.
- Decorative animations are `aria-hidden`; explanatory animations can provide an `aria-label`.
- Hover animations do not add a second keyboard focus stop inside buttons or cards.
- Operational warnings and destructive/money-changing actions are not given distracting looping animations.
- Lottie runtime is dynamically imported rather than included in the initial server path.
- Assets use vector shapes and are kept local for predictable loading and CSP behavior.

## Shared empty-state language

The existing `EmptyState` component now selects motion by semantic icon, extending the visual language consistently into modules that were not hand-edited. Examples:

- Search / PackageSearch → search animation
- Building / Store → storefront animation
- Approval / Shield → verified-business animation
- Review / document → review-pending animation
- Wallet / bank / receipt → money-flow animation
- Team / invitations → team-collaboration animation
- Support / help → support-chat animation
- Analytics / targets → analytics-rise animation
- Calendar / time → calendar-schedule animation
- Delivery / truck → route-delivery animation

Alert/error states remain static.

## Product surfaces upgraded

- Public launch / marketing
- Marketplace
- Cart / basket feedback
- Customer and Business empty states
- Business catalogue
- Business kiosk configuration and shared kiosk screen
- Driver availability, deliveries, history and earnings states
- Admin Driver/Delivery operations
- Global notification bell and notification centers
- Account workspace chooser
- Staff/Admin/Business screens that use the shared EmptyState primitive

## Guardrail

Spotly should not animate everything merely because Lottie is available. The design rule is:

> Motion must either attract the eye to a valuable next action, explain what Spotly is doing, confirm the result of an action, or make an otherwise dead state easier to understand.

If an animation does none of those four things, it should not ship.

## Validation

- `npm run check:js` — PASS
- `npm run check:theme` — PASS (153 source files / 24 classified route patterns)
- `npm test` — PASS (148/148)
- TypeScript parser sweep — PASS (222 JS/JSX/MJS/CJS files)
- Lottie JSON schema/basic playback validation — PASS (18/18 assets)

A full local `next build` cannot be executed in this sandbox because the supplied source package intentionally excludes installed `node_modules`, and external npm package retrieval is unavailable from the execution environment. The deployment environment should run its normal `npm install` followed by `npm run build`.

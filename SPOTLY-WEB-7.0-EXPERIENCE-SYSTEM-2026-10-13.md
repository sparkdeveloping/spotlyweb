# Spotly Web 7.0 — Experience System

Release date: 2026-10-13

## Purpose

Spotly V7 keeps the production functionality built through 6.3 and rebuilds the experience layer so the platform behaves and looks like one intentional product instead of several generations of UI living together.

The implementation principle is:

> user state → intent → next action → feedback → continuity

rather than route → data → card.

## Customer Shell

The customer application now uses one shell across its primary surfaces. Desktop navigation has three zones: Spotly + global Search; Home / Activity / Saved; and location / notifications / Profile. Currency no longer consumes global navigation space and lives in Profile preferences. Mobile has five stable destinations: Home, Search, Activity, Saved and Profile.

The shell uses a 1320px discovery canvas, semantic spacing, canonical control/card/feature radii, intentional focus treatment, activity badges and reduced-motion aware transitions.

## First-run onboarding

New users receive a progressive, skippable introduction rather than landing on an unexplained service grid. The flow explains Spotly, establishes city/location, asks for useful interests, optionally captures Home/Work, and offers sign-in without forcing authentication before value is understood.

Location permission is requested only after the user explicitly chooses “Use my location.” Signed-in onboarding preferences sync to the customer profile; useful Home/Work entries are also stored as Saved places.

## Honest personalization

Home now distinguishes first visit, no-history, returning and active-activity states.

- `Again` renders only from actual completed transaction history.
- `Near you` renders only when the customer has shared precise coordinates; city-only users see `Popular in <city>`.
- `Based on your interests` renders only when onboarding preferences genuinely match live service/business data.
- active orders/rides/send/bookings/tickets surface through a `Now` accessory before generic discovery.

## Service identity

Ride, Eat, Shop, Book, Events and Send now have a bespoke Spotly visual family rather than generic outline icons floating on decorative circles. Each service combines a consistent system glyph with a dimensional/vector object and a restrained micro-animation:

- Eat: plate + subtle steam;
- Shop: Spotly shopping bag;
- Book: appointment calendar;
- Events: ticket/light object;
- Ride: vehicle + path;
- Send: parcel + path.

Generic actions such as Search, Heart, Bell, location, back and settings continue to use standard system/Lucide icons. Marketplace inventory continues to use real merchant media; V7 does not fabricate product imagery.

## Home

The asymmetric service canvas remains because it is a useful part of Spotly's identity. V7 removes duplicate global Search controls and redundant `Open ↗` labels. Live services lead; unavailable Ride/Send become subordinate city-specific launch affordances rather than advertising what Spotly cannot do.

Below the canvas, modules are data-state driven. New customers see useful discovery, returning customers may see real repeat/recent behavior, and active customers see current activity first.

## Search

Search is now an intelligence-first surface rather than an empty query form. Before typing, it can show recent searches and intent shortcuts. While searching, results remain cross-type across businesses, products, services, events and places. Zero-result states explain the problem and offer recovery through another query or location change. Loading uses content-shaped skeletons.

## Activity

Activity is presented as the customer's Spotly timeline. Orders, deliveries, bookings, tickets, Ride and Send have semantic visual identities. Needs-attention, active, upcoming and past states remain operationally separate, while empty Activity explains what will appear there and points back to exploration.

## Saved

Saved is categorized into Businesses, Products, Services, Events and Places. New/signed-out states are designed product states with education and a next action rather than blank pages.

## Profile / Account

Account now lives inside the Customer Shell. Desktop uses a coherent settings architecture for Profile, Places, Preferences, Notifications, Privacy & security, Workspaces and Help. Currency, fulfilment and language use deliberate choice controls instead of raw global dropdowns. Existing profile, phone, provider linking, notifications, privacy/data and role-workspace functionality is preserved.

## Loading, empty and failure states

V7 adds content-shaped skeletons and product-language empty states. Offline and delayed-refresh states remain visible without discarding already loaded content. The experience system explicitly supports default, hover, pressed, focus, loading, loaded, empty, error, offline, disabled, permission-denied, signed-out, partial-data, unavailable and success states.

## Motion and accessibility

Motion is tokenized around press, state, sheet and page timings rather than being invented per component. Service micro-motion and page transitions respect `prefers-reduced-motion`. Focus-visible treatment, semantic labels and keyboard navigation remain first-class release requirements.

## Cross-role normalization

V7 retains the shared portal architecture and role colors while normalizing geometry and state treatment across Business, Driver, Staff and Admin. Driver emphasizes online state, work nearby and available earnings. Business remains setup/next-action oriented. Staff remains task-first. Admin keeps dense operational tables/queues rather than adopting consumer-card visual excess.

## What V7 deliberately does not change

V7 does not replace the production transaction model, Firebase authorization architecture, Paynow integration, Ride/Send lifecycle, Driver Money, Business finance, Admin operations or subdomain SSO. Those systems remain the 6.3 production baseline and are regression-tested with V7.

## Release validation

The clean V7 source passed:

- JavaScript and React hook import integrity;
- theme safety across 221 source files and 41 classified route patterns;
- launch-readiness static audit across 96 API routes;
- V7 experience-system audit across 221 UI source files and 12 customer core files;
- 245/245 Node test cases.

`next build` and ESLint were not executed in the working container because the dependency installation toolchain was unavailable within the execution window. Vercel's clean install/build remains the final framework compiler gate.

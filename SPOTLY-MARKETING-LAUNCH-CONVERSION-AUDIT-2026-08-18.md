# Spotly Marketing Launch + Conversion Audit
## Zimbabwe-first landing page, Marketplace motion, lead generation and Admin launch control

**Audit date:** 18 August 2026  
**Source:** Spotly Web Platform 5.5.3, continuing from the full platform UX / Marketplace production package.

## Executive result

The root Spotly experience has been upgraded from a sparse launch-list page into a customer-first marketing surface designed to explain Spotly quickly, convert visitors into customers/leads, recruit businesses and Drivers without competing with the customer story, and transition cleanly into the live Marketplace when Admin decides.

This pass deliberately avoids fake social proof, fake order volume, fake testimonials or unsupported earnings claims. Trust is built from product clarity: exact locations, reviewed business access, visible fulfilment choices, structured order status and clear next actions.

## Root-domain launch control

`app/page.js` no longer hardwires the old coming-soon component. `components/public-home-router.js` reads the authoritative Platform launch settings.

Admin → Platform → Launch mode now presents these root-domain states:

- **Launch marketing page** — `spotlyafrica.com/` renders the conversion-focused Zimbabwe launch page. Marketplace may remain separately available at `/marketplace`.
- **Private beta landing** — the same product story with private-preview messaging.
- **Public marketplace** — the root domain redirects directly to `/marketplace`.
- **Maintenance** — a branded maintenance state while direct workspaces can remain available.

Choosing Public marketplace also enables the Marketplace capability. The existing `publicMode` data value remains backward-compatible; the customer-facing/Admin label was improved rather than creating a migration-only enum.

## Customer-first conversion hierarchy

The new landing page follows one primary story:

1. **Understand Spotly in seconds** — “Your city. Your shops. One place to order.”
2. **See the product** — animated commerce demo rather than abstract marketing art.
3. **Understand why it is easier** — verified access, exact locations, clear order status, configured payment choices.
4. **Understand how it works** — Search → choose exact location → build order → pickup/delivery handoff.
5. **See launch geography** — Harare first, then configured Zimbabwe launch cities.
6. **See participating businesses when available** — no fake merchants if none are configured.
7. **Choose an audience path** — Customer, Business or Driver.
8. **Convert Business owners** — search the Business directory or add a missing Business.
9. **Convert Drivers** — dedicated factual Driver proposition.
10. **Resolve objections** — concise FAQ.
11. **Repeat the primary conversion action** — early-access CTA or Marketplace CTA depending on launch state.

Customers remain visually and structurally first. Business and Driver acquisition appear later as secondary revenue/network-growth paths.

## Hero and messaging changes

The previous “Find what you need nearby. Order ahead. Pick up or get delivery.” presentation was replaced with a shorter ownership/value statement and stronger benefit language.

The hero now includes:

- Zimbabwe-first positioning;
- configured primary city;
- live launch-city selector while early access is active;
- primary conversion CTA;
- secondary “See how it works” CTA;
- trust cues without fabricated statistics;
- animated commerce-product preview.

When Marketplace is enabled, CTA language changes automatically from early access to **Explore Spotly**.

## Motion and icon language

The existing Framer Motion dependency is now used as the primary marketing-motion system.

Added motion includes:

- staged hero entrance;
- animated Spotly commerce demonstration;
- search → basket → fulfilment → Driver tracking sequence;
- semantic animated icon glyphs;
- viewport-reveal cards;
- restrained hover lift;
- animated Marketplace quantity changes;
- animated basket item insertion/removal;
- mobile basket entrance/tap response;
- Driver-status pulse;
- progress animation.

The implementation uses vector motion rather than GIFs for core product UI. This keeps assets sharp, small and theme-aware. It also honors `prefers-reduced-motion`. Branded Lottie artwork can be layered into future campaign/illustration slots, but the critical interaction language does not depend on a heavy animation player or third-party hosted assets.

Icons are semantic rather than decorative: Search, MapPin, Store, Basket, Package, Truck, Driver, Shield, Payment and Business icons consistently communicate the task being described.

## Animated commerce demonstration

The hero now visually demonstrates Spotly rather than merely describing it.

The looping demo shows:

- nearby Business discovery;
- verified/local context;
- building a basket;
- pickup versus delivery choice;
- Driver delivery progress.

Visitors can also select each demo step manually. Reduced-motion users receive the same information without perpetual motion.

## Honest empty states

The marketing site no longer relies on a large dashed “pilot businesses are being reviewed” placeholder when no featured businesses are configured.

The empty area now teaches the expected customer value through three useful cards:

- Groceries & essentials;
- Exact locations;
- Pickup or delivery.

No fictional Business names or fake customer activity are generated.

## Business lead generation

The Business section now has a deliberate dark/inverse conversion moment and includes the real Business directory finder.

Business visitors can:

- search for an existing Business;
- start claiming it;
- add a Business that is not listed.

The value proposition focuses on concrete product capabilities rather than generic “grow your business” promises:

- reviewed Business access;
- products by location;
- pickup workflow;
- delivery when enabled.

## Driver acquisition

Driver has a distinct blue visual identity and a factual proposition:

- application and approval;
- choose when to go online;
- see delivery pay before acceptance;
- clear pickup/customer handoff;
- location sharing while online;
- safety/support entry points.

The landing page does not promise guaranteed jobs or guaranteed income.

## Marketplace commerce microinteractions

`components/marketplace-app.js` was upgraded so the commerce experience matches the new marketing promise.

Product cards now provide:

- animated Add to basket action;
- explicit quantity controls after first add;
- tactile press/hover feedback;
- animated quantity values;
- success toast on first add.

Basket behavior now provides:

- animated item presence/removal;
- clearer empty-basket state;
- clearer fulfilment CTA;
- animated mobile basket button;
- transition-safe reduced-motion behavior.

Analytics events were added around selection and conversion actions.

## Conversion analytics

The marketing and Marketplace experience now emits meaningful funnel events using Spotly's existing analytics helper, including:

- `marketing_page_view`
- `marketing_primary_cta`
- `marketing_waitlist_open`
- `marketing_city_change`
- `generate_lead`
- `marketing_business_cta`
- `marketing_driver_cta`
- `marketing_audience_cta`
- `select_business`
- `add_to_cart`
- `remove_from_cart`
- `begin_checkout`

This provides a foundation for measuring the real funnel without inventing dashboard metrics in the UI.

## SEO / structured data

The root metadata now describes Spotly as a Zimbabwe local marketplace rather than a pickup-only pilot. Structured Organization data identifies Zimbabwe as the served market and uses the canonical public app URL.

## Responsive / accessibility principles

The marketing implementation preserves:

- mobile-first CTA behavior;
- a mobile sticky early-access action when Marketplace is not open;
- semantic heading structure;
- labeled navigation;
- labeled demo controls;
- keyboard-usable links/buttons;
- semantic icons paired with words;
- reduced-motion support;
- adaptive light/dark semantic theme tokens;
- no fixed white adaptive backgrounds.

## Admin launch workflow

The root experience can now be switched intentionally from Admin without a deployment/code edit.

Recommended launch progression:

1. Launch marketing page + Marketplace disabled — collect early-access leads.
2. Launch marketing page + Marketplace enabled — keep the high-conversion marketing homepage while customers can enter `/marketplace` through strong CTAs.
3. Public marketplace — make `/` enter the Marketplace directly if/when that becomes the better acquisition strategy.
4. Maintenance — emergency controlled public state.

For the initial Zimbabwe launch, option 2 is likely the strongest product posture once live ordering is ready: the root domain can keep explaining Spotly while the Marketplace is one click away.

## Files materially changed in this pass

- `app/page.js`
- `app/layout.js`
- `components/public-home-router.js` (new)
- `components/coming-soon-app.js`
- `components/marketplace-app.js`
- `components/admin-app.js`
- `tests/marketing-launch-integrity.test.mjs` (new)

## Validation

Final source validation in this environment:

- `npm run check:js` — PASS
- `npm run check:theme` — PASS, 152 source files / 24 route patterns
- `npm test` — PASS, 143/143
- TypeScript parser sweep — PASS, 211 JS/JSX files

The local sandbox does not currently contain executable `next` / `eslint` packages and package installation is unavailable in this runtime, so `next build` and ESLint could not be truthfully marked as executed here. The parser sweep was run specifically to catch JSX/ECMAScript parse failures before packaging. Vercel remains the authoritative production Next build environment.

## Post-deploy acceptance checklist

- Verify Admin → Platform can switch all four public modes.
- Keep Public mode = Launch marketing page while validating lead conversion.
- Test early-access form on mobile and desktop.
- Confirm waitlist entries appear in Admin Content/Growth.
- Confirm `generate_lead` appears in analytics.
- Enable Marketplace and verify landing CTA changes to Explore Spotly.
- Add a product to basket, alter quantity, open basket and begin checkout.
- Verify reduced-motion OS preference disables perpetual/entrance motion where required.
- Review landing on common Zimbabwe Android viewport widths and constrained mobile data.
- Populate only genuinely approved Featured Business IDs; do not add synthetic social proof.

## Final product principle

The public page should not try to explain every Spotly feature at once.

It should make a visitor feel three things in order:

**I understand what this is.**  
**This removes friction I already recognize.**  
**I know exactly what to do next.**

The new landing and Marketplace interaction language are organized around that sequence.

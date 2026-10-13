# Spotly Customer Marketplace 2.0 — 2026-10-13

## Purpose

This release converts the customer root from launch/marketing presentation into the actual Spotly marketplace surface while preserving the existing production Firebase, auth, checkout, payment, delivery, business, driver, staff, and admin systems.

## Customer experience

- `spotlyafrica.com/` is the usable customer marketplace.
- Default Home uses an expressive service canvas instead of an oversized marketing hero.
- Working services are prioritized; future Ride/Send surfaces remain feature-gated until operations are ready.
- Eat, Shop, Book and Events filter the live verified business directory by business archetype.
- Search, Saved and Activity remain backed by the existing customer data flows.
- Business detail, branch selection, published catalogues, baskets, checkout, pickup/delivery, payment initiation and delivery tracking remain connected to the existing backend.
- Customer order notifications now deep-link to `/?view=activity`.
- Direct service URLs `/eat`, `/shop`, `/book`, `/events`, `/ride`, and `/send` resolve into the customer product.

## Production honesty

Ride and peer-to-peer Send are not falsely simulated. The UI is present and can be enabled through platform settings once the corresponding operational backend is ready:

- `settings.mobility.ridesEnabled === true` or `settings.launch.ridesEnabled === true`
- `settings.commerce.peerDeliveryEnabled === true` or `settings.launch.sendEnabled === true`

Until then, those service entries display a customer-safe area rollout message rather than a fake request flow.

## Design system updates

- Customer canonical violet is `#6657D9`.
- Web typography now defaults to the platform/system UI stack instead of Aptos-first styling.
- Spotly Staff canonical role color is black/neutral instead of amber.
- New Spotly service canvas gradients and restrained route/orbit motifs are implemented in CSS without AI-generated UI artwork.

## Validation completed in this workspace

- JavaScript-only / React hook integrity script passes.
- All `app/**/*.js` and `components/**/*.js` files pass TypeScript parser syntax validation with JSX preservation.

A full dependency-backed `next build` still needs to run in CI/Vercel because this execution environment could not complete `npm ci` within the available tool transport window.

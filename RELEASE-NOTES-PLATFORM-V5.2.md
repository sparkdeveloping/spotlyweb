# Spotly Platform 5.2 — Theme Integrity

## Main changes

- Complete semantic light/dark token architecture
- Guaranteed root and workspace accent/foreground pairs
- Controlled form styling; no undefined `.input` class remains
- Resolved system theme and pre-hydration theme application
- Stronger text, control-border, and focus contrast
- Semantic Buttons, Badges, Cards, overlays, tables, and adaptive surfaces
- Route-level adaptive/fixed-dark policy with static enforcement
- Waitlist phone persistence, explicit consent, and validation
- Truthful claim save states and evidence deletion
- Idempotent stock and pickup-capacity release for terminal unfulfilled orders
- Static theme safety and contrast tests

## Release caveat

The source/test checks pass, but the package mirror prevented dependency installation. This package must complete lint, Next.js build, browser visual regression, and manual accessibility testing on staging before promotion.

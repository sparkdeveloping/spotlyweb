# Spotly Approved Branding Rollout — 29 October 2026

## Source of truth
The owner-supplied Spotly master branding archive was used as the source for vector artwork and brand palette. Master font software is not distributed publicly.

## Delivery
- Public /branding page: core identity, Spotly Business, Spotly Driver, Bite, Shopper, Book, Live, Ride, Send, color swatches, usage and individual SVG downloads.
- /api/branding/assets/[name] only serves a fixed approved SVG allowlist.
- /api/branding/download creates a ZIP from that same allowlist and official color JSON without unlicensed third-party materials.
- Branding portal route is canonicalized to the apex site and included in sitemap/robots.
- Existing customer first-access page uses the approved horizontal logo; customer, Business, Driver and protected workspaces use approved symbols.
- Root CSS exposes official branding tokens separately from contrast-aware UI semantic colors.
- PWA manifest includes an official SVG icon and Business/Driver identity theme colors.
- Brand kit source and archive format are covered by node:test, included in prebuild checks.

## Why brand colors and UI control colors differ
The official primary color values are Spotly #6657D9, Business #10C981, Driver #2F80FF. UI controls retain accessible dark/light foreground-background token pairs. Exact brand hues are used for marks and service marketing; do not substitute raw green/blue as the sole color for low-contrast text.

## Release QA
- Run existing prebuild and new brand-kit tests and ensure Next.js production build succeeds.
- Verify /branding, all nine full lockups, the three standalone identity icons, ZIP download and cross-subdomain /branding redirects.
- Verify customer landing in first-access, public-marketplace, light and dark display modes.
- Inspect Business and Driver marketing, portal login, workspace switching, and service tiles.
- Check mobile widths and keyboard accessibility.

## Known follow-on items
- Existing legacy raster PNG icons and Open Graph preview PNG are still in public assets for compatibility. The authoritative SVG source is updated; regenerate 192/512/maskable PNGs and Apple touch/OG artwork in a separate asset-specific release after visual testing.
- GT Walsheim Pro is a licensed commercial typeface. The outlined logos need no font, and global CSS uses a safe font stack where GT Walsheim Pro is not separately installed. Do not put font binaries in a public partner ZIP.
- Legacy public /brand/*.svg URLs are retained temporarily to avoid breaking external references; new UI uses the approved /api/branding/assets/ identities.
- This is a brand/UI integration audit, not a security, payments, or operational functionality certification.

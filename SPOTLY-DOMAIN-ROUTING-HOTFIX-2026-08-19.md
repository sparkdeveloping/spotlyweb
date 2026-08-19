# Spotly Domain Routing Hotfix — 19 August 2026

## Problem

`spotlyafrica.com` could enter `ERR_TOO_MANY_REDIRECTS` when application code canonicalized `www.spotlyafrica.com` to the apex while Vercel's domain configuration canonicalized in the opposite direction (or otherwise applied a domain-level redirect).

The previous proxy also only rewrote the exact portal root and left old `/business/...`, `/admin/...`, `/driver/...`, and `/staff/...` prefixes visible on dedicated portal hosts.

## Fix

- The application no longer redirects between `spotlyafrica.com` and `www.spotlyafrica.com`. Both are accepted as customer hosts. Canonicalization belongs to Vercel Domains, where only one redirect direction should be configured.
- Legacy apex paths redirect cleanly:
  - `spotlyafrica.com/business` -> `business.spotlyafrica.com/`
  - `spotlyafrica.com/business/orders` -> `business.spotlyafrica.com/orders`
  - same pattern for Admin, Driver, and Staff.
- Dedicated portal hosts expose clean URLs:
  - `business.spotlyafrica.com/` internally renders `/business`
  - `business.spotlyafrica.com/orders` internally renders `/business/orders`
  - `/business` and `/business/...` on the Business host are permanently cleaned to `/` and `/<section>`.
- APIs, authentication, account/support callbacks, static assets, service worker, and payment callback routes remain unprefixed on the active origin.
- Vercel preview and local domains remain untouched.

## Vercel configuration

Attach these hostnames to the same `spotlyweb` project:

- `spotlyafrica.com`
- `www.spotlyafrica.com`
- `business.spotlyafrica.com`
- `admin.spotlyafrica.com`
- `driver.spotlyafrica.com`
- `staff.spotlyafrica.com`

For `spotlyafrica.com` and `www.spotlyafrica.com`, configure **at most one** Vercel redirect direction. Do not configure apex -> www and www -> apex simultaneously. The application itself intentionally performs neither redirect.

## Firebase Authentication

All production hostnames used for sign-in must be present in Firebase Authentication -> Settings -> Authorized domains.

## Expected public URLs

- Customer / Marketing: `https://spotlyafrica.com/`
- Marketplace: `https://spotlyafrica.com/marketplace`
- Business: `https://business.spotlyafrica.com/`
- Business Orders: `https://business.spotlyafrica.com/orders`
- Admin: `https://admin.spotlyafrica.com/`
- Driver: `https://driver.spotlyafrica.com/`
- Staff: `https://staff.spotlyafrica.com/`

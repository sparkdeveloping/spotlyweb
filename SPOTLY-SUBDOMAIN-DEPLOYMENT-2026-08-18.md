# Spotly production subdomain architecture

## Canonical production surfaces

- `spotlyafrica.com` — customer marketing, Marketplace, customer account and shared public/legal routes.
- `business.spotlyafrica.com` — Spotly Business.
- `admin.spotlyafrica.com` — Spotly Admin.
- `driver.spotlyafrica.com` — Spotly Driver.
- `staff.spotlyafrica.com` — Spotly Staff.
- `www.spotlyafrica.com` — permanent redirect to the apex customer domain.

## Runtime routing

Next.js 16 `proxy.js` is now hostname-aware. A request to the root of each product subdomain is internally rewritten to the existing portal route, so the current applications do not need to be forked into separate repositories. Existing legacy links such as `spotlyafrica.com/business/...` permanently redirect to the corresponding dedicated hostname while preserving path and query parameters.

Vercel preview URLs and localhost are deliberately excluded from canonical-host redirects so preview deployments remain testable.

## Authentication note

Firebase browser persistence is origin-scoped. Spotly therefore does not attempt to copy browser auth state between subdomains. Each portal can authenticate on its own hostname using the existing `/login` flow. This avoids unsafe token transport in URLs and keeps each operational surface isolated.

## Vercel domains to attach to the existing `spotlyweb` project

Attach these production domains to project `spotlyweb`:

- `spotlyafrica.com`
- `www.spotlyafrica.com`
- `business.spotlyafrica.com`
- `admin.spotlyafrica.com`
- `driver.spotlyafrica.com`
- `staff.spotlyafrica.com`

The apex and `www` domains are already attached according to the connected Vercel project. The four product subdomains still need to be added in Vercel because the currently exposed Vercel connector can inspect projects/deployments but does not expose a domain-attachment mutation.

Because the domain is managed through Vercel, adding each subdomain from Project → Settings → Domains should provision the necessary Vercel DNS record automatically when the zone uses Vercel DNS. Verify each domain reports `Valid Configuration` before launch.

## Firebase

Add all production product hosts to Firebase Authentication → Settings → Authorized domains if they are not already present:

- `spotlyafrica.com`
- `business.spotlyafrica.com`
- `admin.spotlyafrica.com`
- `driver.spotlyafrica.com`
- `staff.spotlyafrica.com`

This is especially important for OAuth/provider sign-in and redirect flows.

## Validation

- `node --check proxy.js` — PASS
- `node --check lib/spotly-domains.js` — PASS
- subdomain routing tests — PASS
- `npm run check:js` — PASS
- `npm run check:theme` — PASS
- full test suite — PASS

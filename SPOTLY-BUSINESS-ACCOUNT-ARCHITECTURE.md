# Spotly Business Account Architecture

## Core model

Spotly Business has two scopes:

1. **Account scope** — the user's portfolio, claims, invitations and access relationships.
2. **Business scope** — day-to-day operation of one selected business and its locations.

A user can belong to unrelated organizations without exposing those relationships to another business.

## Account routes

| Route | Scope | Purpose | Business ID required |
|---|---|---|---|
| `/business` | Account | Portfolio + cross-business attention | No |
| `/business/claims` | Account | Claims/applications | No |
| `/business/invitations` | Account | Pending invitations | No |
| `/business/access` | Account | Effective roles/scopes | No |

## Operational routes

| Route | Scope | Purpose |
|---|---|---|
| `/business/today?business=<id>` | Business | Daily operating view |
| `/business/setup?business=<id>` | Business | Guided operating setup |
| `/business/activity?business=<id>` | Business | Orders/bookings/activity |
| `/business/catalog?business=<id>` | Business | Catalogue/products |
| `/business/branches?business=<id>` | Business | Locations |
| `/business/kiosk?business=<id>` | Business | Capability-specific kiosk |
| `/business/insights?business=<id>` | Business | Business insights |
| `/business/promotions?business=<id>` | Business | Promotions |
| `/business/staff?business=<id>` | Business | Team |
| `/business/finance?business=<id>` | Business | Money |
| `/business/support?business=<id>` | Business | Help/support |
| `/business/settings?business=<id>` | Business | Business settings |

Exact record state remains query-addressable, e.g. `order=<orderId>` and `product=<productId>`.

## Business context precedence

1. Explicit URL `business` parameter.
2. Most recently remembered authorized business.
3. First accessible business returned by the authoritative portfolio.

A remembered value never overrides an explicit URL value.

## Portfolio resolution

`GET /api/business/portfolio` resolves the account's effective business access on the server, including:

- organization-wide ownership/management
- direct business ownership/access
- branch-limited membership
- active membership status/expiry
- claims
- invitations
- role and scope summaries

The client does not infer the complete portfolio solely from `membership.businessId` or `membership.businessIds`.

## UX rules

- Claims never disappear because another business was approved.
- Invitations have a permanent centre.
- Add/claim another business remains visible.
- A single-business user can open their business immediately without learning a complex portfolio system.
- A many-business user can search and switch by business, organization or role.
- Cross-business attention contains actionable records, not generic metrics.
- Business-level APIs never expose the user's unrelated portfolio.

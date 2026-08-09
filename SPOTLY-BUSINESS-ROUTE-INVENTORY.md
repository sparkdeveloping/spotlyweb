# Spotly Business Route Inventory

## Account-level routes

| Route | Scope | Purpose | Auth |
|---|---|---|---|
| `/business` | Account | Portfolio, attention, businesses | Business account sign-in |
| `/business/claims` | Account | Claims/applications | Business account sign-in |
| `/business/invitations` | Account | Invitations | Business account sign-in |
| `/business/access` | Account | Roles/scopes | Business account sign-in |

## Selected-business routes

All selected-business routes require an authorized `business` context and enforce permissions again at API/rules boundaries.

| Route | Purpose |
|---|---|
| `/business/today?business=<id>` | Daily operations |
| `/business/setup?business=<id>` | Setup centre |
| `/business/activity?business=<id>` | Orders/bookings/activity |
| `/business/catalog?business=<id>` | Products/catalogue |
| `/business/branches?business=<id>` | Locations |
| `/business/kiosk?business=<id>` | Kiosk configuration/view |
| `/business/insights?business=<id>` | Insights |
| `/business/promotions?business=<id>` | Promotions |
| `/business/staff?business=<id>` | Team |
| `/business/finance?business=<id>` | Money |
| `/business/support?business=<id>` | Support |
| `/business/settings?business=<id>` | Business settings |

Exact records preserve additional query state such as `order=<id>` and `product=<id>` where supported.

## Supporting routes outside `/business`

| Route | Purpose |
|---|---|
| `/claim` | Start a new claim/application |
| `/claim/status/<id>` | Exact claim status |
| `/staff/catalogue` | Spotly field product capture/review |
| `/admin/content` | Master-product governance |
| `/admin/finance` | Settlement and merchant reconciliation |

## Relevant Business APIs

- `/api/business/portfolio`
- `/api/business/catalog-library`
- `/api/business/media/enhance-product`
- `/api/business/media/approve-product-image`
- `/api/business/money`
- `/api/business-invitations/decline`
- existing hardened business-team/order/support APIs

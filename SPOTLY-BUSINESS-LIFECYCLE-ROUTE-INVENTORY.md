# Spotly Business 5.5 — Lifecycle Route Inventory

## Account-level

| Route | Classification | Notes |
|---|---|---|
| `/business` | Account | Multi-business Portfolio; lifecycle-aware CTAs |
| `/business/claims` | Account | Business-access claims/status |
| `/business/invitations` | Account | Pending access invitations |
| `/business/access` | Account | Current user's roles/scopes |

## Selected business — shared/pre-live preparation

| Route | Pre-live | Live | Purpose |
|---|---|---|---|
| `/business/launch?business=<id>` | Primary home | Status/history | Lifecycle + Launch Checklist |
| `/business/setup?business=<id>&step=<id>` | Business basics | Editable Business details | Deterministic foundational setup |
| `/business/catalog?business=<id>` | Available | Available | Prepare/operate catalogue |
| `/business/branches?business=<id>` | Available | Available | Prepare/operate locations |
| `/business/staff?business=<id>` | Available in prepare | Available | Team access |
| `/business/finance?business=<id>` | Available when relevant | Available | Payments, settlement, ledger |
| `/business/support?business=<id>` | Always available | Always available | Help/support |
| `/business/settings?business=<id>` | Reduced/preparation-relevant | Available | Profile/operations/settings |

## Operational routes — locked before live

| Route | Pre-live | Live |
|---|---|---|
| `/business/today?business=<id>` | Locked/Launch explanation | Operational home |
| `/business/activity?business=<id>` | Locked | Orders/activity |
| `/business/insights?business=<id>` | Locked | Insights |
| `/business/promotions?business=<id>` | Locked | Promotions |
| `/business/kiosk?business=<id>` | Locked | Kiosk configuration |
| `/business/kiosk/live` | Lifecycle/business controls still apply to its intended live use | Live Kiosk surface |

## Lifecycle APIs

| Route | Authority |
|---|---|
| `POST /api/business/launch-review/submit` | Business owner/manager-scoped server action |
| `POST /api/business/launch-review/invalidate` | Business update permission; launch-critical changes |
| `POST /api/admin/business-launch-reviews/decision` | Platform Admin Business authority |
| `POST /api/admin/business-lifecycle` | Trusted Admin suspension/resume |
| `/api/business/branches` | Trusted branch structural operations |

## Routing rule

Explicit selected-business URL context wins over remembered local state. Account routes do not require a business query parameter.

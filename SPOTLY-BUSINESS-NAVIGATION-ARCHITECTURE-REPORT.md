# Spotly Business 5.5 — Navigation Architecture Report

## Persistent shell

`app/business/layout.js` now owns the persistent Business shell:

```text
AuthGate
  BusinessDataProvider
    BusinessPortalFrame / PortalShell
      changing route content
```

The Business provider and sidebar no longer belong to each section page. Products → Money → Team → Locations can therefore change inner content without intentionally rebuilding the entire Business account context.

## Sidebar flicker fix

The Business frame keeps `stableNavigation`. During a business-context switch, transient loading/null data does not collapse the sidebar into a smaller setup menu. Loading is a separate state from `setup incomplete`.

## Lifecycle-gated navigation

Navigation comes from the shared lifecycle `navigationMode`:

- `access`
- `basics`
- `prelaunch`
- `live`
- `suspended`

Pre-live menus expose preparation tools but not active operational tools.

## Explicit business URLs

`lib/business-routing.js` provides the canonical `businessHref()` helper.

Selected-business routes preserve `business=<id>`:

- Launch Checklist
- Business Details/setup
- Products
- Orders/activity
- Locations
- Team
- Money
- Help
- Settings
- Kiosk/Insights/Promotions when available

The URL remains authoritative over remembered local state.

## Business switching

The switcher routes according to lifecycle:

- preparing/reviewing → Launch Checklist;
- live/paused → Today;
- suspended → Business status/Launch page.

It does not always force Today.

## Account routes

Portfolio, Claims, Invitations and Access remain account-level and do not require selected-business query state.

## Loading and errors

- Loading keeps the shell stable and shows a content loading state.
- Backend errors are not converted into “no businesses” or “setup not started.”
- Unauthorized/missing selected business context is handled separately from lifecycle state.

## Customer-public navigation integrity

Marketplace discovery now uses customer-live business search rather than the broad business directory search used by claiming. This keeps provisional claimable listings available for claims while preventing them from behaving like live merchants.

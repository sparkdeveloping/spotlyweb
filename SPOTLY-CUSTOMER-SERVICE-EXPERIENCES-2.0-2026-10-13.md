# Spotly Customer Service Experiences 2.0 — Web 5.9.0

This release turns Eat, Shop, Book and Events into first-class customer destinations instead of redirect aliases for the generic marketplace.

## Dedicated service destinations

- `/eat` — restaurant and dish discovery with delivery, pickup, open-now, category and deal filtering.
- `/shop` — store and product discovery with fulfilment, category, stock-aware item cards and deal discovery.
- `/book` — services, stays and activities with duration context and direct continuity into the existing request flow.
- `/events` — upcoming event discovery with Today, Tonight, Weekend and Free filters, capacity context and ticket continuity.
- `/ride` and `/send` remain visible, canonical destinations but are still operationally gated until their real backends are enabled.

## Live service feed

`/api/public/service-feed` aggregates only public/live businesses, public branches and published offerings. It is read-only, rate-limited and avoids composite-index dependencies. It derives customer-safe operational signals from public branch configuration, including open-now, pickup availability, delivery availability and earliest pickup context.

The feed supports:

- city and area context
- service-specific business filtering
- cross-business offering discovery
- category facets
- fulfilment facets
- event timing filters
- featured placements
- item pagination
- server-side search

## Transaction continuity

Service discovery does not create a second commerce stack. Opening a business or offering enters the existing production conversion layer:

- business/location selection
- live branch catalogue
- item/service/event detail
- basket and checkout for commerce
- appointment/booking/ticket request flow
- Paynow where applicable
- Saved
- Activity
- cancellation and support

## Customer experience rules

- Real business and merchant imagery is preferred; no generated marketplace inventory is inserted.
- Ride and Send do not expose fake request flows.
- Availability language is only shown when it can be derived from published operational data.
- Dedicated service URLs are canonical and indexable independently.

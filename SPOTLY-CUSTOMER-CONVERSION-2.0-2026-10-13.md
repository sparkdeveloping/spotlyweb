# Spotly Customer Conversion 2.0 — Production implementation

**Release:** Spotly Web Platform 5.7.0  
**Date:** 2026-10-13

## Scope

This release implements the customer conversion layer on top of the live Spotly marketplace rather than replacing production Firebase, auth, payment, delivery, Business, Driver, Staff or Admin systems.

The implemented customer path is now:

```text
Spotly Home / Search
  → live business / place
  → exact branch
  → published product / menu item / service / listing / event
  → item detail
  → basket OR appointment / booking / ticket request
  → checkout / Paynow where applicable
  → confirmation
  → Activity
```

## Commerce preserved

Existing pickup and delivery ordering remains live and server-authoritative:

- exact-branch catalogue loading
- branch-specific product offers
- basket persistence
- pickup availability and slot reservations
- delivery address + pin capture
- supported payment methods
- Paynow initiation
- driver delivery dispatch/tracking
- customer delivery PIN
- Activity continuity

## Newly implemented service conversion

### Events / tickets

- Published event/ticket offerings open a real detail view.
- Customers can choose ticket quantity up to server-authoritative remaining capacity.
- Ticket capacity is reserved transactionally.
- Free / request-first tickets can be submitted without payment.
- Paid tickets can continue directly into the existing Paynow flow.
- Failed/expired pre-payment states release reservations through the existing reservation system.
- Business Activity can confirm and issue tickets.
- Issued tickets receive a server-generated entry code visible in Customer Activity.

### Appointments

- Published service offerings open a detail view with duration and price.
- Customer chooses preferred date/time, location and contact details.
- A real `requested` appointment record is created in the existing `orders` collection.
- Business Activity receives the request and can confirm, check in and complete it using its existing business-type workflow.
- Customer Activity shows the request and schedule.

Appointments are requests, not falsely auto-confirmed availability. A future availability engine can replace this request-first behavior without changing the customer Activity model.

### Accommodation / activities bookings

- Published listings open a detail view with capacity and pricing.
- Customer chooses dates, guest count, location and notes.
- A real booking request is created and appears immediately in both Customer Activity and Business Activity.
- Business can confirm, mark ready, check in and complete it using the existing workflow.

## Server integrity

`POST /api/customer/transactions/create` now provides a fixed-purpose server operation for tickets, appointments and bookings. It:

- authenticates the customer;
- rate limits requests;
- uses idempotency locks;
- rechecks business live state inside the Firestore transaction;
- rechecks branch publication/state inside the transaction;
- rechecks offering publication/availability/branch assignment inside the transaction;
- re-reads server-side price inside the transaction;
- validates supported currency;
- validates capacity and ticket quantity;
- creates the operational record in the existing `orders` domain;
- writes order events and customer notifications;
- reserves ticket quantity transactionally;
- keeps payment authority in the existing payment subsystem.

The idempotency collection `customerTransactionRequests` is explicitly server-only in Firestore rules.

## Customer Activity

Activity now unifies:

- pickup orders;
- deliveries;
- tickets;
- appointments;
- bookings.

It supports service filters and direct deep links. Eligible unpaid/unfulfilled activity can be cancelled from Customer Activity; the server releases inventory reservations and applies the existing cancellation rules.

Payment notifications now return customers to Activity instead of the legacy account/order surface.

## Shareable routes

The following customer routes resolve into the live marketplace state:

- `/activity`
- `/activity/<id>`
- `/saved`
- `/search`
- `/place/<businessId>`
- `/item/<itemId>?business=<businessId>`
- `/order/<id>`

The existing service routes remain:

- `/eat`
- `/shop`
- `/book`
- `/events`
- `/ride`
- `/send`

## Production honesty

Passenger Ride and peer-to-peer Send remain feature-gated until their operational backends exist. This release does not fake dispatch or ride transactions.

## Validation

Completed in the implementation workspace:

- `node scripts/check-javascript.mjs` — passed
- `node scripts/theme-safety.mjs` — passed
- full `node --test` — **181 / 181 passed**
- targeted customer conversion/security tests — passed
- cross-subdomain routing tests — passed

A dependency-backed `next build` must still run in CI/Vercel because dependency installation could not complete in the available execution environment.

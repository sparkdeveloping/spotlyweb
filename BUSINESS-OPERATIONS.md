# Spotly Business operations guide

Release: 4.0.0

This release is designed for controlled business onboarding before the public customer marketplace is fully released.

## First-time business journey

1. Create a Spotly account with email and password.
2. Open `/claim` and search the Firebase directory.
3. Select the business **brand** first.
4. Select the exact location or locations being claimed.
5. Confirm known information, correct inaccuracies, state authority, and upload evidence.
6. Submit the claim.
7. Open `/business/setup` and complete the guided setup.
8. Spotly generates a workspace based on the business type and customer workflows.
9. Complete the launch-readiness items.
10. Request publication review.

A user adding a missing business creates the organization, business brand, first location, claim, and membership as separate but related records.

## Setup before operations

Until setup is complete, the business sees only:

- Continue setup
- Home
- Help & support
- Account & access

The setup centre covers:

- business identity and type
- operating model
- first exact location
- relevant customer workflows
- relevant starter content
- final review and workspace preparation

Finance, team, advanced location controls, reports, and other operational tools are intentionally hidden until the user understands the business structure.

## Adaptive workspace routes

The route remains consistent while labels and screens adapt to the business type.

| Route | Adaptive purpose |
|---|---|
| `/business/setup` | Guided, resumable setup centre |
| `/business` | Focused home, readiness, and recommended next action |
| `/business/activity` | Orders, ticket sales, appointments, bookings, or enquiries |
| `/business/catalog` | Products, menu items, events/tickets, services, listings, or offerings |
| `/business/branches` | Locations, venues, properties, offices, or service bases |
| `/business/kiosk` | Shared-device pickup or arrival/check-in workflow |
| `/business/insights` | Activity, value, completion, cancellation, offering, and location signals |
| `/business/promotions` | Audience, offering, location, schedule, limits, and activation |
| `/business/staff` | Invitations, roles, location scope, permissions, and access review |
| `/business/finance` | Customer methods, settlement, legal records, balances, and payouts |
| `/business/support` | Live support and role-relevant help |
| `/business/settings` | Brand profile, media, operations, notifications, readiness, and review |

## Brand and location structure

```text
Organization
└── Business brand
    ├── Exact location A
    ├── Exact location B
    └── Exact location C
```

The business selector changes the brand. The location selector narrows operational data. Location-scoped staff see only assigned records.

## Operating models

- One physical location
- Several physical locations
- Online only
- Mobile/at-customer service

A single-location business does not see unnecessary multi-location navigation. A multi-location owner can add locations, copy settings, assign staff, and compare location performance.

## Grocery and retail operations

Supported activity progression:

```text
awaiting payment → submitted → accepted → preparing → ready for pickup → picked up
```

Businesses can:

- manage products and branch availability
- configure pickup eligibility
- record stock state
- propose substitutions
- record manual payment
- add operational notes
- cancel with a reason
- confirm pickup completion
- run pickup-arrival kiosk mode

## Restaurant and food operations

- menu items instead of generic products
- preparation and collection states
- location availability
- customer pickup notes
- collection-order kiosk configuration

## Events and ticketing

- event and ticket-type records
- venue assignment
- date, time, capacity, and price
- ticket-sale activity
- attendee admission/check-in kiosk

## Appointments and services

- service duration and capacity
- exact service locations
- staff/location access
- appointment activity and arrival kiosk

## Accommodation and activities

- properties or activity locations
- bookable listings
- capacity and booking activity
- guest/participant arrival kiosk

## Team access

Default roles include:

- organization owner
- business owner
- business manager
- location manager
- activity/order staff
- catalogue manager
- finance manager
- analyst
- custom role

Owners and authorized business managers can grant business-wide access. Scoped managers must choose locations. View-only users cannot invite, modify, resend, or revoke access.

Invitations:

- validate the recipient email
- expire after 14 days
- preserve existing business memberships
- merge new branch and permission access safely
- remain visible until accepted or revoked

## Payments

Payment setup is progressive:

1. Accepted currencies and customer methods
2. Payment recipient, payout cadence, and destination
3. Verified legal, tax, and invoice details

USD and ZiG are supported. Configurable methods include cash, bank transfer, Paynow, EcoCash, OneMoney, and card. Online provider credentials and policies remain production prerequisites.

## Kiosk

Kiosk is a separate full-screen route intended for shared devices. It hides the wider business portal and supports an optional staff PIN to exit.

Current complete modes:

- pickup arrival
- ticket check-in
- appointment/guest arrival

Unattended self-ordering remains hidden until its full checkout and device-security requirements are implemented.

## Data and starter content

Starter templates prevent empty setup but do not create verified commercial data. Zimbabwe reference items are inactive and contain no guessed prices, stock, barcodes, or copied images. The business must confirm every item before publication.

## Readiness and publication

Readiness adapts to the business type and checks:

- public brand profile
- at least one usable location where required
- relevant published offerings
- applicable payment configuration
- support and customer guidance
- verification status

Ownership approval and public publication are separate. Administrators can approve publication or return a specific correction request.

## Pilot checklist

Before inviting real businesses:

- run directory version 4 migration
- inspect brand/location relationships
- test every business type from setup to readiness
- test location-scoped roles
- verify catalogues and source rights
- configure support contacts and help videos
- test payment sandbox behavior
- deploy and test production rules
- run mobile, tablet, desktop, keyboard, reduced-motion, and screen-reader QA

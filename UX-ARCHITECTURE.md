# Spotly adaptive business experience

Release: 4.0.0

## Product principle

Spotly should complete most of the setup work before asking the business owner to act. The interface therefore follows five rules:

1. **Start with intent, not settings.** A new owner confirms the business, its type, and its first real location before seeing finance, team, reports, or operational controls.
2. **Separate the brand from the place.** `OK Zimbabwe` is the business. `Bulawayo Hillside` is a location belonging to it. The same rule applies to venues, properties, offices, and mobile service bases.
3. **Reveal tools only when relevant.** A grocery store sees products, pickup, inventory, and substitutions. A ticketing business sees events, tickets, attendees, and check-in. A profile-only business does not see payment or stock controls.
4. **Always show the next useful action.** Setup, empty states, dashboards, and review screens explain what happened, why it matters, and what the user should do next.
5. **Confirm meaningful work clearly.** Important writes use a full-screen processing state, staged progress, a success or error result, and one clear exit action.

## Guided setup

The setup centre is a resumable multi-step flow:

1. **Confirm the business**
   - Trading/brand name
   - Optional legal name
   - Business type
   - Category and public description
2. **Choose the operating model**
   - One physical location
   - Several physical locations
   - Online only
   - Mobile/at-customer service
3. **Confirm the first location**
   - Short location name
   - City/town
   - Address
   - Location contact details
   - Public visibility
4. **Choose customer workflows**
   - Only capabilities that fit the selected business type
5. **Load useful starter content**
   - Relevant catalogue/menu/event/service/listing templates
   - Imported drafts remain inactive until the business confirms them
6. **Review and prepare the workspace**
   - Spotly saves the brand, location, operations, and starter data
   - The workspace opens with one recommended next action

`Save and leave` saves the current step and returns to business home. `Save and continue` saves the current step and advances. The final action marks onboarding complete.

## Adaptive business types

### Shop or grocery store

- Products
- Inventory and customer availability
- Branch assignment
- Pickup orders and substitutions
- Pickup check-in kiosk
- Promotions and payments

### Restaurant, café, or food business

- Menu items
- Preparation and pickup
- Location availability
- Collection ordering kiosk configuration
- Promotions and payments

### Events and ticketing

- Events and ticket types
- Venues
- Ticket sales
- Attendee check-in kiosk
- Capacity, dates, and pricing

### Appointments and services

- Services
- Locations and staff access
- Appointment activity
- Duration and capacity
- Appointment check-in kiosk

### Accommodation and activities

- Bookable listings
- Properties or activity locations
- Capacity and booking activity
- Guest check-in kiosk

### Business profile only

- Complete public profile
- Locations
- Offerings and enquiries
- No unnecessary inventory, pickup, or finance controls

## Navigation model

Before setup is complete, navigation remains deliberately small:

- Continue setup
- Home
- Help & support
- Account & access

After setup, navigation is generated from the business capabilities. Location management appears when the business has multiple locations or explicitly chooses a multi-location model.

## Business and location selection

The workspace context switcher has separate controls:

- **Business**: the brand or operation the user belongs to
- **Location**: the exact branch, venue, property, office, or service base

The selected business and location persist per device. Staff with scoped access see only their assigned locations. Owners and authorized managers can view all locations.

## Kiosk model

Kiosk is a focused, shared-device mode. Supported workflows are selected from the business capabilities:

- Pickup arrival
- Ticket admission
- Appointment arrival
- Accommodation/activity arrival

The full-screen kiosk hides the wider portal. A staff PIN option can be enabled to leave kiosk mode. Unattended self-ordering is not exposed until its complete checkout and device-control requirements are implemented.

## Data migration

Directory version 4 converts legacy branch-as-business records into:

```text
Organization
└── Business brand
    ├── Location A
    ├── Location B
    └── Location C
```

The protected administrator seed route:

- creates one business record per brand
- creates exact locations in the `branches` collection
- creates organization records
- archives legacy duplicate branch-as-business records
- migrates related memberships and claims where possible
- preserves verified, claimed, owner, and public state
- adds business type, capabilities, and operating model

After deployment, a Super Administrator must open `/admin/businesses` and run **Upgrade / refresh directory**.

## Product and catalogue references

Starter content is designed as reviewable scaffolding, not scraped live inventory:

- generic templates cover grocery, restaurant, ticket, appointment, and bookable-listing use cases
- Zimbabwe reference templates use product and brand names found on official manufacturer or retailer pages
- imported records have no copied images, guessed prices, stock quantities, or barcodes
- reference items remain inactive and marked for business review
- the claiming business must verify naming, packaging, price, availability, rights, and branch assignment before publication

## Admin synchronization

The administrator portal now treats business brands and exact locations separately. Administrators can:

- create a brand and first location in a guided two-step form
- edit brand-level information without overwriting location data
- inspect all locations attached to a brand
- run the directory v4 migration
- review claims and publication readiness
- enter audited support view
- configure launch, verification, payment, support, language, content, and legal settings

## Customer synchronization

The private marketplace now:

- lists business brands instead of duplicate branch records
- loads exact locations only after a brand is selected
- narrows availability by location
- shows pickup checkout only for pickup-capable businesses
- shows published offerings for ticketing, appointments, accommodation, activities, and profile businesses without exposing unfinished transaction controls
- keeps customer actions staged behind administrator and business readiness checks

## Accessibility and interaction basis

The setup flow follows established multi-page form guidance:

- logical groups rather than one overwhelming form
- visible step number and percentage
- repeatable context and instructions
- optional information clearly marked
- no forced completion deadline
- errors next to the action that needs correction
- status messages that identify success or failure
- keyboard-operable buttons, forms, tabs, and dialogs
- reduced-motion-compatible Framer Motion behavior through the browser preference

## Release boundary

Version 4 is intended to make the business portal coherent enough for controlled merchant onboarding. It does not claim that provisional records, catalogue references, payment providers, legal details, production rules, or merchant procedures are verified. Those remain pilot and production gates.

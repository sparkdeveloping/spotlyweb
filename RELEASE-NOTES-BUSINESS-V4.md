# Spotly Business Experience v4

## Purpose

Version 4 replaces the menu-first business portal with a guided, adaptive operating experience. The release corrects the business/location hierarchy and reduces the number of decisions shown before the user understands the platform.

## Major changes

### Guided setup centre

- Six-step, resumable business setup
- Clear progress, back, save-and-leave, and save-and-continue behavior
- Full-screen processing, success, and error states
- Brand, legal identity, type, operating model, location, capabilities, starter content, and review
- Relevant workspace is generated after setup

### Correct brand and location hierarchy

- One record for the business brand
- Separate branch/location/venue/property records
- Short location names such as `Hillside` instead of duplicate names such as `OK Zimbabwe — Bulawayo Hillside — Main branch`
- Separate business and location selectors
- Location-scoped staff access

### Adaptive portal by business model

- Grocery/retail
- Restaurant/food
- Events/ticketing
- Appointments/services
- Accommodation/activities
- Directory/profile-only

Navigation, terminology, forms, activity states, insights, kiosk modes, and empty states adapt to the selected model.

### Focused navigation

Before onboarding is complete, only setup, home, support, and account/access are shown. After completion, only relevant operational tools appear.

### Adaptive catalogue and activity

- Product, menu, event, service, listing, and offering editors
- Type-specific fields such as SKU, stock, duration, venue, dates, and capacity
- Pickup substitution workflow only where relevant
- Type-specific activity queues and next actions
- Location filtering and branch assignment

### Kiosk

- Pickup arrival
- Ticket check-in
- Appointment/guest arrival
- Focused full-screen experience
- Optional staff PIN protection
- Shared-device safety messaging

### Payments

- Progressive three-step payment setup
- Customer methods and currencies
- Settlement recipient and payout destination
- Legal, tax, and invoice records
- Existing payout request and history workflows retained

### Team access

- Enriched user names and emails instead of raw UIDs when profiles exist
- Owners/managers can grant business-wide access
- Scoped managers must assign locations
- View-only users cannot invite, modify, resend, or revoke access

### Admin synchronization

- Business brand and location management separated
- Guided admin creation of a brand and first location
- Directory version 4 migration
- Legacy duplicate branch-as-business records archived
- Membership and claim migration support
- Business type, capabilities, and operating model management

### Customer synchronization

- Brand-first directory
- Exact location selection after brand selection
- Location-filtered availability
- Pickup basket only for pickup businesses
- Read-only staged offerings for business models whose customer transaction flow is not yet released

### Zimbabwe starter content

- Official-name reference shelf for selected Zimbabwean brands and product families
- No copied product images
- No guessed prices, stock, or barcodes
- All reference entries inactive and marked for business confirmation

## Required post-deployment action

1. Sign in as Super Administrator.
2. Open `/admin/businesses`.
3. Select **Upgrade / refresh directory**.
4. Wait for directory version 4 to complete.
5. Review brand and location counts before inviting or approving businesses.

## Validation

- JavaScript-only structural check passed
- ESLint passed with zero errors or warnings
- Local alias/import resolution passed
- JSON configuration parsed successfully
- Dependency override for Firebase Admin/Jose retained
- Production build could not run in the generation container because the matching Linux Next.js SWC package could not be downloaded from its restricted registry. Run `npm run build` locally and in Vercel Preview.

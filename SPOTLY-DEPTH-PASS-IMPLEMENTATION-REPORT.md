# Spotly 5.1 Production-Depth Implementation Report

**Candidate:** Spotly 5.1 production-depth pass  
**Prepared:** 6 August 2026  
**Source basis:** the supplied completion brief and post-rebuild audit  
**Release status:** staging candidate; not represented as a completed public launch

## Executive summary

This pass preserves the prior visual rebuild and focuses on operational truth. The application now distinguishes connected workflows from training or pending integrations, scopes browser state to a user or anonymous session, derives customer pickup availability from location configuration, atomically validates and reserves checkout capacity, expands business claiming into a resumable ten-stage flow, introduces mobile merchant orders, keeps staff work inside `/staff`, and creates exact administrator queue routes.

The candidate is suitable for a protected staging deployment after a successful dependency installation, lint run and production build. Those three checks could not be completed in the generation environment because npm package downloads failed with repeated DNS/network `EAI_AGAIN` errors. No claim is made that the Next.js production build passed.

## Major implementation areas

### Release truth and traceability

Added safe public build metadata through:

- `NEXT_PUBLIC_APP_VERSION`
- `NEXT_PUBLIC_BUILD_COMMIT`
- `NEXT_PUBLIC_BUILD_DATE`
- `NEXT_PUBLIC_APP_ENV`

Authenticated Account and Admin surfaces expose a concise build label for diagnostics. Deployment documentation now requires testing the exact Preview commit before promotion.

### Shared design and accessibility foundation

- Rebuilt `Card` with `plain`, `bordered`, `raised` and `interactive` variants; shadows are no longer automatic.
- Removed `font-black` usage from application source.
- Added unique `useId()` tab IDs and animation IDs.
- Added `TabPanel` support.
- Added a reusable accessible `Overlay` for modal, drawer, sheet and full-screen flows.
- Added focus trapping, initial focus, focus restoration, Escape, inert background, scroll lock and dialog semantics.
- Migrated notification, command, mobile More, support and high-impact business task experiences to the shared overlay foundation.
- Preserved static `ListRow` semantics so information does not masquerade as a button.

### Workspace access and navigation

- Replaced display-name/regex workspace inference with actual profile grants, memberships, staff records, driver records and administrator roles.
- Defined explicit settings destinations per workspace.
- Added mobile command navigation.
- Corrected invalid generated settings routes.
- Kept Driver labelled as training-only throughout navigation and Account.

### Public launch experience

- Added configurable launch content rather than unsupported hard-coded traction claims.
- Added approved featured-business retrieval with a truthful no-business fallback.
- Rebuilt the business finder as an accessible combobox with keyboard navigation, loading, result count, error and empty states.
- Removed false interaction styling from static categories.
- Added waitlist edit/reset behavior.
- Shortened the page around promise, launch area, pickup steps, proof, business entry and FAQ.

### Customer marketplace and checkout

- Added selected city/area and optional customer geolocation.
- Added distance calculation and nearby sorting when branch coordinates exist.
- Added user/session-scoped marketplace location, cart and checkout state.
- Clear temporary state on logout/account change.
- Corrected global search language to match implemented business discovery.
- Added distinct query failure and empty states.
- Required valid positive product prices; missing values never display as Free or zero.
- Read payment methods and currencies from selected location/business configuration.
- Derived pickup dates and slots from location hours, special hours, pause state, lead time, cutoff, duration, capacity and booked-slot records.
- Removed generic browser-generated 08:00–18:00 slots.
- Added staged checkout with exact review details and a stable checkout identifier.
- Added order idempotency.
- Revalidated selected pickup slot inside a Firestore transaction.
- Atomically reserved pickup capacity and product quantities.
- Rejected products outside the chosen location, unavailable stock, invalid quantities and unresolved prices.
- Corrected the substitution option shown by the UI so the order API accepts it.

**Known limitation:** cancellation/refund paths do not yet release all product and pickup reservations automatically. This remains a production blocker for transactional launch.

### Business claiming

- Expanded to ten stages: business, relationship, parent, scope, locations, operations, public details, evidence, review and submission.
- Added parent/head-office context and ownership-conflict guidance.
- Added organization, brand, location, listing-correction, operations and finance request scope.
- Added temporary anonymous draft transfer after sign-in.
- Added account-scoped Firestore claim drafts.
- Added persistent Storage evidence uploads with progress, retry, remove and linkage to draft/claim.
- Added draft list and deletion.
- Added per-section Review editing.
- Added claim status route with timeline, evidence, information requests and support context.

### Merchant operations

- Made location operating status a direct action from Today.
- Added branch-derived availability and operating schedule context.
- Added urgent order age, promised time, reason and exact next action.
- Added a stateful before-closing checklist.
- Added mobile merchant order cards.
- Added URL-preserved order filters and exact order deep links.
- Added retail/prepared-food state actions and substitution detail.
- Split catalogue into Quick updates, Manage, Import review and Publishing.
- Added publication blocks for missing pricing/location information.
- Added customer preview and draft/live publication context.

Additional appointment, event and accommodation workflows remain capability-specific foundations rather than fully specialized production systems.

### Driver

Driver is deliberately classified as **Training-only**.

- All routes and labels identify training mode.
- Data is fictional/seeded.
- State is session scoped.
- Added reset and scenario selection.
- Added pickup-code and customer-PIN practice.
- No claim is made for live dispatch, GPS proof, earnings, payout, fleet assignment or server operational history.

### Staff

- Removed ordinary staff links into Admin.
- Added staff-owned scoped queue views.
- Added exact task deep links and record detail.
- Added checklist, notes, completion, escalation and support context.
- Sorted agenda data using the Harare operating timezone.
- Expanded learning to content, checklist, quiz, score, retry, saved progress, renewal and acknowledgement states.
- Added mobile cards for Assets and other routine staff records.

### Admin

- Added `/admin/queues/[queue]` routes.
- Added exact queue links from the Control Centre.
- Added URL filters, saved views, search, status, owner, priority, age and SLA cues.
- Added record selection, assignment, batch assignment and CSV export.
- Added decision actions and reason notes for claims, support, payouts and tasks.
- Removed native `window.prompt()` and `window.confirm()` calls.
- Replaced forced “ready after timeout” behavior with per-source loaded/partial/failure states.
- Added build traceability.

Provider health, notification delivery, payment callback health and high-volume server pagination still require production telemetry and data services.

### Account

- Moved language and notification preference records to the user profile.
- Added profile, phone, preferred contact and pickup-contact editing.
- Added explicit workspace access from actual records.
- Added password recovery and build information.

**Known limitation:** storing a notification preference does not itself prove every external email/push delivery process enforces it. Delivery integration tests remain required.

### Support

- Scoped support conversation persistence by authenticated user or anonymous session.
- Migrated chat to the accessible overlay.
- Added structured context for order, business, claim, payment, driver job and staff task.
- Added validated attachments with progress and retry.
- Added open, waiting, escalated, resolved, closed and reopened lifecycle handling.
- Added persisted satisfaction feedback.
- Changed “Live support” language to “Message support” where real-time staffing is not guaranteed.

## Data and migration changes

- Added `businessClaimDrafts` Firestore records and index.
- Added claim-evidence Storage paths.
- Expanded support attachment and participant update fields.
- Added user profile preference/contact fields.
- Added training-progress fields.
- Added pickup booked-slot and product reservation updates during order creation.
- Added `orderRequests` idempotency records.

Deploy indexes and validate rules in Firebase Emulator Suite before production.

## Removed or archived

- Removed unused static customer, business and admin data modules that could be mistaken for operational data.
- Archived previous implementation reports under `docs/history/` so they are not treated as current release status.
- Kept only explicitly fictional driver seed data for training.

## Production dependencies and limitations

1. Successful `npm ci`, ESLint and Next.js production build on a normal registry.
2. Firebase Emulator tests for current Firestore and Storage rules.
3. Approved launch locations, areas, categories and featured businesses.
4. Production Paynow configuration, callback, reconciliation, refund and settlement testing.
5. Reservation release on cancellation/refund/expiry.
6. Notification provider configuration and preference-enforcement tests.
7. Support staffing, escalation and SLA ownership.
8. Final legal and privacy content.
9. Monitoring, backup, restore, incident and rollback validation.
10. Real browser tests for keyboard, screen readers, 320px reflow and zoom.

## Deployment

Use Node.js 22.x and npm 11 or later:

```bash
npm ci
npm test
npm run check:js
npm run lint
npm run build
```

Deploy to Preview with release metadata, perform authenticated smoke testing, then promote the exact tested commit. See `VERCEL-DEPLOYMENT.md`.

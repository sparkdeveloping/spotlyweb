# Spotly Business Operations v3

## Main change

This release replaces the static business portal experience with a Firebase-backed operating workspace and expands Spotly Admin so businesses can begin onboarding before the customer marketplace launch.

## Business portal

- Realtime business selection and membership context.
- Launch-readiness dashboard and guided next actions.
- Grocery pickup order lifecycle with payment gates, substitutions, notes, cancellation, and customer notifications.
- Product catalogue CRUD, images, bulk entry, CSV import, templates, inventory, and availability.
- Branch CRUD, daily hours, pickup capacity, payment methods, and copy-from-branch setup.
- Promotions, analytics, exports, finance configuration, payout requests, staff roles, invitations, support, profile media, and publication review.
- Helpful loading, empty, success, warning, and error states throughout.

## Administrator portal

- Live Firestore business directory rather than local fallback records.
- One-click protected Firebase population with status reporting.
- Coherent administrator creation of organization, business, and first branch.
- Claim review, configurable low-risk policy, publication review, support desk, payouts, people/access, content, roles, legal, integration, and platform controls.
- Audited business support-view entry.

## Data and server routes

- Expanded Firestore indexes and production-draft rules.
- Expanded Storage paths for business media and catalogue images.
- Protected seed, claim, invitation-acceptance, administrator-business, email, payment, order, notification, and support-view routes.
- Invitation expiration and refresh behavior.
- Preserved Firebase server timestamps and sentinel values during data cleaning.

## First action after deployment

Open `/admin/businesses` as the existing super administrator and select **Populate Firestore**. Until this action is completed, business claim search intentionally returns no local fallback results.

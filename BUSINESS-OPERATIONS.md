# Spotly Business operations guide

This release is centered on making business onboarding and grocery-pickup operations usable before the public customer marketplace is fully launched.

## First-time business journey

1. Create a Spotly account with email and password.
2. Open `/claim` and search the Firebase directory before creating a new listing.
3. Select the existing provisional listing or choose **Add a business not listed**.
4. Confirm the known information, correct inaccurate fields, and upload ownership evidence.
5. Submit the claim. The business application and all evidence references are stored in Firebase.
6. While review is pending, use the business workspace to complete branches, catalogue, finance, team, pickup operations, and support setup.
7. When every launch-readiness item is complete, request publication review from Business Settings.
8. Spotly Admin can approve publication or return a clear correction requirement.

Low-risk automatic approval is disabled by default. A super administrator can enable it from Admin → Platform and set the risk threshold. New owner-created businesses always remain subject to manual review.

## Business workspace routes

| Route | Operational use |
|---|---|
| `/business` | Live dashboard, readiness, next actions, and pickup queue |
| `/business/activity` | Orders, payment state, substitutions, notes, cancellation, and pickup progression |
| `/business/catalog` | Product creation, editing, images, templates, bulk entry, CSV import, stock, and availability |
| `/business/branches` | Branch creation, hours, pickup capacity, contacts, payment methods, and copied settings |
| `/business/insights` | Realtime order, sales, product, branch, and export views |
| `/business/promotions` | Promotion creation, limits, dates, audience, branches, and activation |
| `/business/staff` | Invitations, roles, branch access, permissions, suspension, resending, and revocation |
| `/business/finance` | Currencies, payment methods, settlement details, fiscal fields, balances, and payout requests |
| `/business/support` | Live support conversations and role-relevant help resources |
| `/business/settings` | Public profile, media, pickup defaults, notifications, readiness, and publication review |

## Built-in operating principles

- Search and prefill before asking a business to type information.
- Autosynchronized Firebase data across business and administrator screens.
- Clear success, warning, failure, loading, and empty states.
- One obvious next action for every order state.
- Reusable templates and branch-copy actions for repetitive setup.
- Branch-specific control without requiring duplicate business accounts.
- Invitation links preserve existing business access and add the new membership.
- Team invitations expire after 14 days and can be refreshed by an owner.
- Product images are uploaded to the business-owned Firebase Storage path.
- Every significant business or administrator change records an audit event.

## Grocery pickup lifecycle

The supported order progression is:

```text
awaiting payment → submitted → accepted → preparing → ready for pickup → picked up
```

Businesses can also:

- Record a verified manual payment.
- Propose an item substitution with quantity and price.
- Save internal operational notes to the order timeline.
- Cancel an order with immediate customer notification.
- See customer contact, branch, pickup slot, notes, and substitution preference.

Paynow orders remain blocked from preparation while payment is still awaiting confirmation. Cash and manual methods can be marked received by an authorized business user.

## Catalogue workflow

A business can start through any of these paths:

- Add a single product with a guided form.
- Use quick-add rows for several products.
- Import a curated grocery catalogue template.
- Upload a CSV file.
- Duplicate or edit an existing product.
- Upload and replace a product image.

The system stores product search terms, SKU/barcode values, USD/ZiG price information, stock mode, stock state or exact quantity, pickup eligibility, substitution preference, active state, and source-template information.

## Branch model

Each branch stores:

- Organization and business relationship.
- Name, city, address, phone, and email.
- Opening and closing hours for every day.
- Pickup enabled state, slot length, capacity, and preparation time.
- Accepted currencies and payment methods.
- Public and operational status.

A business must retain at least one branch. Settings can be copied from an existing branch when opening another location.

## Finance boundaries

The interface is operational for configuration, payment records, payout requests, and administrator payout progression. Real payment processing still requires valid server-only Paynow credentials and merchant approval. Legal entity details, settlement accounts, tax identifiers, commission terms, payout rules, and fiscal requirements must be confirmed before live release.

## Pilot acceptance checklist

Before inviting the first external business, confirm:

- The Firebase directory is populated from Admin → Businesses.
- The business can find and claim its record.
- Claim evidence uploads remain private to the applicant, business, and administrators.
- A claim decision creates the correct membership and business access.
- Business profile, media, branch, catalogue, staff, finance, support, and publication actions persist after refresh.
- A second account can accept a staff invitation and sees only assigned branches and permissions.
- Test orders can progress through every pickup state.
- Notifications appear for the intended customer or business user.
- Admin publication, support, payout, and audit workflows work for the assigned administrator roles.
- Firestore and Storage rules have been tested with the Firebase Emulator Suite before production enforcement.

# Spotly Business 5.5 — Final Launch Review Report

## Purpose

Final launch review is a business-level customer-readiness decision. It is separate from:

- business-access claim review;
- settlement-account verification;
- product/image review;
- catalogue import review.

## Merchant submission

`POST /api/business/launch-review/submit`

The route:

- authenticates the user;
- enforces active scoped Business permission;
- reloads lifecycle inputs server-side;
- rejects submission when launch blockers remain;
- protects against duplicate active submissions in a Firestore transaction;
- creates a `businessLaunchReviews` record;
- creates the Admin queue task;
- writes trusted audit data;
- transitions an initial launch into `launch_review` state.

For a live business requiring review of launch-critical changes, the route creates a re-review while keeping the business operational.

## Admin decision

`POST /api/admin/business-launch-reviews/decision`

Decisions:

- approve;
- request changes;
- reject.

The route requires platform Business-management authority. It re-evaluates launch readiness before approval and then performs decision writes in a Firestore transaction with all transaction reads before the first write.

Initial approval transitions the business to live/customer-public. Requested changes return the pre-live business to preparing without forging access status.

## Structured requested changes

Admin can identify the correction area and provide an exact reason. Merchant launch UI can deep-link back to the relevant Profile, Location, Products, Operations, Money or Business Details surface.

## Re-review policy

Launch-critical edits after a review decision use `POST /api/business/launch-review/invalidate` through `markLaunchCriticalBusinessChange()`.

Examples wired in this pass include:

- identity/category/business type;
- operating model;
- major public profile/brand media;
- primary location identity/address changes or removal.

A live business remains live during re-review. Routine stock, price, ordinary hours/team changes do not reopen foundational onboarding.

## Suspension

`POST /api/admin/business-lifecycle` provides trusted suspend/resume behavior. Suspension does not reset onboarding. Resume restores the pre-suspension lifecycle state.

## Firestore authority

Merchants can read their review state but cannot directly create/update/delete authoritative `businessLaunchReviews` records or directly set business live/public/review authority fields through normal browser rules.

# Spotly Business 5.5 — Launch Checklist Report

## Route

`/business/launch?business=<id>` is the authoritative selected-business home before customer launch.

## Header

The Launch Checklist presents:

- Stage X of 5;
- lifecycle label;
- merchant-controlled setup percentage;
- merchant action count;
- Spotly review count;
- one exact primary next action when the merchant has actionable work.

Spotly review time does not reduce the merchant's percentage.

## Checklist groups

The checklist derives grouped requirements from the shared lifecycle engine:

- Access
- Business basics
- Customer experience/profile
- Location readiness
- Catalogue/offering readiness
- Pickup/operations where applicable
- Money/customer payment methods
- Settlement verification when required
- Team access (optional where appropriate)
- Final launch review

## Exact blockers

Rows carry a precise description and destination. Examples include missing customer description/contact, missing opening hours, catalogue items missing prices/customer details, image-rights review, missing pickup instructions, payment configuration and settlement review status.

## Money treatment

Settlement verification is explicitly described as a review of where Spotly can settle eligible funds. It is separate from business-access approval and separate from final launch review.

Cash-only/non-online-payment configurations can mark online settlement `Not required`; enabling online settlement causes the lifecycle to recompute the requirement.

## Parallel preparation

Stage 3 is deliberately not another giant wizard. Products, Locations, Team and Money can be completed in parallel. The header chooses one primary next action while the checklist keeps all requirements visible.

## Final review

The final review row clearly distinguishes:

- blocked/not ready;
- ready to submit;
- waiting on Spotly;
- requested changes;
- approved.

## Locked operations

Deep links to pre-live Orders, Insights, Promotions and Kiosk produce lifecycle-aware lock explanations and link back to the Launch Checklist.

## Pre-live catalogue/location language

Catalogue copy explicitly states that prepared products remain private until final launch approval/live status. Location controls distinguish internal launch preparation from customer-live operation, including `Ready when live` visibility wording before launch.

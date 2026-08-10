# Spotly Business Lifecycle 5.5 — Implementation Report

Generated: August 9, 2026

## Objective

Spotly Business now uses one merchant-facing orchestration layer instead of exposing claim approval, foundational setup, launch preparation, settlement review, publication review and live operations as unrelated concepts.

The five stages are:

1. **Verify access** — prove authority through an approved claim, invitation/membership or existing owner relationship.
2. **Set up the business** — complete the short foundational Business Details wizard.
3. **Prepare for launch** — complete customer profile, locations, catalogue, fulfilment, Money and other capability-specific requirements.
4. **Spotly launch review** — submit the completed launch configuration for a clearly named final Spotly decision.
5. **Live** — unlock customer-facing operations and the full operational workspace.

## Authoritative lifecycle engine

`lib/business-lifecycle.js` is the shared interpretation layer. It owns:

- setup validators and completion percentage;
- launch requirements by business type/capabilities/payment configuration;
- merchant-owned versus Spotly-owned states;
- exact launch blockers;
- final review state;
- legacy/current business publication-state compatibility;
- default selected-business destination;
- operational capability flags (`canOperate`, `canTakeOrders`, `canUseKiosk`, `canUseInsights`, `canUsePromotions`);
- exact primary `nextAction`.

`lib/business-lifecycle-server.js` loads server-authoritative lifecycle inputs for high-impact actions. Product reads are paginated rather than silently truncating readiness at an arbitrary first page.

## Merchant state vocabulary

Launch checks use richer states instead of a Boolean `done` flag:

- `complete`
- `incomplete`
- `in_review`
- `action_required`
- `blocked`
- `not_required`

Ownership is explicit:

- merchant → **Your action**
- Spotly → **Waiting on Spotly**
- system → platform-level blocker
- none → complete/not required

## Lifecycle routing

`lib/business-routing.js` centralizes selected-business URLs. `businessHref()` preserves explicit `business=<id>` context and optional product/order/branch/setup-step query parameters.

Account-level routes remain account-level:

- `/business`
- `/business/claims`
- `/business/invitations`
- `/business/access`

Preparing/reviewing businesses default to `/business/launch?business=<id>`; live businesses default to `/business/today?business=<id>`.

## Progressive feature gating

`components/business/business-workspace.js` gates pages from the shared lifecycle state rather than `onboardingStatus`.

- Access not approved: Launch status + Help.
- Business basics incomplete: Launch Checklist + Business Details + Help.
- Preparing/reviewing: Launch Checklist, Business Details, Products, Locations, Team, Money, Help and relevant pre-live settings.
- Live: full operational workspace.
- Suspended: Business status, Help and limited settings; onboarding is not reopened.

Deep-linked operational pages before launch use an explanatory locked state rather than pretending the business is operating.

## Publication versus operational state

Branch `active`, branch customer-visibility intent, foundational onboarding completion and business customer-live status are separate concepts.

The customer-facing Firestore gate now requires the parent business to be truly live/paused before public child records can be read. Marketplace business discovery uses the customer-live search path. Order creation rechecks the business live state inside the server transaction.

This prevents a provisional/directory-visible business from exposing products, locations or customer ordering merely because a legacy `public` flag exists.

## Existing-record compatibility

Legacy businesses are derived safely:

- legacy `active + public` can remain live;
- legacy pending-publication-review maps to Stage 4;
- ambiguous incomplete records map to preparing rather than being falsely marked live;
- live/paused/suspended businesses are not sent back through initial onboarding.

## Additional integrity fixes found during implementation

The lifecycle pass exposed and corrected several adjacent defects:

- branch create/delete denormalization is now mediated through a trusted server route;
- direct browser structural branch writes are blocked;
- partial business-profile saves no longer erase `searchTerms`;
- Kiosk remains an allowed safe merchant configuration field;
- customer-public child records require an actually live parent business;
- final launch submission is transaction-protected against duplicate active submissions;
- Admin launch decisions use read-before-write Firestore transactions;
- Admin generic Business editing can no longer bypass access/final-launch authority by directly setting approved/live/public state.

## Main implementation files

- `lib/business-lifecycle.js`
- `lib/business-lifecycle-server.js`
- `lib/business-routing.js`
- `components/business/launch.js`
- `components/business/setup.js`
- `components/business/business-context.js`
- `components/business/business-layout-client.js`
- `components/business/business-workspace.js`
- `app/business/layout.js`
- `app/api/business/launch-review/submit/route.js`
- `app/api/business/launch-review/invalidate/route.js`
- `app/api/admin/business-launch-reviews/decision/route.js`
- `app/api/admin/business-lifecycle/route.js`
- `app/api/business/branches/route.js`
- `firestore.rules`

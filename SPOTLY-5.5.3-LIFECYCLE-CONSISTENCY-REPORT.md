# Spotly Business 5.5.3 — Lifecycle Consistency Full-Fix Report

Generated: August 10, 2026

## Why this release exists

Business lifecycle state was still diverging between surfaces even after the 5.5.2 location-order hotfix. The same business could simultaneously appear as 67% complete in Portfolio, 50% complete in Launch Checklist, have a visibly saved Main location in Business Details, and still be reported as missing a location by locked-feature blockers. A separate business could be shown as ready for final review while the authoritative submit route returned HTTP 422.

The problem was architectural rather than cosmetic: several surfaces used the same conceptual lifecycle rules against different input sets, different timing, and different client/server fallbacks. This release removes that split.

## Authoritative lifecycle data path

Selected-business lifecycle state now comes from one server-authoritative route:

`GET /api/business/lifecycle?businessId=<id>`

The route:

- authenticates and revalidates business access;
- loads the business, branches, products, operations and protected settlement state through Admin SDK/server access;
- normalizes a canonical primary location;
- evaluates the shared lifecycle engine;
- returns a safe public lifecycle snapshot;
- is `force-dynamic`, `revalidate = 0`, and sends `Cache-Control: private, no-store, max-age=0`.

The browser no longer invents a fallback lifecycle from partially loaded subscriptions. If authoritative lifecycle state cannot be loaded, Spotly shows an explicit verification/load error instead of guessing that setup is incomplete or calculating a different percentage.

## One lifecycle interpretation across surfaces

The same lifecycle snapshot semantics now drive:

- selected-business shell and sidebar gating;
- Launch Checklist;
- locked operational-feature blockers;
- setup continuation/validation support;
- Portfolio synchronization for the selected business;
- final launch-review submission blockers;
- default selected-business destination;
- launch capability flags such as `canTakeOrders` and `canUseKiosk`.

Portfolio's initial server calculation and the selected-business lifecycle API both use the same shared lifecycle engine and protected settlement merge behavior.

## Canonical location identity

Setup Location now creates/updates a real branch through the trusted branch API with `makePrimary: true`.

The branch route maintains:

- `business.branchIds`;
- `business.primaryBranchId`;
- `business.primaryLocationId`;
- a safe replacement primary if the current primary is deleted.

Lifecycle normalization does not trust array position. It prefers the configured primary location when valid, then the best valid saved branch. A stale/incomplete first Firestore result can no longer make a valid Main location disappear from launch readiness.

## Foundational setup versus launch readiness

A completed foundational wizard is now distinct from current launch-readiness health.

Once the merchant has completed Review/foundational onboarding, a later launch requirement problem such as an invalid location or missing product does **not** throw the business back into first-run Stage 2 and remove Products/Locations/Money from navigation.

Instead:

- the business remains Stage 3 — Prepare for launch;
- the exact affected Launch Checklist item becomes actionable;
- final launch submission remains blocked until the current requirement is corrected.

This keeps historical onboarding completion separate from current launch validity.

## Setup progress semantics

Review is a confirmation screen, not a required percentage unit.

Required Business Basics progress counts the actual required basics. For a five-basic flow:

- 0/5 = 0%
- 4/5 = 80%
- 5/5 = 100%

An explicit `step=review` can open the Review screen even if a prerequisite later becomes invalid. Review then aggregates blockers and provides precise Fix actions instead of silently bouncing several steps backward.

## Structured 422 launch-review feedback

`POST /api/business/launch-review/submit` re-evaluates authoritative lifecycle state server-side. If launch requirements changed, the 422 response now contains:

- exact structured blockers;
- the authoritative lifecycle snapshot used for rejection.

The API client preserves structured error payloads. The Launch Checklist renders a visible “Launch requirements changed” state with Fix links and refreshes authoritative lifecycle data. A synchronous client lock also prevents rapid double-click duplicate POSTs in addition to the existing server transaction protection.

## Protected Money state parity

`businessSettlementAccounts` is loaded by the lifecycle server and merged into safe `moneySetup` lifecycle input. Portfolio and selected-business lifecycle now use the same protected settlement interpretation rather than potentially disagreeing because one surface could see verification status and the other could not.

## Direct owner access parity

Portfolio can discover trusted direct owners through `business.ownerIds`. Selected-business server access now recognizes that same trusted direct-owner relationship even if an older business does not yet have a legacy membership record. A business can no longer appear in Portfolio and then fail the lifecycle API solely because of this historical data shape.

## Caching and synchronization

Both Portfolio and selected lifecycle APIs bypass intermediary caching. When the selected lifecycle refreshes, the matching Portfolio card is updated from that exact authoritative snapshot instead of waiting for a separately timed lifecycle calculation.

## Safety principles preserved

This release does not weaken previous authority boundaries:

- browser cannot mark a business live;
- browser cannot approve final launch review;
- settlement verification remains protected;
- final launch submission remains server-authoritative;
- customer visibility continues to require actual live business state;
- business structural branch writes remain mediated by the trusted server route.

## Resulting invariant

For one business and one stored database state, these surfaces now share the same lifecycle interpretation:

`Portfolio → Launch Checklist → Sidebar gating → Locked-feature blockers → Final launch submit`

A backend lifecycle failure is surfaced as an error, not translated into a different fake state.

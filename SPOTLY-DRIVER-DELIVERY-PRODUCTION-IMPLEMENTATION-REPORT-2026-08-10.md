# Spotly Driver + Delivery Production Implementation Report

**Date:** 10 August 2026  
**Base repository:** Spotly Web Platform 5.5.3  
**Implementation scope:** Driver activation, delivery domain, dispatch, Business Delivery, customer delivery checkout/status, Kiosk device hardening, Admin Driver/Delivery operations, Driver earnings/payouts, security rules/indexes, and production-facing copy.

## 1. Implementation result

The repository no longer uses the seeded Driver training workflow as the production Driver source of truth. The old `data/driver.js` training feed was removed and production `/driver` now operates against authenticated server APIs and durable Firestore records.

The connected operational path implemented in source is:

```text
Customer delivery order
→ Business preparation
→ Delivery job
→ Dispatch
→ Driver offer
→ Driver acceptance
→ Driver pickup workflow
→ Pickup-code verification
→ En route
→ Customer handoff
→ Customer PIN verification
→ Delivery completion
→ Driver earnings ledger
→ Driver payout request/review
```

Admin can inspect and intervene across Driver, delivery, incident and payout records. Business can configure branch delivery and release paid delivery orders to dispatch. Kiosk uses scoped device credentials rather than a Business owner session.

## 2. Driver activation

Implemented:

- Public Driver acquisition at `/drive`.
- Persisted Driver application lifecycle.
- Driver identity/profile fields, vehicle, document metadata, service-area preferences, agreements and training state.
- Protected Driver document Storage path model.
- Driver payout destination setup with encrypted identifier and masked display.
- Admin application/document/vehicle review and approval.
- Information-required workflow without restarting approved steps.
- Server-authoritative online/offline presence.
- Foreground browser geolocation while online and current-location freshness.
- Eligibility diagnostics before going online.
- Driver cannot go offline during an active delivery.
- Live delivery offers with guaranteed pay.
- Offer accept/decline and sibling-offer withdrawal.
- Acceptance re-checks Driver status, holds, online state and active-job conflicts.
- Durable active delivery that survives page reload because state is server-side.
- Coordinate-based navigation links.
- Pickup code verification.
- Customer handoff PIN verification.
- Exactly-once delivery earnings credit using deterministic ledger entry IDs.
- Driver earnings balances and ledger.
- Driver payout requests against verified payout destinations and available balance.
- Structured Driver incidents and safety holds.
- FCM notification integration for Driver/application/delivery state where applicable.

## 3. Delivery domain

Added server/domain infrastructure for:

- `driverApplications`
- `drivers`
- `driverDocuments`
- `driverVehicles`
- `driverPayoutAccounts`
- `driverPresence`
- `deliveryJobs`
- `deliveryOffers`
- `deliveryEvents`
- `driverEarningsLedger`
- `driverBalanceAccounts`
- `driverPayouts`
- `driverIncidents`
- `dispatchZones`
- `kioskDevices`

The delivery state machine is centralized in `lib/driver-delivery-server.js` and high-impact transitions are performed through trusted server routes instead of arbitrary Firestore client writes.

## 4. Dispatch

Implemented deterministic dispatch rather than client-side matching:

- Approved/active Driver eligibility.
- Approved vehicle and required document checks.
- Compliance/safety holds.
- Online/current-location checks.
- Existing active-job exclusion.
- Vehicle compatibility.
- Proximity ranking using pickup coordinates.
- Durable offer creation and expiry handling.
- Push notification to candidate Drivers.
- Re-dispatch after decline.
- Admin manual assignment/reassignment with reason and audit.
- Outstanding offer withdrawal after assignment.
- No-Driver exception path for operations.

## 5. Customer delivery

Order creation now supports `pickup` and `delivery` fulfilment.

Delivery checkout includes:

- delivery address;
- suburb/area;
- landmark;
- instructions;
- contact details;
- map coordinates;
- use-current-location UX;
- delivery fee in the server-authoritative total;
- digital-payment-only guard for delivery;
- branch delivery capability validation;
- branch map-pin validation;
- branch delivery-radius validation;
- durable delivery job creation in the same order transaction.

The Customer order surface polls a scoped owner-only delivery-status route and presents plain-language delivery state plus the Customer's own handoff PIN. The handoff PIN is not stored on the public order object and is stripped from Driver bootstrap payloads.

## 6. Business Delivery

Added a dedicated Business Delivery surface and server API.

Per-branch configuration includes:

- delivery enabled/paused;
- map pin;
- radius;
- preparation minutes;
- pickup point;
- pickup instructions;
- contact phone;
- delivery hours;
- vehicle types.

Business can see live delivery jobs, mark eligible paid orders ready for dispatch, and record preparation delay. Delivery remains capability-specific so pickup-only branches are not forced through delivery setup.

## 7. Kiosk

The production Kiosk no longer requires a normal Business owner session.

Implemented:

- one-time device enrollment code;
- revocable branch/mode-scoped device credential;
- Business device management/revocation;
- pickup-check-in mode;
- Driver-pickup mode;
- narrowly scoped lookup/check-in endpoints;
- heartbeat;
- inactivity privacy reset;
- staff exit PIN enforcement where configured;
- device remains enrolled after a legitimate staff exit and is removed only through invalidation/revocation;
- no full branch order collection is loaded into the shared device.

## 8. Admin Operations

The previous dormant Driver Admin surface was replaced by operational tooling.

Implemented:

- Driver directory and Driver 360 context.
- Application/review state.
- Documents and vehicle review.
- Eligibility/"why" diagnostics.
- Presence and location freshness.
- Active/current delivery context.
- Earnings balances and ledger.
- Driver payout account verification/rejection.
- Driver payout lifecycle controls.
- Incident visibility and holds.
- Driver suspend/reinstate/end-session actions.
- Delivery operations list/filters.
- Delivery detail/timeline/offers/incidents.
- Deterministic dispatch trigger.
- Manual assignment/reassignment.
- Delivery cancellation and exception clearing.
- Reason-required audited privileged operations.

## 9. Driver Money

Added an authoritative Driver money system modeled after the existing Business Money principles.

Balance buckets:

```text
pending
available
reserved
processing
paid_out
```

Ledger event support includes delivery earnings and payout balance movements. A payout request requires a verified payout destination and sufficient available balance. Admin transitions payout state through approved/held/processing/paid/rejected paths with corresponding ledger bucket movements and audit events.

Changing a previously verified Driver payout account requires recent authentication.

## 10. Security

Updated `firestore.rules` to explicitly protect new Driver, Delivery, Money and Kiosk collections. High-impact state is API/server-authoritative.

Updated `storage.rules` for private Driver document paths.

Additional security measures include:

- Driver document metadata path must belong to the authenticated Driver.
- Precise operational state is not exposed as a broad public Firestore collection.
- Driver bootstrap removes pickup and Customer handoff secrets.
- Customer handoff PIN is owner scoped.
- Driver offer acceptance re-checks account/hold state to close dispatch race conditions.
- Kiosk uses credential hashes server-side and a narrowly scoped device identity.
- Admin actions require role checks and create audit records.
- Financial identifiers are encrypted and masked using the existing financial-value protection pattern.

## 11. Rules and indexes

`firestore.indexes.json` was expanded for the new Driver/Delivery query patterns, including application, delivery, offers, incidents, earnings, payout and kiosk queries.

`firestore.rules` and `storage.rules` were updated in the same source package and must be deployed with the application.

## 12. Public/product copy

Production-facing training-only references were removed from current surfaces:

- Driver metadata and UI.
- Account workspace copy.
- Support categories.
- Homepage/coming-soon messaging.
- Current README/capability/route/browser-state/deployment docs.

The old seeded Driver data file was deleted.

## 13. Important routes added

### Driver

```text
/drive
/driver
/driver/[section]
/api/driver/bootstrap
/api/driver/application
/api/driver/presence
/api/driver/location
/api/driver/offers
/api/driver/delivery
/api/driver/incidents
/api/driver/payout
```

### Delivery / Customer

```text
/api/orders/create
/api/orders/delivery-status
```

### Business Delivery

```text
/api/business/delivery
```

### Kiosk

```text
/api/kiosk/enroll
/api/kiosk/lookup
/api/kiosk/check-in
/api/kiosk/driver-pickup
/api/kiosk/heartbeat
/api/kiosk/exit
```

### Admin

```text
/api/admin/drivers
/api/admin/deliveries
/api/admin/driver-money
```

## 14. Validation

Final validation in the supplied execution environment:

```text
npm run check:js
PASS
JavaScript-only and React-hook import checks passed.

npm run check:theme
PASS
Theme safety check passed for 145 source files and 24 classified route patterns.

npm test
PASS
110 tests
110 passed
0 failed

node --check (new Driver/Delivery/Kiosk/Admin server modules)
PASS
```

The original audit's `.env.example` contract failure was repaired; all environment-contract tests now pass.

### Lint/build environment limitation

The uploaded source archive does not contain installed `node_modules`. Therefore:

```text
npm run lint
→ eslint: not found

npm run build
→ next: not found
```

An exact dependency restore was attempted with `npm ci`, but the configured package registry returned HTTP 404 for a locked dependency tarball (`zod-validation-error-4.0.2.tgz`). This prevented installing `eslint`/`next` in this execution environment. It is an environment/dependency-registry limitation, not a reported successful build. Run `npm ci && npm run lint && npm run build` in the normal deployment environment with registry access before promotion.

## 15. Deployment requirements

Deploy together:

- application source;
- Firestore rules;
- Firestore indexes;
- Storage rules;
- required Firebase/Paynow/push environment configuration from `.env.example`.

For broad always-on production Driver operation, a native/native-wrapped client remains the correct enhancement for reliable OS-level background GPS and push behavior when the browser is suspended. The web/PWA source in this package implements the full foreground live Driver workflow and uses server APIs that a native client can reuse without changing the delivery domain.

External legal/provider configuration remains an operating-company responsibility; the source does not fabricate regulatory approvals or provider credentials.

## 16. Acceptance target implemented in source

The activated system is designed around one authoritative operational chain:

```text
CUSTOMER
   ↓
ORDER
   ↓
BUSINESS
   ↓
DELIVERY JOB
   ↓
DISPATCH
   ↓
DRIVER
   ↓
BUSINESS / KIOSK PICKUP
   ↓
CUSTOMER HANDOFF
   ↓
DRIVER MONEY

ADMIN across the complete chain
```

Driver is no longer implemented as a local training scenario in the production route.

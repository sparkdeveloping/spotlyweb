# Spotly Web 6.2 — Production Send / Parcel Network

Release date: 2026-10-13

## What changed

Spotly Send is no longer a feature-gated customer placeholder. Version 6.2 introduces one server-authoritative parcel lifecycle spanning Customer, Driver, Driver Money, Activity, Payments and Admin Operations. Send remains disabled by default until an operator explicitly enables supported cities/areas.

## Customer

- `/send` is a first-class customer application rather than an alias for generic marketplace mode.
- Customers can choose pickup and drop-off, use current location for pickup, and create immediate or scheduled requests.
- Supported parcel sizes are Small, Medium, Large and Bulky, with server-owned weight limits, pricing multipliers and compatible vehicle types.
- Customer inputs include approximate weight, package description, declared value, sender/recipient details and Driver instructions.
- Customers must explicitly acknowledge prohibited/restricted-item rules before a request can be created.
- Quotes are server-authoritative and recheck service rollout, parcel limits, payment availability and pricing.
- Requests support Cash and Paynow when operationally enabled.
- Every Send request creates Activity continuity so the same customer can manage status, payment, cancellation and support from Activity.
- Active Send state exposes assigned Driver/vehicle and fresh Driver location when available.
- Pickup and handoff use separate four-digit PINs.
- Proof-of-delivery is exposed to the customer when the configured workflow captures it.
- Recent Send history is available directly from the Send experience.

## Scheduled Send

- Scheduled pickup can be enabled or disabled by operations.
- The minimum advance time is 20 minutes and the current maximum booking horizon is seven days.
- Scheduled jobs remain in a scheduled state instead of reserving a Driver too early.
- `/api/internal/parcel-dispatch` promotes due jobs shortly before pickup and then enters the normal dispatch lifecycle.
- The scheduler is protected by `CRON_SECRET` and configured in `vercel.json`.

## Dispatch

- Dispatch considers only online Drivers with fresh GPS, no conflicting active work, operational eligibility, approved documents/vehicle and a vehicle type compatible with the requested parcel size.
- Candidates are ranked by pickup distance and bounded by the configured pickup radius.
- Offers expire and acceptance is transactional so multiple Drivers cannot claim the same parcel.
- Stale/unmatched jobs can be redispatched by the protected dispatch watchdog.
- No-driver conditions create an operational exception rather than silently hanging.

## Driver

- Driver Jobs now includes Send offers alongside Ride and Delivery work.
- A Driver can hold only one active operational assignment across Ride, Delivery and Send.
- Active parcel lifecycle: assigned → to pickup → arrived → pickup verification → collected → en route → arrived at drop-off → handoff verification → delivered.
- The pickup PIN is mandatory before the parcel can be marked collected.
- The recipient/drop-off PIN is mandatory before delivery completion.
- If Admin requires proof photography, the Driver cannot complete delivery until a proof image has been uploaded.
- Send-specific incidents can be attached to the parcel job.
- Completion releases Driver Presence back to online availability.
- Digital Send credits Driver earnings. Cash Send records Spotly's platform fee against Driver Money because the Driver already holds the customer cash.

## Admin Operations

Admin → Driver program now has Drivers / Rides / Send / Deliveries. Send Operations includes:

- network enable/disable;
- enabled cities and optional service areas;
- base fare and per-km pricing;
- Driver share;
- cash availability;
- scheduled pickup enable/disable;
- proof-photo requirement;
- active and historical Send jobs;
- job state, fare, Driver and scheduled pickup;
- Driver discovery and controlled assignment/reassignment;
- exception clearing;
- cancellation with operational reason;
- proof-of-delivery review;
- operational audit trail.

## Payments

Paynow Send requests remain `awaiting_payment` until the existing authoritative payment processor confirms payment. Confirmed immediate requests enter dispatch. Confirmed scheduled requests remain scheduled until the pickup window. Terminal payment failures fail/release the parcel request and are reconciled through the existing payment integrity paths.

## Security

- `parcelJobs`, `parcelOffers` and `parcelEvents` are denied to direct browser Firestore access.
- Customer APIs validate ownership; Driver APIs validate current assignment; Admin APIs validate role privileges.
- Offer acceptance and assignment use server-side transactional controls.
- PINs are not included in generic Driver bootstrap data.
- Driver proof images use the scoped `driver-send-proof/{uid}/{parcelJobId}` Storage path.
- Firestore and Storage rule changes are included in this release.
- Required parcel composite indexes are included in `firestore.indexes.json`.

## Launch posture

Send remains disabled by default. Enable only controlled cities/areas after Driver supply, support coverage, parcel restrictions, pricing, payment reconciliation, proof handling and dispatch cadence are verified.

## Validation

The release adds fourteen dedicated Send production regression tests on top of the existing platform suite. See `RELEASE-VALIDATION-6.2.txt` for the final executed checks.

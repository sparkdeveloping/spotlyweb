# Spotly Web 6.1 — Production Ride Network

Release date: 2026-10-13

## What changed

Spotly Ride is no longer a customer-only placeholder. Version 6.1 introduces one server-authoritative ride lifecycle spanning Customer, Driver, Driver Money, Activity and Admin Operations. The network remains disabled by default until an operator explicitly enables supported cities/areas.

## Customer

- `/ride` provides pickup/destination search, current-location pickup, Economy/Comfort/XL selection, server-priced fare estimates and available payment methods.
- Quote and request endpoints re-check the global ride switch and city/area rollout server-side.
- A successful request creates both the operational `rideTrip` and the customer Activity order.
- Active ride state is polled from the authenticated API and includes assigned Driver/vehicle and current Driver location when available.
- Customers receive a four-digit pickup PIN; the Driver cannot start the trip without matching it.
- Customer cancellation is limited to permitted pre-trip states and records a reason/timeline event.
- Completed rides appear in Activity and can be rated through the dedicated Ride rating endpoint.
- Cash rides are collected at drop-off. Paynow rides continue through the existing payment/Activity infrastructure.

## Dispatch

- Dispatch considers only online Drivers with fresh GPS, no conflicting job, an operationally eligible Driver profile, approved vehicle/documents and a suitable vehicle type.
- Candidates are ranked by pickup distance and capped by the configured maximum pickup radius.
- Offers have an expiry and acceptance is transactional so two Drivers cannot claim the same ride.
- Old offers are withdrawn/expired and the dispatch watchdog can run another search cycle.
- No-driver cases mark an exception and create an Admin queue item instead of silently hanging.
- `/api/internal/ride-dispatch` is protected by `CRON_SECRET` and configured as a two-minute Vercel cron.

## Driver

- Driver jobs include Ride offers alongside existing delivery work.
- Offer cards show pickup/drop-off context, distance, estimated trip time and Driver pay.
- Accepting a Ride reserves Driver Presence for that ride.
- Active Ride state machine: assigned → to pickup → arrived → verification → in trip → arrived at destination → complete.
- Pickup PIN verification is mandatory before trip start.
- Completion releases Driver Presence back to online availability.
- Non-cash rides credit Driver earnings. For cash rides the Driver keeps the collected fare and Spotly's platform fee is debited through the Driver Money ledger, preventing double payment.

## Admin Operations

Admin → Driver program now has Drivers / Rides / Deliveries. Ride Operations includes:

- active/unassigned/at-risk/completed queues;
- ride detail and complete event timeline;
- Driver offers and pickup distance;
- manual dispatch;
- pre-trip assignment/reassignment with reason + audit log;
- cancellation with reason;
- exception clearing;
- fare, Driver pay and payment state;
- global ride enable switch;
- enabled cities;
- optional per-city service areas;
- base fare, per-km pricing and Driver share;
- cash ride enable/disable.

Manual Driver reassignment is deliberately blocked after the allowed pre-trip states. Later-trip problems should use the support/incident path rather than rewriting an in-progress trip.

## Security and data integrity

- `rideTrips`, `rideOffers`, and `rideEvents` are server-authoritative and denied to direct browser Firestore access.
- Customer and Driver APIs verify authenticated ownership/assignment.
- Ride assignment/offer acceptance uses Firestore transactions.
- Pickup PINs are returned only to the owning customer and are checked server-side by the Driver action endpoint.
- Admin configuration and overrides are role-gated and audit logged.
- Required Firestore indexes are included in `firestore.indexes.json`.

## Pricing

The estimate uses platform-controlled base fare, per-km, per-minute, booking fee, minimum fare and service multipliers. Distance is currently a conservative haversine-derived road-distance estimate rather than turn-by-turn routing. It is intentionally presented as an estimate; a future routing-provider integration can replace the estimator without changing the ride lifecycle.

## Launch posture

Rides remain disabled by default. Enable only controlled cities/areas after Driver supply, support coverage, pricing, payment reconciliation and dispatch cadence are verified. Scheduled rides and ride-for-someone-else remain disabled feature capabilities and are not presented as completed flows.

## Validation

The release adds dedicated Ride production regression coverage on top of the existing platform suite. See `RELEASE-VALIDATION-6.1.txt` for the final executed checks.

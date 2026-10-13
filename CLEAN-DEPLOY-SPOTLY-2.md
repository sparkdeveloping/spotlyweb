# Clean deployment instructions — Spotly Web 6.2.0

This archive is a full-source replacement for the current Spotly Web project.

## Important

Do **not** merge this archive into the older design-showcase package. Replace the application source with this package while keeping production secrets in Vercel/Firebase environment configuration.

The archive intentionally excludes:

- `.env.local`
- `.git/`
- `.next/`
- `node_modules/`
- macOS metadata

## Vercel

The directory containing `package.json` is the project root.

Recommended validation:

```bash
npm ci
npm run check:js
npm run check:theme
npm test
npm run lint
npm run build
```

## Customer product behavior

- `/` — live Spotly customer marketplace
- `/eat` — opens Eat mode
- `/shop` — opens Shop mode
- `/book` — opens Book mode
- `/events` — opens Events mode
- `/ride` — production Spotly Ride quote/request/tracking flow; requests are accepted only when Ride Operations enables the customer network for the pickup city/area
- `/send` — production Spotly Send quote/request/tracking flow; requests are accepted only when Send Operations enables the pickup city/area
- `/search` or `/?view=search` — customer search
- `/activity` or `/?view=activity` — orders, deliveries, appointments, bookings and tickets
- `/saved` or `/?view=saved` — saved businesses
- `/place/<businessId>` — shareable business detail
- `/item/<itemId>?business=<businessId>` — shareable offering detail
- `/activity/<id>` or `/order/<id>` — direct Activity detail
- `/marketplace` — compatibility marketplace route

## Feature flags

Ride can be exposed when one of these is true in platform settings:

```text
mobility.ridesEnabled
launch.ridesEnabled
```

Spotly Send is primarily controlled by:

```text
mobility.send.enabled
```

The older compatibility flags are still recognized while settings are migrated:

```text
commerce.peerDeliveryEnabled
launch.sendEnabled
```

Until Ride or Send Operations enables the relevant city/area, the customer interface communicates that the service is not available there. It does not simulate an operational request.

## 5.8.0 customer utility deployment

Deploy this archive as a clean replacement of the previous web source. Keep production `.env` values in Vercel. New Firestore rules include the self-scoped `savedItems` collection and must be deployed with the matching release.

## 5.9.0 dedicated service deployment

This release adds `/api/public/service-feed` and first-class `/eat`, `/shop`, `/book`, `/events`, `/ride`, and `/send` customer routes. No new Firestore rules are required specifically for the public feed because it reads through Firebase Admin on the server and returns only explicitly public/live marketplace records. Deploy the complete source tree rather than merging individual route files into an older build.


## 6.0.0 production-hardening deployment

This release changes Firestore security rules and adds server-authoritative growth/accounting collections. Deploy the supplied `firestore.rules` together with the application. No private credentials are included in the archive.

After Vercel completes its production build, smoke-test at minimum:

1. Eat/Shop cart → checkout → payment/order → Activity.
2. Book appointment/booking capacity collision behavior using two sessions.
3. Event ticket capacity and payment retry.
4. Merchant promotion and Spotly campaign code/automatic offer application.
5. Cancellation/payment failure releasing inventory, availability and reserved promotion usage.
6. Referral claim before first purchase → paid qualifying order → Admin reward review.
7. Verified-purchase review submission and public rating refresh.
8. `/place/<id>`, `/item/<id>`, `/city/<city>/<service>` metadata and `/sitemap.xml`.
9. Search, Saved, Activity, Account, Notifications and Help on mobile Safari and Android Chrome.

Run the full Vercel `next build` before promoting the deployment. Source integrity tests are not a substitute for the framework compiler.


## 6.1.0 Spotly Ride deployment

This release adds the production ride network across Customer, Driver and Admin. Deploy the application, `firestore.rules`, and `firestore.indexes.json` together.

Required deployment configuration:

1. Add a strong `CRON_SECRET` in the production environment. Vercel Cron calls `/api/internal/ride-dispatch`; the endpoint rejects requests without the matching bearer secret.
2. Keep `mobility.ridesEnabled` **false** during deployment.
3. In Admin → Driver program → Rides, configure enabled cities, optional service areas, base/per-km pricing, Driver share and whether cash rides are permitted.
4. Confirm Paynow is enabled in platform payment settings if Paynow should be offered for rides. The customer API will not advertise a payment method that is not operationally enabled.
5. Deploy the supplied Firestore composite indexes for `rideTrips` and `rideOffers`.
6. Confirm approved Drivers have current approved vehicle/document records and can publish fresh Driver Presence/GPS before enabling customer requests.
7. Confirm the deployment plan/scheduler supports the configured two-minute ride-dispatch cron cadence. If it does not, invoke the same protected endpoint from an equivalent trusted scheduler at the required cadence.

Before enabling a city, smoke-test with controlled Customer + Driver + Admin accounts:

1. Driver goes online and publishes a current GPS location.
2. Customer pickup inside an enabled service area produces an estimate; a pickup outside it is rejected.
3. Customer requests a cash ride and a Paynow ride (if enabled).
4. Nearby eligible Driver receives an offer; an ineligible/offline/stale-location Driver does not.
5. Offer acceptance reserves the Driver and withdraws competing offers.
6. Driver moves through pickup, arrival and pickup-PIN verification. An incorrect PIN must not start the ride.
7. Driver completes the trip; cash and non-cash Driver Money entries must follow their different accounting paths.
8. Customer sees the trip in Activity and can rate the completed Driver.
9. Admin can inspect the timeline, dispatch manually before pickup, reassign in the allowed pre-trip states, and cancel with an audit reason.
10. Stop the first offer cycle and confirm the protected dispatch watchdog expires old offers and searches again.

Do not enable Ride broadly until Driver supply, customer support coverage, operational escalation, pricing and payment reconciliation have been tested in the launch area.


## 6.2.0 Spotly Send deployment

This release adds the production Send/Parcel network across Customer, Driver and Admin. Deploy the application, `firestore.rules`, `firestore.indexes.json`, and `storage.rules` together.

Required deployment configuration:

1. Keep `mobility.send.enabled` **false** during deployment.
2. Reuse the production `CRON_SECRET` for `/api/internal/parcel-dispatch`; the endpoint rejects requests without the matching bearer secret.
3. Confirm the configured Vercel cron can invoke the protected parcel dispatcher every two minutes.
4. In Admin → Driver program → Send, configure enabled cities, optional city service areas, base/per-km pricing, Driver share, cash availability, scheduled pickup and proof-photo policy.
5. Confirm Paynow is operational if Paynow should be offered for Send.
6. Deploy the supplied Firestore composite indexes for `parcelJobs` and `parcelOffers`.
7. Deploy the supplied Storage rules before enabling proof-of-delivery photography.
8. Confirm approved Drivers have current approved vehicles/documents, fresh Driver Presence/GPS and suitable vehicle types for the parcel sizes you plan to offer.

Before enabling a city/area, smoke-test with controlled Customer + Driver + Admin accounts:

1. Customer requests an immediate Send and receives a server-authoritative quote.
2. Customer schedules a Send at least 20 minutes ahead and confirms that no Driver is reserved prematurely.
3. Test a package over the selected parcel-size weight limit and confirm the server rejects it.
4. Confirm the prohibited/restricted-item acknowledgement is mandatory.
5. Confirm only an eligible nearby Driver receives the offer and that acceptance reserves the Driver atomically.
6. Complete pickup with the customer pickup PIN; an incorrect PIN must fail.
7. Complete handoff with the recipient drop-off PIN; an incorrect PIN must fail.
8. If proof photography is enabled, confirm completion is blocked until proof is uploaded and that Admin can review it.
9. Test cash completion and verify the Driver keeps the collected cash while Spotly's fee is posted to Driver Money.
10. Test Paynow completion and verify Driver earnings are credited only after the authoritative flow completes.
11. Cancel before collection and confirm offers/Driver reservation are released.
12. Confirm Customer Activity, notifications, Send-specific support and Admin timeline/exception views all reference the same parcel job.

Do not enable Send broadly until Driver supply, support escalation, parcel restrictions, pricing, payment reconciliation, proof handling and scheduled-dispatch cadence are operationally verified.

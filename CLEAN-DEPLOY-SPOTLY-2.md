# Clean deployment instructions — Spotly Web 6.3.0 Launch Candidate

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

## 6.3.0 launch-candidate deployment

6.3 is a production-readiness release. Deploy it as a clean source replacement together with the supplied Firebase rules/indexes. Do not merge only selected 6.3 files into an older release.

### Required production sequence

1. Deploy the application with Marketplace/Ride/Send launch switches kept at their intended pre-launch or pilot state.
2. Deploy the supplied `firestore.rules`, `firestore.indexes.json`, and `storage.rules`.
3. Verify the deployed rules/emulator matrix and set `SPOTLY_RULES_VERIFIED_AT` and `SPOTLY_STORAGE_RULES_VERIFIED_AT` only after that verification is complete.
4. Verify that every production Spotly hostname is owned by the same trusted deployment, remove any dangling DNS/subdomain mapping, and set `SPOTLY_DOMAIN_SECURITY_VERIFIED_AT`. Parent-domain SSO cookies make this a launch-critical control.
5. Enrol every platform administrator in a TOTP authenticator from Spotly Account → Sign-in and security **before** turning on Admin MFA enforcement.
6. Set `SPOTLY_ENFORCE_ADMIN_MFA=true`. Admin intentionally does not use the sibling-domain custom-token bootstrap, so administrators must complete their Firebase second factor on the Admin origin.
7. Remove `BOOTSTRAP_ADMIN_EMAILS` from production after permanent administrator roles are provisioned.
8. Configure a server-only `SPOTLY_FINANCE_ENCRYPTION_KEY` of at least 32 characters and a strong `CRON_SECRET` when Ride or Send dispatch is enabled.
9. Verify production Paynow credentials for every enabled currency, transactional email, push, staffed support contacts/hours, legal identity and policy URLs.
10. Exercise monitoring/alerting and a backup/restore drill, then set the corresponding verification markers.
11. Open Admin → Launch Readiness. Resolve all **HOLD** gates and review every **CONDITIONAL** gate. A release should not be promoted merely because configuration fields are present.
12. Run the full cross-role smoke matrix below on the deployed production candidate. Set `SPOTLY_RELEASE_SMOKE_TESTED_AT` only after the matrix passes.
13. Re-open Launch Readiness. Promote customer traffic only after the resulting state and any explicit operational exceptions are accepted by the responsible operators.

### Cross-role smoke matrix

**Customer commerce**
- Eat/Shop discovery → live business/item → basket → pickup and delivery checkout → payment → Activity.
- Payment failure/retry, cancellation, inventory release, promotion reservation/release and receipt totals.
- Book/appointment capacity collision using two sessions.
- Event ticket capacity collision, Paynow completion and ticket Activity.
- Search, Saved, Notifications, Account, Help and contextual support deep links.

**Business**
- Business onboarding → location → catalogue/services → launch review.
- Live order acceptance/rejection, preparation, pickup/delivery handoff and kiosk Driver pickup.
- Booking/event operations, promotions, team permissions, settlement destination and finance visibility.

**Driver / delivery**
- Approved Driver goes online with current documents/vehicle and fresh GPS.
- Prepared delivery offer → atomic acceptance → pickup verification → drop-off PIN → earnings.
- Offline, suspended, stale-location and incompatible Drivers must not receive work.

**Ride**
- Enabled-area quote → request → Driver offer → acceptance → arrival → customer pickup PIN → trip → completion → rating/earnings.
- Out-of-area pickup, incorrect PIN, cancellation, redispatch and Admin reassignment/exception paths.

**Send**
- Immediate and scheduled quote/request → Driver offer → pickup PIN → recipient PIN → proof photo when required → completion/earnings.
- Parcel-size/weight restriction, prohibited-item acknowledgement, cancellation and delayed scheduled dispatch.

**Admin / Staff / Support**
- TOTP Admin sign-in and rejection of a non-MFA Admin API token when enforcement is enabled.
- Admin Operations views for Ride, Send and deliveries; business/Driver queues; finance/reconciliation/refunds; launch controls.
- Staff role permissions and support conversation/escalation workflows.
- Attempting to open Marketplace/Ride/Send while Launch Readiness is HOLD must be rejected and recorded as `platform.settings.launch_blocked`.

**Failure/device checks**
- Session expiry, permission denial, slow/failed network, empty data, payment pending/failed and service unavailable states.
- iPhone Safari, Android Chrome, desktop Safari/Chrome/Firefox, keyboard-only navigation, screen reader basics and reduced motion.

### 6.3 environment markers

The release introduces/uses these launch verification controls in addition to the existing Firebase/Paynow credentials:

```text
SPOTLY_ENFORCE_ADMIN_MFA=true
SPOTLY_RULES_VERIFIED_AT=<ISO date/time or controlled verification marker>
SPOTLY_STORAGE_RULES_VERIFIED_AT=<ISO date/time or controlled verification marker>
SPOTLY_MONITORING_VERIFIED_AT=<verification marker>
SPOTLY_BACKUP_VERIFIED_AT=<verification marker>
SPOTLY_RELEASE_SMOKE_TESTED_AT=<verification marker>
SPOTLY_DOMAIN_SECURITY_VERIFIED_AT=<verification marker after DNS/subdomain ownership audit>
SPOTLY_FINANCE_ENCRYPTION_KEY=<server-only 32+ character key>
CRON_SECRET=<server-only 32+ character secret when Ride/Send enabled>
```

Do not put private values into the repository or client-visible `NEXT_PUBLIC_*` variables.

## 7.0.0 V7 experience-system deployment

V7 is a clean presentation-layer and experience-system replacement on top of the production 6.3 operating platform. Deploy the repository as a whole; do not cherry-pick V7 customer components into an older release.

### Deployment sequence

1. Preserve all production environment variables, launch controls and server-only secrets from the verified 6.3 environment.
2. Replace the deployed source with this V7 repository and let Vercel perform a clean dependency install and `next build`.
3. Deploy the matching `firestore.rules`, `firestore.indexes.json` and `storage.rules` shipped with the release. V7 retains the production Ride, Send, commerce and role systems and therefore must keep those rule sets synchronized.
4. Clear any stale CDN/browser test cache before visual acceptance so old 6.x customer bundles are not mistaken for V7.
5. Test a brand-new signed-out browser: onboarding must explain Spotly, allow Explore first, ask location permission only after the explicit action, and never render fake `Again` or `Near you` content.
6. Test an onboarded account with no history: the service canvas and city-appropriate discovery should render without repeat-history claims.
7. Test a returning customer with completed commerce history: `Again` may appear only when a real completed transaction maps to a live business.
8. Test an account with active order/ride/send/booking activity: the `Now` accessory and Activity timeline must lead to the same authoritative transaction state.
9. Test Search before typing, zero-result recovery, Saved empty/signed-out states, Notifications, Profile preferences and contextual Help.
10. Test desktop and mobile navigation. Desktop should show Spotly/Search, Home/Activity/Saved and location/notifications/profile; mobile should show Home/Search/Activity/Saved/Profile.
11. Verify Reduce Motion, keyboard navigation, focus states and screen-reader labels on customer shell, onboarding, service tiles and modal/sheet flows.
12. Smoke-test Business, Driver, Staff and Admin after the shared visual-system changes. Their operating workflows and permissions must remain identical to the production 6.3 behavior.
13. Re-run the 6.3 production smoke matrix for payments, Ride, Send, Driver Money, Business finance and Admin operations before broad launch.

### V7 visual acceptance gates

- no duplicate global Search action on Home;
- no Currency selector in the global customer header;
- no `Open ↗` labels on service tiles;
- unavailable Ride/Send never visually dominate live services;
- `Again` is driven only by completed history;
- `Near you` is used only after precise location is available;
- every major customer empty state explains what belongs there and offers a next action;
- customer utility routes remain inside the same Customer Shell;
- service identity is recognizable without relying only on tile color;
- reduced-motion users do not receive ornamental movement;
- ordinary controls/cards use the V7 geometry system rather than arbitrary per-component radii.

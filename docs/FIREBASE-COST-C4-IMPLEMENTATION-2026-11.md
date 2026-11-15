# Spotly — Firebase Cost Optimization C4: Admin & Business Read Efficiency

**Source:** Spotly web C0–C3 updated source archive (November 15, 2026) and the inspected native projects from the parent audit. **Status:** implemented and tested **locally only**, not deployed. **Production data accessed:** none. **Database migrations:** none. **Native app changes:** none.

## Executive finding

The primary avoidable Admin Firestore traffic was caused by `useAdminData()` attaching all 12 collection listeners on every Admin area, including the Mobility and Work areas that have independent operational API/query layers. Account-level Business pages similarly attached operational listeners for the last selected business even though portfolio/claims/invitation views get their own data. Driver Network separately pulled up to 8,500 documents across ten queries every 15 seconds, even in background browser tabs, and scanned unrelated admin queues.

C4 removes these unnecessary subscriptions and background polls while preserving operational listener cadence **when the operator's tab is visible**. It also filters unrelated admin queues server-side and uses C0 sampled telemetry for ongoing cost measurement.

## Changes

1. **Scoped Admin subscriptions:** `lib/admin-data-scope.mjs` provides immutable, explicit source plans for eight current Admin areas and fourteen legacy routes. `components/admin-legacy-sections.js` subscribes only to sources in the active plan and detaches them on navigation. Deferred sources are not falsely counted as loading or failed. Unrecognized areas retain the full legacy plan rather than silently losing functionality.
2. **Authorization gate:** Both `components/admin-app.js` and the legacy Admin app request subscriptions only for a signed-in user whose profile has access to the area. Server-side auth and Firestore security rules remain authoritative and unchanged.
3. **Business account pages:** `components/business/business-context.js` detects account-level routes (`portfolio`, `notifications`, `claims`, `invitations`, `access`) and skips the selected-business operational subscription array, catalogue templates, lifecycle polling, and unnecessary selected-business state. The authenticated portfolio endpoint, account-specific flows, existing operational subscriptions, and active-business lifecycle checks are preserved.
4. **Driver Network foreground polling:** `components/admin-driver-operations.js` retains 15-second polling for visible tabs, triggers a fresh load when the tab becomes visible, avoids overlapping requests, retains manual refresh, and stops the timer/listener on unmount. This does not affect driver device GPS reporting, customer tracking, or dispatch.
5. **Driver review queue:** `app/api/admin/driver-network/route.js` filters `adminQueueItems` to only the three displayed Driver review queues using a single-field `in` query. The original bounded 2,000-document scan is retained as a fallback **only** for a Firestore missing-index / failed-precondition error; unrelated errors still propagate. Response keys, role checks, queue status filtering, and current collection bounds remain intact.
6. **Scan cost telemetry:** `admin.driver-network` was added to the existing `lib/cost-observability-server.js` opt-in, sampled, allowlisted event logger. It records duration, query count, fetched-document count, and estimated read floor. It never logs Driver names, GPS coordinates, PII, documents, or query parameters and produces **no Firestore writes**.

### Subscription planning — current Admin

| Area | C3 listeners | C4 listeners | Notes |
|---|---:|---:|---|
| Home | 12 | 6 | Includes businesses, claims, accounts, support, tasks and payouts |
| Work | 12 | 0 | Work Inbox / Support Console already fetch their own data |
| Marketplace | 12 | 4 | Businesses, claims, users and tasks support all sub-tabs |
| Mobility | 12 | 0 | Driver Operations has its own authenticated endpoints |
| Money | 12 | 2 | Businesses and payouts |
| Growth | 12 | 5 | Business, waitlist, partnerships, help, announcements |
| Team | 12 | 2 | Users and role templates |
| System | 12 | 4 | Businesses, users, tasks, audit for diagnostics / audit |

The table counts collection *listeners*, **not billable document reads**. Saved reads vary with collection sizes, reconnects, number of open tabs, server load and screen usage. Firestore listener reactivation and queries can still generate billable reads. Existing minimum query sizes in `lib/firebase-services.js` were not changed, because reducing unsorted read windows could silently alter which records appear.

### Business account optimization

On account-level routes that still had a selected-business ID, the selected merchant's dozen operational listeners are now skipped. The account portfolio endpoint and its own authenticated workflows are unchanged. Operational pages (Today, Activity, Catalog, Finance, Support, Settings, etc.) still attach the existing listeners on entry. No data is deleted.

### Driver Network limitations

The driver network endpoint **still** has bounded reads for drivers, applications, presence, deliveries, rides, parcels, incidents, vehicles and documents, with ten queries in total. The queue change reduces reads only to the extent that unrelated admin queue items previously filled that 2,000-record window. The **15-second cadence is not slowed for active operators**. A later project may redesign the remaining broad operational snapshots as indexed, paginated, appropriately projected feeds, but only after verifying legacy status schemas, readiness calculations, index rollout and the dispatch/incident data contract. No new claim is made that this endpoint is already inexpensive.

## Staging release gates

1. Keep cost telemetry disabled until needed (`SPOTLY_COST_TELEMETRY=true` and an appropriate low `SPOTLY_COST_TELEMETRY_SAMPLE_RATE`, e.g. `0.05`). Verify central logs, privacy and their own logging costs. Compare samples against Google Cloud Billing SKU data, not as exact invoice charges.
2. Test each of the eight Admin areas, representative sub-tabs, legacy deep links, and user role combinations. Confirm no false empty results and that offscreen modules do not hold unused subscriptions. Check Security Rules still deny unauthorized reads.
3. Verify Business portfolio, invitations, claims, notifications, switching from account page into every live operational page and back, plus merchant onboarding, lifecycle readiness and queued orders. Assert selected-business subscriptions reattach on entry.
4. Open Driver Network as an authorized operations user; verify live locations, work, safety holds, queues, expiring documents, first-week drivers, manual refresh and resume after hiding/revealing the tab. Confirm overlapping requests are suppressed on slow networks.
5. In staging, verify the single-field `queue in [...]` Firestore query executes and returns the correct review items; test a missing-index fallback and an unrelated service error. Validate queue saturation (more than 2,000 matching entries) separately; this phase does not provide comprehensive pagination.
6. Compare before/after daily Firestore read/writes, server execution, client reconnects, admin session task completion and error logs. Unexpected data absence or stale dispatch monitoring is a rollback trigger.
7. Run production Next.js build, Firebase Emulator integration tests and real staging users before promoting. These were **not** executed in this local environment.

## Rollback

No data migration, collection deletion, index deployment, rule change or Firestore TTL change is involved. Roll back C4 by redeploying the prior tested C0–C3 web build; this restores the previous Admin/Business subscription behavior and Driver Network queue scanning. No separate Firebase Functions deployment is required for C4. The original legacy queue query has an automatic fallback for missing single-field indexes, but this is **not** a general feature flag for all C4 changes.

## Tests and scope

- `node --test tests/firebase-cost-c4.test.mjs`: **8/8 pass**. Covers source plans, authorization-gated subscriptions, selected-business account isolation, visible-tab polling protections, actual Driver Network response with >2,000 unrelated queues, missing-index fallback and privacy-minimal sampled telemetry.
- Full `node --test`: **764 passed / 790 tests, 26 failures**. The untouched C3 baseline was **756 passed / 782 tests, 26 failures**. All 26 failure titles are identical; C4 introduces no new failures in this suite. The existing failures largely involve unrelated native project snapshots, source files and expectations and should be resolved independently.
- `node scripts/check-javascript.mjs`: passed.
- **Not run:** Next.js production build (web dependencies unavailable in this workspace), Firebase emulators, live Firestore/RTDB benchmarking, deployment and billing verification. This is a **staging candidate**, not a verified production release.

## Next step

C5: Customer Web & iOS Activity / Ride / Send refresh and data-loading efficiency. Retain the separate deeper Driver Network snapshot redesign as an unresolved high-value C4 follow-up, with explicit query/index/data-equivalence tests before deployment.

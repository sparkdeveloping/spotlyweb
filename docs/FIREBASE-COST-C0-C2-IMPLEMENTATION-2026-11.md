# Spotly — Firebase Efficiency Implementation (C0–C2)

**Prepared from the November 15, 2026 uploaded snapshots.** Deployment status: **not deployed**. Production billing, logs, permissions, and database contents were **not accessed or modified**.

## Scope and actual implementation

### C0: Cost baseline and guardrails (local tooling complete; cloud setup outstanding)

- Added `lib/cost-observability-server.js`, an opt-in, low-cardinality log event `spotly.cost.v1`. Allowed route identifiers are `driver.bootstrap`, `driver.live`, and `public.service-feed`; reported values are integers, known cache modes, and booleans. It does **not** log customer, driver, device, IP, token, country, address, request URL, or query terms.
- The default sample rate is 5% **only after** `SPOTLY_COST_TELEMETRY=true` is enabled; default is **off**. Server log volume and logging costs must still be monitored. Logs include estimated document-read floors, not invoice counts. Index-entry reads, transactions, Firestore internal operations, Realtime Database bytes, and other services may also be billable.
- Added `scripts/firebase-cost-report.mjs` to aggregate a Cloud Billing Reports CSV by service and SKU **offline**. Example: `node scripts/firebase-cost-report.mjs billing-2026-11.csv --json`. It does not contact any API. The CSV must have Service, SKU and Cost columns. Compare report totals to Billing console after any adjustments and credits.
- **Cloud-console work not performed:** configure billing budgets and threshold notifications, monitor Firestore read/write trends and RTDB downloads, set service-specific anomaly alerts, establish Vercel/Functions costs, and use production logs to attribute the November 11 spike. A budget alert is **not a hard spending cap**.

### C1: Driver web refresh separation (enabled by default; reversible)

- Added `lib/driver-live-server.js` as the one owner-scoped operational projection shared by **both** bootstrap and live routes, avoiding different offer/active-work semantics.
- Added authenticated `GET /api/driver/live`, returning presence, offers, assigned delivery jobs, rides and parcels and the same active-work values without historical earnings, payout accounts, vehicles, documents, and profile. Explicit `Cache-Control: private, no-store` prevents shared caching.
- Full `GET /api/driver/bootstrap` retains its existing JSON contract, finance data, readiness calculation, claim/eligibility checks, and all relevant records. The live endpoint never exposes pickup, handoff, ride, or parcel PINs; the test harness checks this.
- In `components/driver-app.js`, visible tabs check live work at **10-second intervals** (unchanged offer cadence), full account/finance at **60-second intervals**, and hidden tabs check live work at 30 seconds and full account at 300 seconds. Explicit reloads after driver actions still trigger full refresh.
- If the new live endpoint is unavailable or fails, the client immediately recovers via the original full bootstrap and resumes 10-second visible / 30-second hidden legacy recovery polling for that session. This supports rolling deployments in which the new client becomes available ahead of the endpoint.
- Full rollback: set `NEXT_PUBLIC_SPOTLY_DRIVER_SPLIT_POLLING=false` during the frontend build to use the original 10-second full-bootstrap loop (requires redeploy to change public build-time flag).

**Illustrative lower-bound comparison for one visible, eight-hour Driver web session, excluding owner profile authentication and offer fanout:**

| Pattern | Baseline query operations (approx.) |
|---|---:|
| Original: 2,880 × 18 queries | 51,840 |
| New: 2,880 × 7 live + 480 × 18 full | 28,800 |

This is a **model**, not observed billing savings; populated results and additional per-offer lookups matter significantly. Account and money queries now run six times less frequently in the steady state. Driver iOS was **not modified** in C1.

### C2: Shared cache opt-in without replacing discovery policy

- Refactored public feed computation into `computePublicServiceFeed()`, which runs the **same existing** business/branch/product/promotion queries and regional/commerce/publication gates.
- Added a 20-second `unstable_cache` for **already-public feed responses**. No raw Firestore document snapshots, private platform settings or authenticated user data are stored in the shared cache.
- Shared cache applies **only** when `SPOTLY_SHARED_SERVICE_FEED_CACHE=true`, the request has no search query/area/category, page offsets are zero, and the city key is bounded. Default is **off** because remote caching has its own billing and the response must be parity-tested on staging.
- On a cache failure, processing reverts to the uncached path. Every request still executes the existing App Check, Firestore-backed rate limit, service availability and publication flag checks. No cache is allowed to bypass a country or service kill switch.
- Existing 30-second per-process seed cache and public response headers remain. Enabling the 20-second remote response cache can increase end-to-end staleness (seed TTL + response TTL), and it **must not** replace authoritative checkout inventory/pricing validation.
- Next.js 16 documents `unstable_cache` as supported but superseded by `use cache`. Enabling the newer cache-components system across the entire app solely for this optimization would be a higher-risk change, so this phase intentionally retains the supported API.

**Outstanding C2 work:** compare production-like datasets with cache off/on (business and item IDs, counts, ranking, categories, regional restrictions, unclaimed publication, availability, prices and empty-state); inspect Vercel Runtime Cache storage/read/write charges; consider a durable, bounded materialized discovery projection as a separate migration. The current C2 change establishes the response-cache pathway but **does not yet eliminate full Firestore seed scans on cache misses**.

## Operational rollout (do not skip)

1. **C0**: Configure Cloud Billing budget alerts, e.g. 25/50/75/90/100% of a consciously chosen low ceiling, ensure email delivery, inspect cost by Service and SKU, and record a 7-day baseline. Actual limits must account for all Spotly services. Budget notifications do not shut services off.
2. Deploy web to a **staging** environment with `NEXT_PUBLIC_SPOTLY_DRIVER_SPLIT_POLLING=true`, `SPOTLY_SHARED_SERVICE_FEED_CACHE=false`, and `SPOTLY_COST_TELEMETRY=true` at a low sample rate. Verify server logs contain no identifying fields.
3. Test old driver client/new endpoint and new driver client/old endpoint; verify active offers, Ride, Send, deliveries, online/offline, GPS, PIN handoff, money, identity changes, tab backgrounding, auth failures and support.
4. Compare reads/active-driver-hour and server error rates for baseline and candidate. C1 passes only if cost falls **and** time-to-offer and safety are unchanged.
5. Enable `SPOTLY_SHARED_SERVICE_FEED_CACHE=true` on **staging only**, compare cache-hit outputs and marketplace flags, measure Runtime Cache cost and error behavior; do not enable on production until parity is demonstrated.
6. Roll out incrementally with error monitoring. Roll back Driver polling via the public build flag and shared discovery cache via server env. No database migration, permissions change, or destructive operation is required.

## Test evidence and limitations

- New focused C0–C2 tests cover offline billing aggregation, owner-scoped full/live driver parity and PIN redaction, polling flags, cache gating and error fallback.
- The full original web snapshot and updated copy both had **742 passes and 26 failures across 768 original tests**, with **identical failing test names**. Failures were already present in the uploaded snapshots and include cross-app contract checks, source-path assumptions and older assertions. The new tests pass.
- The environment does not have the Next/Firebase dependency installation or Xcode runtime needed for a real Next production build or device-level integration tests; use CI/emulators and staging before production.
- No changes to iOS apps, RTDB, Cloud Functions, Firestore rules, collection schema, indexes, retention, security limits, or payment data in C0–C2.

## Next phase

**C3**: replace only high-volume public GET Firestore-backed rate limiting with proven, distributed atomic storage, while preserving fraud-sensitive mutation limits; drain expired quota records in bounded batches with explicit retention safeguards. It should not be combined casually with C0–C2 due to authorization and billing risks.

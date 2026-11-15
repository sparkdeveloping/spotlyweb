# Spotly — Firebase Cost Optimization C3: Public Rate Limiting & Safe Retention

**Source:** C0–C2 updated Spotly web snapshot, November 2026. **Status:** locally implemented; **not deployed**. No production data read or modified. No Firebase rules/indexes or native apps changed.

## What changed

1. `lib/public-read-rate-limit.mjs` adds an atomic, fixed-window Redis/Upstash REST limiter. It executes one `EVAL` script operation per eligible public GET. It never increments a counter beyond the limit and rejects with the existing HTTP 429 contract; no raw IP is stored in the Redis key.
2. `lib/rate-limit-server.js` now selectively uses this service **only if** `SPOTLY_PUBLIC_GET_LIMITER=upstash`, the key/path pair is explicitly allowlisted, the request is GET, and no explicit identity was passed. **Default = old Firestore path.** If the Redis request is unavailable, mistyped or times out, the request falls back to the original Firestore transaction, not an unbounded allow.
3. `firebase/functions/src/core/quota-retention.js` provides a bounded, sequential cleanup for **only** `rateLimits` and `securityRateLimits`, 250 expired documents per page and 4 pages by default (max 12). Each batch must commit before the next page. Errors propagate so the scheduled function does not report a false success.
4. `firebase/functions/src/core/retention.js` integrates the new cleanup and logs aggregate counts/pages and whether a backlog *may* remain. **`auditLogs` retains the original retention window, policy bounds and one 300-document deletion batch.** No TTL policy is enabled automatically.

## Scope and security

Only the exact public GET routes for discovery, service feed, marketplace, directory, service availability, reviews, geocoding, public runtime and driver acquisition configuration are eligible for Redis. Sensitive public POSTs (waitlist, partnership, acquisition events), checkout/finance/customer/driver/admin mutations, user-scoped GETs and Cloud Functions callable quotas **remain on Firestore**. `enforceRateLimits()` multi-scope transactional application controls are unchanged.

The legacy IP identity (`x-forwarded-for` first address, falling back to `x-real-ip`) is intentionally preserved to avoid an unreviewed change to user quotas. **Security prerequisite:** verify that ingress is exclusively via trusted proxies that overwrite forwarding headers. If clients can supply arbitrary forwarded headers, they can rotate identities; this is a pre-existing concern and should be fixed as its own edge-security change after a staging compatibility test.

**Failover caveat:** Redis and Firestore maintain separate counts. During a cutover or Redis outage, users may receive an additional window's allowance when switching stores. This remains bounded by the Firestore fallback; it is not safe to assume one shared total. For expensive third-party APIs, preserve independent provider-side quotas.

## Environment and staged rollout

### Web (Vercel / Next.js server-only environment)

- `SPOTLY_PUBLIC_GET_LIMITER=firestore` (default; no change).
- `SPOTLY_PUBLIC_GET_LIMITER=upstash` enables the candidate **only** for allowlisted public GETs.
- `UPSTASH_REDIS_REST_URL=https://<provisioned-upstash-host>` and `UPSTASH_REDIS_REST_TOKEN=<server-only-credential>` must be supplied **only after** the operator provisions a Redis instance. Do not put them into client-side `NEXT_PUBLIC_` variables, commit them, or reuse the production instance in staging.
- The Redis request times out after 1.6 seconds and falls back to Firestore. Failover warnings are de-duplicated per warm server instance; observe their aggregate frequency in central logs.

### Cloud Functions retention environment

`SPOTLY_RETENTION_QUOTA_MAX_PAGES` defaults to 4; accepted whole values are 1–12. Each page is 250 docs, so at most 1,000 expired quota documents per collection per daily run by default; at the maximum, 3,000 per collection. **This variable belongs to the deployed Firebase Functions environment, not the Vercel web environment.** If your Functions deployment mechanism does not support it, leave unset (defaults to four).

Cloud Functions source is deployed separately from Next.js. After staging tests and reviewing backlogs, deploy only the `securityRetentionSweep` function through the project's standard controlled deployment pipeline. Do not deploy all Functions or Firestore rules/indexes for a retention-only change.

### Verification gate

1. Confirm Google Cloud budgets and monitoring first. Measure the daily and seven-day baseline for Firestore `rateLimits` reads/writes and existing error/429 rates. Download/analyze the billing report; do not assume all 104K reads came from this limiter.
2. On **staging**, keep `SPOTLY_PUBLIC_GET_LIMITER=firestore`; verify the unchanged paths and auth/mutation rate-limit behavior.
3. Provision a small isolated Redis database, set its budget/alerts/request quotas, enable only staging, exercise simultaneous requests from two simulated clients, and verify atomic rejection, TTL and per-IP isolation against Redis itself. Local tests simulate the Redis API but are **not a substitute for this integration gate**.
4. Simulate Redis 401, 429, 5xx, latency/timeouts, and connection failure; verify Firestore fallback and confirm that the web route still returns 429 when its fallback quota is exceeded. Monitor fallback log volume.
5. In staging, test every allowlisted endpoint as well as adjacent POSTs, authenticated customer/admin routes, checkout, claim, waitlist and driver flows. Compare semantics, errors and headers.
6. Inspect the number and oldest age of expired `rateLimits` and `securityRateLimits` docs. Verify that each cleanup run removes up to 1,000 per collection, handles pagination and retries, and never touches unexpired quotas, audit logs inside retention, or finance data. Increase page budget only with observed backlog and measured execution time.
7. Compare **combined** Firestore document reads/writes/deletes, Redis commands and bandwidth, Functions runtime, Vercel execution time/egress, and number of 429 errors. Changing vendors can make the bill *higher* if Redis requests outweigh Firestore savings. Only promote if cost and availability improve.
8. Gradually enable `upstash` in production. Disable with `SPOTLY_PUBLIC_GET_LIMITER=firestore` without schema migration. Do not switch off core rate limiting. Retention code rollback requires redeploy of the previous Cloud Function revision.

## Retention alternatives deliberately deferred

Firestore TTL is supported on timestamp fields `rateLimits.expiresAt` and `securityRateLimits.expiresAt`, but TTL deletions are billable and enabling TTL against an existing expired backlog can trigger mass deletes. This phase intentionally **does not edit** `firestore.indexes.json`, apply TTL to `auditLogs`, or delete arbitrary existing records. A separate TTL rollout can be considered after backlog counts, legal retention and cost estimates are reviewed.

## Local test evidence

- `node --test tests/firebase-cost-c3.test.mjs`: eight focused tests validate allowlist boundaries, atomic-limit last-allowed/rejected response, independent buckets, malformed/unavailable Redis behavior, Firestore fallback, unchanged POST/user-scoped controls, bounded multi-page cleanup and audit separation.
- Full repository suite checked with customer and Driver native snapshots present as sibling source trees; the existing 26 failures are unchanged from the C0–C2 baseline. C3 does not claim to resolve existing unrelated issues.
- No live Firebase emulator integration, real Redis integration, Next production build, Cloud Function deploy, or invoice verification performed in this environment.

## Sources

- Upstash REST API (atomic scripts): https://upstash.com/docs/redis/features/restapi
- Firestore TTL operation and constraints: https://firebase.google.com/docs/firestore/ttl
- Firestore index configuration reference: https://firebase.google.com/docs/reference/firestore/indexes
- Firestore best practices: https://firebase.google.com/docs/firestore/best-practices

# Spotly — Firebase Cost Optimization C5: Customer Web & iOS Status Efficiency

**Date:** November 15, 2026  
**Source:** The complete local C0–C4 Spotly web build and the customer iOS archive uploaded November 15, 2026.  
**Status:** Implemented and tested locally; **not deployed**, not a certified production build.  
**Production data accessed:** None. **Database changes:** None. **Driver iOS changes:** None.

## Purpose and safety boundary

Reduce unnecessary Cloud Firestore queries from customer Ride, Send, and Activity while preserving frequent visible tracking, authorized customer read paths, completion detection, financial operations, server-controlled dispatch, existing GPS/RTDB contracts, account isolation and recoverability. C5 deliberately does **not** introduce a new Firebase schema, index, rule, payment behavior, or migration.

## What changed

### 1. Shared visible-only, sequential web polling

- Added `lib/customer-status-polling.mjs`, a pure visibility-sensitive, non-overlapping polling controller, and `components/customer-status-polling.js`, a React hook using the controller.
- Polling stops when the document becomes hidden, reconciles immediately when visible again, and stops on unmount or account change. Ongoing requests are never duplicated; a pending foreground reconciliation is queued after a slow request completes.
- Failed polls do not clear known active work. Intervals back off to 60 seconds after consecutive errors and recover to normal frequency after success.
- This controller does not itself access Firestore, hold tokens, or store personal data.

### 2. Customer Ride (`components/ride-app.js`)

- Initial Ride history continues to be fetched once when opening the screen. **No new idle Ride history timer** was added.
- Active Ride is still requested by owned `rideId` every **8 seconds** when visible, now sequentially rather than through overlapping `setInterval` callbacks.
- The prior rider-open dispatch recovery POST could fire every 8 seconds while searching, although the server is rate limited to 30 requests/10 minutes and ignores attempts sooner than 18 seconds. C5 throttles this client retry to **25 seconds** while retaining the existing server authorization and duplicate-dispatch protections. This is a recovery path, not a substitute for an independently reliable dispatch scheduler.
- On terminal state (`completed`, `cancelled`, `failed`), the customer history is refreshed immediately, as before.
- Stale in-flight responses from a previous signed-in user are ignored, and the old account's local Ride/history state is cleared when the UID changes.

### 3. Customer Send (`components/send-app.js`)

- Previously, a mounted Send screen made a full history request **every 10 seconds**, even with no active delivery. The list query is bounded to 60 parcel jobs; a busy account could repeatedly fetch those records.
- C5 refreshes the inactive list **once per 60 seconds while visible**. The initial list load still runs immediately on screen entry.
- When a live parcel is present, C5 reads the existing owner-checked single-parcel endpoint (`?parcelJobId=...`) every **10 seconds**. This retains live status, driver data, map tracking, and handoff PIN behavior without re-fetching up to 60 historical parcels.
- Scheduled/requested/searching dispatch refresh attempts remain available at **45-second** throttle. The server still validates ownership, state, due time, and recent dispatch.
- Terminal states (`delivered`, `cancelled`, `failed`, `returned`) trigger a new list read immediately to reconcile history/receipt state.
- UID changes clear old local parcel/history data; stale responses from prior users are discarded.

### 4. Customer iOS (`spotly/Core/Stores/ActivityStore.swift`)

- Raised the passive, non-forced Activity cache age from **15 to 30 seconds** to avoid duplicate work when users rapidly switch Home/Activity tabs.
- If a full Activity request is already in progress, an additional forced refresh is **queued instead of concurrently starting another five-source query**. The pending force is replayed once after the running request settles. This preserves mutation-triggered/manual refreshes instead of simply dropping them.
- A user/identity reset clears pending refresh state. Existing generation and owner checks continue to reject stale responses.
- Ride/Send tracking detail loops, explicit post-payment refreshes, pull-to-refresh, push deep links, and booking actions were not changed.

## Before/after cost model — illustrative, not billing measurements

| Case | Previous request pattern | C5 request pattern | Potential reduction |
|---|---|---|---|
| Send tab open, no active parcel, one hour | ~360 history requests | ~60 history requests | ~83% fewer full-list requests |
| Send tab open, active parcel, one hour | ~360 full-list requests | ~360 single-parcel requests | Up to 59 fewer historical docs per status request when list is full |
| Ride tab open, active trip, one hour | ~450 detail requests | ~450 detail requests | Same visible tracking cadence, no status slowdown |
| Ride client dispatch recovery while searching | Up to ~450 POST attempts/h before server throttling | At most ~144 POST attempts/h | ~68% fewer retry attempts, before actual backend throttling |
| Hidden background browser tab | Polling could continue | 0 scheduled status polls while hidden | Up to 100% of avoidable background polls |

These are upper-bound *request* examples for one continuously mounted tab, not confirmed Firestore billing savings. Active Send detail also performs legitimate driver and RTDB lookups. Total cost depends on actual account histories, routing, permissions, provider pricing, Firestore security queries, cloud invocations, rate-limit operations, and how often tabs are visible. Do not use these numbers as an invoice forecast.

## Tests and release verification

- New C5 controller/integration source tests: `node --test tests/firebase-cost-c5.test.mjs` — **8/8 pass**. They cover visibility, automatic foreground reconciliation, overlap suppression, network errors/backoff, teardown, per-job status endpoints, existing API ownership checks, and the iOS coalescing source path when the native sibling is present.
- Full web regression suite `node --test`: **772 passing, 26 failing / 798 tests**. Against the original C4 build (**764 passing, 26 failing / 790 tests**) the **26 failure titles are identical**. No new failures were introduced in this suite.
- `node scripts/check-javascript.mjs`: **passed**; this includes the project's React-hook import checks.
- `swiftc -frontend -parse` on all **184** files in the complete original customer native project with the one C5 edit: **passed**. This is *syntax parsing*, not Apple SDK typechecking or an Xcode build.
- **Not run:** Next.js production build (web dependencies unavailable), Xcode build/simulator (macOS toolchain unavailable), Firebase emulator tests, deployed route E2E tests, real RTDB/location tests, and billing-SKU measurements.

## Staging checklist and go/no-go gates

1. Run a Next.js production build and CI/integration suites from a fully installed environment.
2. Confirm `spotlyafrica.com/ride` and `/send` or their actual route equivalents for a signed-in customer with no active job, active job, completed job, and signout/signin of a second customer. Check that the previous customer's data never appears.
3. Test with multiple browser tabs, hidden/revealed tab, low network quality, prolonged slow response, network recovery and tab close/unmount. Confirm only one operational status request per job per interval, and an immediate reconcile on return.
4. Request and cancel Ride and Send with real staging data, validate state changes, payments, refunds, quote logic, verified roadside locations, PIN reveal, driver reassignment, vehicle identity and driver map position.
5. Validate scheduled Send and Ride recovery dispatch with app foreground and background. **Independently verify a trusted scheduler exists for recovery when no customer or driver is online**. C5 does not build that scheduler.
6. Build the provided full native iOS project in Xcode and test boot, Home, Activity pagination, forced refresh, fast navigation, account switching, active Ride/Send, manual pull-to-refresh and post-checkout history updates.
7. Measure actual per-user Firestore documents fetched, function invocations, RTDB downloads, request duration, error/reconnect rate and Google Cloud Billing by SKU before/after. Revert if dispatch, completion, support, payment, or visibility behavior regresses.

## Rollback

No migration or persistent data transformation is involved. Revert the 2 modified web components, remove the 2 new web polling modules and 1 C5 test file, and restore the original `ActivityStore.swift` from the November 15 customer iOS archive; or redeploy the existing C0–C4 web build and prior iOS binary. Do not attempt to roll back Firebase data; none was changed.

## Unresolved cost opportunities

- The customer Activity API (`app/api/customer/activity/route.js`) still queries up to **640 documents across five collections** per request and performs in-memory global sorting/pagination. Optimizing this correctly needs new query/index and pagination-contract equivalence tests to avoid hiding older-but-active orders or support records. C5 did not blindly reduce its bounds.
- Ride and Send details still fetch driver/vehicle/presence and RTDB location on an active poll. A future projection or server-controlled versioning solution should benchmark whether reducing these correlated reads preserves active safety and freshness.
- Existing C0–C4 staging gates, optional Redis limiter and disabled shared discovery cache remain subject to their earlier rollout reports.
- No direct evidence from live Firebase billing has yet been collected; projected savings should not be represented as achieved savings.

# Spotly Web 7.0 — iOS Native Contract Update

This package is the companion backend/web update for the Spotly customer iOS production-parity build.

## Added contracts

- `GET /api/customer/activity` — authenticated normalized cross-service Activity records for orders, bookings, tickets, rides and Sends.
- `GET /api/public/marketplace/businesses` — batch marketplace business hydration for Saved, with unavailable ID reporting.
- `POST /api/customer/account/deletion` — authenticated account-deletion initiation record with active-transaction blocker summary.

## Data/product fixes

- Eat taxonomy uses word-boundary-aware classification so `barber` cannot be classified by the `bar` token.
- Service-feed categories are derived from the central marketplace profile instead of leaking arbitrary raw business categories across services.
- Open marketplace discovery deduplicates same-name places only when they are geographically nearby or share a concrete area/address signal; this resolves duplicate OSM node/way representations such as 7 Arts without collapsing unrelated same-name venues across a city.
- Notification persistence and push delivery now preserve strict workspace ownership so customer, Business, Driver, Staff and Admin products do not fan the same operational notice across each other.
- `.env.example` now documents required server-only OpenAI, finance-encryption and scheduler variables without values.

## Validation

- `npm test`: **335/335 passing**.
- `npm run audit:v7-ui`: **76 checks across 39 themes passing**.
- `npm run audit:launch`: **111 API routes passing static audit**.
- `node --test tests/ios-native-contracts-integrity.test.mjs`: **7/7 passing**.
- Syntax checks for all changed route/library files: **PASS**.

## Deployment order

1. Deploy this web/backend package.
2. Confirm the live host no longer returns 404 for `/api/customer/activity` or `/api/public/marketplace/businesses`.
3. Run `node scripts/audit-ios-contracts.mjs` with `SPOTLY_BASE_URL` set to the production host. An optional `SPOTLY_ID_TOKEN` lets the script verify an authenticated 200 response for Activity; without it, 401/403 proves the route exists.
4. Configure the real Firebase iOS app ID and APNs credential for the native app.
5. Build/archive the iOS package in Xcode 27 and run the release/device matrix.

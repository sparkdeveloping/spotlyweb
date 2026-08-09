# Spotly Business Data Model Inventory

## New / expanded collections

### `masterProducts`
Canonical product identity, verification, barcode/search, provenance and image rights.

### `catalogCollections`
Curated reusable sets of master product IDs.

### `catalogueSources`
Source registry including rights/permission status and allowed use.

### `productObservations`
Spotly Staff field observations tied to master product, business and branch.

### `productImageVersions`
Original/AI-derivative provenance and approval state.

### `catalogImportBatches`
Merchant import batch metadata and review state.

### `businessLedgerEntries`
Immutable-style server-authored merchant financial events.

### `businessBalanceAccounts`
Per-business/per-currency balance buckets.

### `businessSettlementAccounts`
Restricted settlement credentials and verification state.

## Expanded existing models

### `products`
Can now contain `masterProductId`, canonical metadata hints, image provenance/rights, publication state and `branchOverrides`.

### `businesses`
Contains safe summary state under `moneySetup` for operational readiness without exposing banking credentials.

### `payouts`
Can identify ledger-backed requests and settlement-account last four.

### `orders`
Merchant settlement status/reference participates in Money reconciliation.

## Storage paths

- business catalogue originals/enhanced derivatives under business-scoped catalogue paths
- `master-products/drafts/...` for authorized Staff capture
- `master-products/verified/...` under restricted governance
- `settlement-proofs/...` server-controlled

## Data ownership rules

- Master product identity belongs to Spotly catalogue governance.
- Merchant offers belong to a business.
- Branch overrides belong to merchant operating context.
- Product observations are evidence, not automatic live merchant edits.
- Full bank details are restricted server data.
- Financial ledger is server authoritative.

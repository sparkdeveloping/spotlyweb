# Spotly Business 5.4 Security Report

## Business portfolio

Portfolio resolution occurs server-side and uses the hardened active/scoped membership model from 5.3. URL business IDs are treated as untrusted and business APIs re-check access.

## Canonical catalogue

Normal merchants can consume verified library records and create merchant offers/suggestions; they do not directly obtain unrestricted canonical master-product mutation authority.

Staff catalogue capture and review require Spotly staff permissions. Master-product Storage paths have corresponding restricted rules.

## Product media

The AI enhancement endpoint checks authentication, catalogue permission, business scope, source Storage path, input type/size and per-user rate limit. API credentials stay server-only. AI output does not overwrite the source.

## Financial privacy

`businessSettlementAccounts` direct client access is restricted. The Business Money API returns only sanitized settlement data. Full account numbers are encrypted server-side and only last four are surfaced.

Money operations require finance-specific permission. A catalogue/order role does not inherently gain bank-detail access.

## Payout integrity

Payouts are validated transactionally against server balance and verified settlement state. Ledger entries and balance mutations are server-controlled.

## Rules coverage added

Firestore/Storage rule source now explicitly covers:

- master products
- collections
- observations
- image versions
- import batches
- ledger/balance data
- settlement accounts
- master-product images
- settlement proof paths

The emulator test matrix was expanded for these resources but **could not be executed in this environment** because `firebase-tools` cannot be retrieved from the configured npm registry.

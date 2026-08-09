# Spotly Business OS 5.4 Implementation Report

## Release

- Version: **5.4.0**
- Release label: `5.4.0-business-os`
- Scope: `/business` account architecture, multi-business routing, claims/access, catalogue platform, Staff product capture, AI-assisted product media, merchant Money/settlement/payout foundations, Admin catalogue/finance operations.

## Business account architecture

`/business` is now a permanent account-level portfolio rather than an alias for whichever business was last selected. It supports an account with zero, one, or many business relationships without changing the product model.

Implemented account destinations:

- `/business` — portfolio home
- `/business/claims` — permanent claims and applications centre
- `/business/invitations` — pending invitation centre
- `/business/access` — effective roles and scope

The portfolio API resolves access server-side from active memberships, organization-wide scope, direct business scope and branch-limited scope. Claims and invitations are account-level and remain visible after the first business is approved.

The portfolio home is task-oriented. It surfaces businesses, roles, setup state, claims, invitations and actionable attention rather than generic aggregate metrics.

## Explicit business context

Operational deep links now carry `business=<businessId>`. URL context takes priority over remembered browser state. The remembered business remains only a convenience fallback.

The searchable business switcher includes recent/accessibly available businesses plus account-level links to portfolio, claiming and adding a business.

## Existing merchant operations preserved

The existing selected-business workspace remains the operating layer for:

- Today
- Setup
- Orders/activity
- Products/catalogue
- Locations
- Kiosk where applicable
- Insights
- Promotions
- Team
- Money
- Help
- Settings

Today retains its location-level operational design while account-wide obligations remain accessible above it.

## Spotly Master Product Library

Implemented canonical product infrastructure with:

- `masterProducts`
- `catalogCollections`
- `catalogueSources`
- `productObservations`
- `productImageVersions`
- `catalogImportBatches`

Merchant product records can reference `masterProductId`. Canonical identity is separated from business price, stock, availability and branch overrides.

Matching priority is:

1. Exact barcode / GTIN
2. Existing master product ID
3. Manufacturer SKU
4. Normalized brand + name + variant + pack size
5. Fuzzy candidate requiring review

Fuzzy candidates are never silently merged.

## Merchant product acquisition

Catalogue now supports:

- Search Spotly Library
- Barcode scan with manual fallback
- Bulk library selection
- CSV/XLS/XLSX import
- Manual creation
- Existing starter/template flows
- Branch-level price, stock, availability and SKU overrides
- Reset to inherited business defaults

Spreadsheet imports create private review drafts and preserve batch/source metadata. Exact/strong master matches can be attached; possible fuzzy matches are explicitly flagged for review.

## Spotly Staff catalogue capture

`/staff/catalogue` provides field capture rather than forcing field workers through raw Admin forms.

Staff can:

- Select business/location
- Scan or enter barcode
- Confirm an existing canonical match
- Record observed price and availability
- Capture front/back product images
- Create provisional master products
- Record observations
- Review/approve/reject records when authorized

Admin Content now has product-library governance for review, duplicate merging, collections and source/rights inspection.

## Product image provenance and AI enhancement

Original product images are retained and assigned provenance/rights metadata. AI results are stored as separate `productImageVersions` records and require human approval before use.

The server endpoint is:

`POST /api/business/media/enhance-product`

It requires authenticated catalogue-edit access, enforces source-path ownership and a per-user rate limit, fetches the original from Spotly Storage, sends the edit server-side using `OPENAI_API_KEY`, stores the derivative separately, and records the model/mode/audit event.

Environment variables:

- `OPENAI_API_KEY`
- `OPENAI_IMAGE_MODEL` (default `gpt-image-2`)
- `OPENAI_TRANSPARENT_IMAGE_MODEL` (default `gpt-image-1.5`)

Normal edit requests use the current Images edit API JSON image-reference format. Transparent-background mode uses a separately configurable model so the implementation does not assume every image model supports transparent output.

## Catalogue source and rights policy

Public retailer websites are modeled as research/reference sources unless Spotly has explicit publication rights. Product images carry rights states such as:

- `merchant_owned`
- `spotly_photographed`
- `manufacturer_provided`
- `licensed`
- `permission_pending`
- `reference_only`

Reference-only / permission-pending imagery is blocked from publication.

No bulk retailer scrape or copied retailer image library was added to the release.

## Money architecture

Business Finance is now presented as **Money** and uses a controlled **platform-settlement pilot model** rather than exposing unimplemented direct/hybrid settlement as equal choices.

Implemented:

- `businessLedgerEntries`
- `businessBalanceAccounts`
- `businessSettlementAccounts`
- Server-authoritative balance buckets per currency
- Verified settlement-account workflow
- Encrypted full bank account number server-side; only last four returned to clients
- Settlement proof upload
- Payout request validation against authoritative available balance
- Ledger-backed payout reservation and transitions
- Admin settlement-account review
- Admin order-to-available reconciliation
- CSV statements from ledger activity

Money buckets include pending, available, reserved, payout processing and paid out. The browser no longer derives the authoritative payout balance from loaded orders.

Existing legacy finance records remain readable for compatibility where needed, but new Money writes use the new server-authoritative model. Business readiness now follows the new `moneySetup` summary rather than the legacy finance document.

## Payment integration with merchant ledger

When a paid order is confirmed by the hardened payment processor, the business ledger records the captured order total and Spotly service-fee debit. Merchant funds remain pending until reconciliation marks the order available. Full manual refunds create corresponding ledger effects.

## Security and privacy

New high-impact operations are server-authoritative. Firestore/Storage rules were extended for the new catalogue and financial collections. Full settlement account values are not returned by merchant/Admin read APIs.

Business IDs in URLs remain untrusted input; APIs continue to require authenticated scoped business permissions.

## Internal operations added

Admin/Staff can now operate the new Business system through:

- Product library review
- Duplicate product merge
- Catalogue collections
- Source/rights registry
- Settlement-account review
- Merchant-settlement reconciliation
- Existing claims/support/finance queues

## Remaining external dependencies

This source is **not represented as production-build verified** because the current execution environment cannot install the repository dependencies. Firebase emulator, lint, production build, browser visual/accessibility QA and real provider testing remain required before production launch.

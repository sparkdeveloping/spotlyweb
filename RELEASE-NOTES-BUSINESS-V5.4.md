# Spotly Business 5.4 Release Notes

## Business becomes an account, not one selected store

- `/business` is now the permanent Business Portfolio.
- Claims and invitations remain accessible after approval of another business.
- Added Claims, Invitations and Access centres.
- Added server-authoritative portfolio resolution.
- Added searchable business switching.
- Business context is explicit in operational URLs.

## Catalogue platform

- Added Spotly Master Product Library.
- Added verified library search and bulk add.
- Added barcode lookup/scanning.
- Added branch offer inheritance/overrides.
- Added CSV/XLS/XLSX import review.
- Added source/rights provenance.
- Added Staff field product capture and Admin product governance.

## Product photography

- Original product photo is preserved.
- Merchants can request server-side OpenAI enhancement.
- AI output is a separate version with provenance and approval.
- Reference-only imagery cannot be published as if Spotly owns it.

## Money

- Business Finance is now Money.
- Merchant balances come from a server-authoritative ledger.
- Added verified bank settlement accounts.
- Full account number is encrypted and not returned to clients.
- Payouts cannot exceed available settled balance.
- Customer payment method is separated from merchant payout destination.
- Controlled pilot uses one platform-settlement model rather than fake direct/hybrid options.

## Validation

- 56/56 local tests pass.
- JavaScript check passes.
- Theme safety check passes.
- Full install/lint/build/rules-emulator remain externally blocked by the current package registry and are not represented as passing.

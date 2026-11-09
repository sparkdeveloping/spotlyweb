# Spotly Canonical Contracts v1

`spotly-contracts.v1.json` is the canonical wire-contract source for customer web, customer iOS and Driver iOS.

## Rules

- Wire identifiers are stable within major version `1`.
- Additive enum values or optional fields may be introduced within v1 only when all clients can safely ignore them.
- Removing/renaming identifiers, changing required field meaning, or changing an existing wire type requires a new major contract file.
- Do not hand-edit generated bindings. Regenerate them from the canonical manifest.
- Web runtime schemas live in `lib/contracts/schemas.js` and must derive their enum/domain values from `lib/contracts/generated.js`.
- iOS bindings contain the SHA-256 of the exact canonical manifest. Cross-client verification fails when snapshots or generated metadata drift.

## Generation

```bash
npm run contracts:generate
```

To refresh iOS bindings explicitly:

```bash
node scripts/generate-contract-bindings.mjs \
  --customer-swift /path/to/spotly/spotly/Core/Contracts/SpotlyContracts.swift \
  --driver-swift /path/to/spotlydriver/spotlydriver/Core/Contracts/SpotlyContracts.swift
```

## Cross-client verification

```bash
node scripts/verify-contract-snapshots.mjs \
  --customer /path/to/spotly \
  --driver /path/to/spotlydriver
```

This phase defines the contracts only. Country/service runtime configuration, Firebase Functions infrastructure and launch controls belong to later phases.

## Service availability contract

`spotly-service-availability.v1.json` defines the five runtime states shared by web, Firebase Functions, customer iOS and Driver iOS: `hidden`, `preview`, `discover`, `live`, and `paused`.

Runtime configuration lives in `platformSettings/global.serviceAvailability`. Resolution is deterministic: city override → country override → service default → canonical bootstrap. Only `live` permits new customer transactions; `discover` and `paused` may remain browsable, while `preview` is presentation-only and `hidden` is not exposed.

```bash
npm run services:generate
npm run services:check
npm run services:verify-snapshots
```

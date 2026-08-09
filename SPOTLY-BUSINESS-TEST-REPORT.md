# Spotly Business 5.4 Test Report

## Dependency-independent suite

Command:

```bash
npm test
```

Result:

- **56 passed**
- **0 failed**

The 17 Business OS-specific regression areas include:

- permanent Business portfolio routes
- authoritative organization/business access resolution
- URL business-context precedence
- canonical product matching priority
- image-rights publication safety
- CSV parser behavior
- branch inheritance/override/reset
- merchant ledger capture/fee separation
- payout bucket transitions
- negative-balance liability handling
- API-backed Business Money
- encrypted settlement account / last-four output
- authoritative payout validation
- server-only OpenAI enhancement / original preservation
- CSV/XLS/XLSX import + camera permission
- Staff catalogue capture/review
- Firestore/Storage sensitive collection coverage

Existing security, payment, theme, pickup and workspace tests also remain green.

## Static checks

```bash
npm run check:js
```

Passed.

```bash
npm run check:theme
```

Passed across **114 source files** and **23 classified route patterns**.

## Rules emulator

`tests/emulator/rules-emulator.mjs` was expanded with master-product and financial catalogue coverage. Execution is pending because `firebase-tools` cannot be downloaded from the current internal npm registry.

## Tests still required externally

- Firebase Auth/Firestore/Storage emulator execution
- production lint/build
- Playwright/browser Business flow tests
- real camera scanning
- live OpenAI product edit test
- real payment/settlement/reconciliation test
- keyboard/NVDA/VoiceOver/zoom validation

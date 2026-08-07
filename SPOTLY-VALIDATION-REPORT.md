# Spotly Validation Report

**Candidate:** 5.1 production-depth pass  
**Environment:** Node.js `v22.16.0`, npm `10.9.2`  
**Repository requirement:** Node.js 22.x, npm 11 or later

## Passed checks

| Check | Result |
|---|---|
| Node built-in tests | **7 passed, 0 failed** |
| Pickup availability tests | Configured hours, full-capacity exclusion and paused-location behavior passed |
| Browser-state tests | User scoping and logout cleanup passed |
| Workspace tests | Access-record evaluation and explicit settings routes passed |
| JavaScript/JSX parser pass | **110 files, 0 syntax errors** |
| Local import scan | **0 failures** |
| Unused import/local scan | **0 findings** |
| Selected undefined/duplicate diagnostics | **0 findings** |
| JavaScript-only repository check | Passed |
| Literal route scan | **23 page routes, 247 links, 0 broken** |
| JSON parse | **6 files passed** |
| SVG parse | **5 files passed** |
| Native prompt/confirm scan | **0** |
| `font-black` scan | **0** |
| Archive hygiene | `.git`, `.next`, `.env.local`, `node_modules`, `.DS_Store` excluded from release archive |

Test command output summary:

```text
1..7
# tests 7
# pass 7
# fail 0
```

## Dependency installation limitation

The environment attempted:

```bash
npm ci --ignore-scripts --no-audit --no-fund --registry=https://registry.npmjs.org
```

Package downloads repeatedly failed with network/DNS `EAI_AGAIN`, including `zod-4.4.3.tgz` and `zod-validation-error-4.0.2.tgz`. The environment also had npm 10.9.2, below the repository’s npm 11 requirement.

Consequently, the following are **not claimed as passed**:

- `npm ci`
- `npm run lint`
- `npm run build`
- Next.js hydration/runtime browser checks
- Vercel Preview deployment

Run these in a normal Node 22/npm 11 environment before staging promotion:

```bash
npm ci
npm test
npm run check:js
npm run lint
npm run build
npm run start
```

## Validation still required externally

- Firebase Emulator tests for Firestore and Storage rules
- Authenticated role/workspace matrix
- Browser console/network smoke tests
- Paynow sandbox initiation, return, result callback, polling, duplicate payment and reconciliation
- Cancellation/refund reservation release
- Resend/push delivery and preference enforcement
- Claim/support attachment malware scanning
- NVDA and VoiceOver
- Keyboard-only full-route testing
- 320px reflow, 200% and 400% zoom
- Slow-network and interrupted-upload behavior
- Exact Preview commit versus source verification

## Release conclusion

Source-level validation is clean and the custom tests pass. The package is a staging candidate, not a proven production build, until dependency installation, lint, Next.js build, rules emulation and browser acceptance pass on the exact commit.

#!/usr/bin/env bash
# RB2 non-deploying verified web build procedure for a networked, trusted CI runner.
# Never run unreviewed branch code with production secrets. Source candidate only.
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "$(node -p 'process.versions.node.split(".")[0]')" != 22 ]]; then
  echo 'BLOCKED: install Node.js 22.x before the release build.' >&2; exit 2
fi
if [[ -z "${CI:-}" ]]; then
  echo 'This script expects an isolated CI runner. Set CI=true only in a reviewed CI job.' >&2; exit 2
fi
npm ci --no-audit --no-fund
npm run check:js
npm run functions:check
node scripts/verify-contract-snapshots.mjs --customer "${SPOTLY_CUSTOMER_IOS_ROOT:?Set customer project root}" --driver "${SPOTLY_DRIVER_IOS_ROOT:?Set Driver project root}"
npm run audit:launch
# This gate fails on skipped dependency- or private-fixture tests.
npm run audit:release-tests:rb1
npm run build
printf '\nWEB BUILD COMPLETE FOR CI CANDIDATE ONLY — NOT A PRODUCTION APPROVAL\n'

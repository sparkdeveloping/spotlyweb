# Spotly Business 5.5.3 — Test Report

## Automated source/unit suite

The release adds `tests/business-lifecycle-orchestration.test.mjs` and expands existing Business/security tests.

Coverage includes:

- exactly five merchant-facing lifecycle stages;
- setup completion based on actual data;
- deterministic requested-step/prerequisite behavior;
- explicit Business URL routing;
- persistent Business layout ownership;
- lifecycle-gated navigation;
- pre-live Today protection;
- merchant progress separated from Spotly reviews;
- server-authoritative launch submission and Admin decision;
- transaction protection against duplicate launch submissions;
- Firestore authority over launch/publication;
- specific settlement wording;
- pre-live catalogue privacy language;
- Admin final-launch queue and structured changes;
- suspended-state behavior;
- global launch controls;
- launch-critical invalidation and live re-review;
- trusted Admin suspend/resume;
- safe Admin-created initial business state;
- paused re-review approval preservation;
- trusted branch structural operations;
- Kiosk configuration whitelist;
- partial profile save/search-term integrity;
- future setup steps not silently completed from defaults;
- pre-live branch/public-child customer visibility gate;
- marketplace customer-live discovery;
- order creation live-state transaction recheck.

Final dependency-independent Node suite result: **102 passed, 0 failed**.

The 5.5.3 additions specifically exercise authoritative lifecycle consistency, canonical location selection, completed-foundation Stage-3 stability, Portfolio synchronization, structured submit blockers, settlement parity, direct-owner access parity and duplicate submit protection.

## Firestore emulator matrix

`tests/emulator/rules-emulator.mjs` was expanded to cover lifecycle review authority, branch structural restrictions, Kiosk safe configuration and pre-live child-record visibility.

The emulator suite could not be executed in the generation environment because `npx` could not retrieve `firebase-tools` from the internal npm registry. Java 21 is present.

## Browser/manual QA still required in staging

- 320/375/768/1440 viewports in light/dark;
- keyboard/screen reader/zoom;
- slow-network sidebar stability;
- setup refresh/back/forward;
- 0/1/2/20 business accounts;
- preparing/live/review/suspended switching;
- final review request-changes/resubmit/approve;
- settlement review and Money integration;
- large catalogue readiness behavior;
- real Firebase rules emulator and authenticated staging behavior.

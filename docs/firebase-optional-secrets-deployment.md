# Firebase deployment modes and optional provider secrets

Spotly separates **core customer callable functions** from functions that require encrypted handoff PINs or a licensed search provider. This separation is a deployment selection, **not a feature flag that disables security**.

## Core only — no custom PIN or MapTiler secret values required by these callables

```bash
cd ~/Desktop/spotlyweb
npm --prefix firebase/functions run check
npm run firebase:deploy:functions:core -- --account spotlyafrica@gmail.com
```

This script explicitly selects the following `platform` codebase exports:

`platformFoundation`, `authenticatedFoundation`, `serviceAvailability`, `customerRuntime`, `customerDiscovery`, `customerRideQuote`, and `customerSendQuote`.

**Scope:** bootstrapping, service availability, discovery, runtime, and quote callable deployment. Quote calculations **still require a configured and functioning road-routing provider** to return valid road routes/fare estimates. Final Ride/Send transaction creation and dispatch are separate; **this is not an end-to-end Ride/Send launch**. The app's Apple/native and local business search can still be used where available, but MapTiler-backed `customerPlaceSearch` is not deployed in core-only mode.

**Secrets:** none of these seven callables bind `SPOTLY_RIDE_PIN_KEY`, `SPOTLY_SEND_PIN_KEY`, or `SPOTLY_MAPTILER_GEOCODING_KEY` in `firebase/functions/src/index.js`. The Firebase CLI or Cloud Functions project may still require the Secret Manager **API to be enabled** for discovery/other deployment infrastructure; omitting secret-bound functions does not guarantee every Google Cloud prerequisite is absent.

## Optional enhanced place search

Only after `SPOTLY_MAPTILER_GEOCODING_KEY` is properly configured in Firebase Secret Manager:

```bash
npm run firebase:deploy:functions:place-search -- --account spotlyafrica@gmail.com
```

This deploys `customerPlaceSearch`. No real provider key means no MapTiler search results; do **not** create a fake API key. Retain Apple/local/marketplace fallback in iOS. Validate POI coverage and license requirements before enabling.

## Encrypted Ride/Send Driver PIN verification

Only after **both** the legitimate Ride and Send PIN encryption secrets are securely configured:

```bash
npm run firebase:deploy:functions:driver-pin -- --account spotlyafrica@gmail.com
```

This deploys `driverWorkAction`, which calls the trusted Driver state machine. This callable handles Driver transitions as well as pickup and handoff PIN validation. Deploying it without the matching encryption key would break verification for existing `v1` ciphertext records.

**Do not**:
- Treat a Stripe `sk_live_...` credential as a Ride/Send PIN secret.
- Replace existing encryption keys without checking outstanding encrypted Ride/Send transactions.
- Remove PIN checks or allow drivers to bypass a required `verify_pickup` or `complete` transition.
- Save keys in Git, client apps, screenshots, or public logs.

The web's existing `lib/ride-security.js` and `lib/send-security.js` use AES-256-GCM with a derived key. Driver verification must use the **same source secret** for encrypted PINs. New deployments need a deliberate key migration if historic ciphertext must remain decryptable. For genuinely keyless verification in a future phase, design and migrate a versioned server-only proof protocol (with rate limits and audit), not a security-off toggle.

## Full deployment (all functions, secret prerequisites apply)

```bash
npm run firebase:deploy:functions -- --account spotlyafrica@gmail.com
```

If Firebase proposes deleting functions during a partial or full deploy, stop and review the target before confirming. Avoid `--force` or unreviewed destructive changes.

Verify after deployment:

```bash
npx --yes firebase-tools@15.35.0 functions:list --project spotly-africa --account spotlyafrica@gmail.com
```

**Preflight:** use the correct project/account, confirm IAM, App Check, Firebase API activation, routing credentials and operational readiness. A successful deploy is not evidence that quote/routing or final transaction creation works. Test each function in a staging environment before promoting changes.

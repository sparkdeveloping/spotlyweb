# Spotly Firebase Platform Foundation

Phase 2 establishes Firebase as the common platform runtime without migrating every existing web mutation yet.

## Runtime boundaries

- **Cloud Firestore**: authoritative durable product/business/transaction records.
- **Cloud Functions 2nd gen**: trusted mutations, payment/dispatch/capacity orchestration, audit and server-only invariants.
- **Realtime Database**: ephemeral high-frequency Driver presence and active-trip location only.
- **Cloud Storage**: media/evidence binaries; authoritative metadata remains in Firestore.
- **FCM**: delivery channel for operational/customer notifications; notification truth remains in Firestore.

## Function policy

- Node 22, ESM, `europe-west1`.
- New trusted mutations must use `defineTrustedMutation`, which requires Firebase Auth and App Check by default. App Check token consumption/replay protection is opt-in for high-risk functions because it requires additional IAM configuration.
- The two Phase 2 diagnostic callables intentionally do not enforce App Check yet so existing clients can verify the new runtime before App Check rollout.
- Trusted mutations must use idempotency for money, inventory, capacity, dispatch acceptance, refunds and other retry-sensitive operations.
- Function-only collections are denied to client Security Rules.

## RTDB policy

Clients never write authorization. Functions/Admin SDK maintain `runtimeAccess/*` mirrors. A Driver may write only their own presence when `runtimeAccess/driverEligible/{uid}` is true. Active-trip location writes require a server-issued trip authorization. Dispatch consumes RTDB with Admin privileges; the public client cannot enumerate dispatch presence.

## Phase boundary

Phase 2 does not switch customer flows from `/api` to callable Functions, enable Malawi, add service availability controls, or replace Driver mock state. It creates the deployable secure foundation those phases use.

# Spotly 5.3 Security Implementation Report

## Scope
Spotly 5.3 replaces the broad authorization shortcuts identified in the 7 August audit with scoped server authority. The implementation follows the supplied 5.3 completion brief.

## Firestore authorization
- Platform administration is limited to `super_admin`, `admin`, `platform_admin`, or explicit `admin.*`; `support.*` and `businesses.*` no longer imply platform administrator authority.
- Business access requires an active, non-expired membership plus explicit business scope. Direct business owners remain separately supported.
- Branch-scoped order access requires the assigned branch unless the actor has business-wide authority.
- Memberships and business invitations are server-write only.
- Orders are server create/update only; trusted order events are server-write only.
- Trusted audit logs are server-write only; client telemetry is stored separately.
- Privileged user role/permission changes are now handled by `/api/admin/user-access`.
- Payout creation/settlement state changes are server-authorized through `/api/payouts`.
- Support conversation/message writes are server-authorized through `/api/support/conversations` and rate limited.
- Public waitlist and partnership submissions are server-only and rate limited.

## Business team and invitations
- Team listing now comes from `/api/business-team`, not a broad client membership query.
- Branch-scoped managers only receive members/invitations overlapping their assigned branches.
- Invitation grants are server-issued and immutable to invitees.
- Acceptance requires `serverIssued: true`, grant version 1, non-expiry, matching authenticated email, valid business/branch relationships, a still-authorized issuer, a grantable role, and canonical/subset permissions.
- Invitation acceptance and membership creation occur in a transaction.
- Legacy mutable invitations must be reissued.

## Storage authorization
- Business media writes require active scoped business access and appropriate media/catalogue permission.
- Membership expiry is enforced.
- Claim/verification/support/staff paths have explicit actor/domain checks and file constraints.
- Public catalogue/public business media remain publicly readable by design once a URL is published; publication visibility is enforced by business/product documents. This is a documented limitation of the current storage layout.

## Public read/query compatibility
- Public text business search includes `public == true`.
- Public location queries include `businessId == ...` and `public == true`.
- Public catalogue subscription includes `businessId`, `published == true`, and `active == true`; Firestore rules additionally require the parent business to be public.
- Required composite indexes were added to `firestore.indexes.json`.

## App Check and abuse controls
- Authenticated API requests can enforce Firebase App Check when `SPOTLY_ENFORCE_APP_CHECK=true`.
- Client API calls attach `X-Firebase-AppCheck` when App Check is configured.
- Waitlist and partnership endpoints also verify App Check when enforcement is enabled.
- Public waitlist, partnership and support write paths use server-side Firestore-backed rate limits.
- Admin launch readiness reports App Check as Ready only when settings, site key and server enforcement agree.

## Security tests
Dependency-independent security assertions are included in `tests/security-commerce-integrity.test.mjs` and pass locally.

A Firebase Auth/Firestore/Storage emulator matrix is prepared at `tests/emulator/rules-emulator.mjs`. Execution is blocked in this environment because `firebase-tools` is not available from the internal npm registry. Therefore emulator authorization is **prepared, not verified**.

## Remaining external/security work
- Run the emulator suite in a normal Firebase CLI environment.
- Validate deployed App Check enforcement before enabling it globally.
- Configure attachment malware scanning/quarantine before broad public file uploads.
- Observe CSP report-only violations in staging before enforcing CSP.
- Run adversarial authenticated browser tests against the deployed rules and exact staging build.

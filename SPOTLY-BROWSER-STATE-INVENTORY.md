# Spotly Browser and Persistent State Inventory

The application now treats state as device preference, session state, account state or operational server state.

## Device-local preferences

| Key | Storage | Scope | Data | Clear condition | Privacy impact |
|---|---|---|---|---|---|
| `spotly-theme` | localStorage | Device/browser | Light/dark choice | User reset or browser data clear | Low |
| `spotly-sidebar-collapsed` | localStorage | Device/browser | Desktop sidebar preference | User toggle or browser data clear | Low |
| `spotly-admin-queue-views:<queue>:<user scope>` | localStorage | Authenticated user on device | Saved filter/view definitions | User removes view, logout cleanup where applicable, browser clear | Low; no case content should be stored |
| `spotly-business-id:<user scope>` | localStorage | Authenticated user on device | Last selected business identifier | Logout/account change or browser clear | Moderate identifier only |
| `spotly-branch-id:<business>:<user scope>` | localStorage | Authenticated user on device | Last selected location identifier | Logout/account change or browser clear | Moderate identifier only |

## Session-scoped state

All keys use `:<user:UID>` or `:<session:UUID>` suffixes.

| Base key | Storage | Data | Clear condition | Privacy impact |
|---|---|---|---|---|
| `spotly-anonymous-session` | sessionStorage | Random anonymous session ID | Browser tab/session close | Low |
| `spotly-marketplace-location` | sessionStorage | Selected city/area and optional coordinates | Logout, account switch, session close or reset | Moderate location preference |
| `spotly-marketplace-cart` | sessionStorage | Business/location IDs and basket items | Successful order, logout, account switch, session close or clear basket | Moderate shopping data |
| `spotly-checkout-draft` | sessionStorage | Checkout step, contact, pickup and payment preference | Successful order, logout, account switch, session close or reset | Sensitive contact/transaction draft; scoped and temporary |
| `spotly-support-conversation` | sessionStorage | Active conversation identifier | Close/reset, logout, account switch or session close | Moderate; server enforces participant access |
| `spotly-business-claim-draft` | sessionStorage | Temporary anonymous claim draft before sign-in | Transfer to account, reset, session close | Sensitive business draft; account draft becomes authoritative after sign-in |
| `spotly-driver-training` | sessionStorage | Fictional scenario and training stage | Reset, logout, account switch or session close | Low; no real dispatch data |

## Account/server state

| Record | Purpose | Authority |
|---|---|---|
| User profile/preferences | Language, notification choices, phone, preferred contact, pickup contact and accessibility preferences | Account record |
| `businessClaimDrafts` | Cross-device claim progress and evidence links | Authenticated claimant |
| Claim evidence Storage objects | Persisted evidence uploads | Authenticated claimant and authorized reviewers |
| `staffTrainingAssignments` | Learning progress, quiz and completion | Staff/manager records |
| `supportConversations` | Participant, context, lifecycle, messages and satisfaction | Server/authorized participants |
| Driver assignments | Reserved for future operational driver state | Server; current Driver remains training-only |
| Orders/order requests | Order truth and idempotency | Server transaction |
| Branch booked slots/product reservations | Pickup capacity and stock allocation | Server transaction |

## Legacy migration and cleanup

- Legacy unscoped cart, checkout and claim keys are migrated once into scoped state and removed.
- Logout invokes `clearUserSessionState(user)` to remove the current user’s transient keys without deleting another account’s state.
- Account changes receive a different scoped key.
- Sensitive state must not be added to global localStorage.

## Remaining policy work

- Define retention and deletion periods for server claim drafts, support attachments and completed checkout drafts.
- Add automatic expiry/release for abandoned stock and pickup reservations.
- Confirm shared-device/kiosk logout behavior in browser tests.
- Ensure external notification senders consult account preferences.

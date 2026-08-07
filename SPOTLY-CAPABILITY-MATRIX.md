# Spotly Capability Matrix

Status values are intentionally conservative.

| Feature | UI complete | Backend connected | Persistent | Mobile complete | Accessibility checked in source | Status | Remaining limitation |
|---|---:|---:|---:|---:|---:|---|---|
| Semantic light/dark theme | Yes | N/A | Browser preference | Yes | Static contrast/source checks | Pilot-ready | Browser screenshot and manual assistive-technology validation pending |
| Form-control system | Yes | N/A | N/A | Yes | Static source/contrast checks | Pilot-ready | Browser-native select, autofill and mobile-keyboard validation pending |
| Public launch page | Yes | Waitlist/finder connected | Yes | Yes | Yes | Pilot-ready | Approved launch content and real featured businesses required |
| Public business combobox | Yes | Yes | N/A | Yes | Yes | Pilot-ready | Requires browser/manual screen-reader verification |
| Customer location discovery | Yes | Yes | User/session | Yes | Yes | Pilot-ready | Distance requires valid branch coordinates and approved data |
| Customer business search | Yes | Yes | URL/session | Yes | Yes | Pilot-ready | Cross-business product search is not claimed |
| Basket | Yes | Yes | User/session | Yes | Yes | Pilot-ready | Requires production shared-device/logout smoke testing |
| Pickup availability | Yes | Yes | Branch records | Yes | Yes | Pilot-ready | Merchant configuration quality controls real availability |
| Checkout | Yes | Yes | User/session plus server order | Yes | Yes | Pilot-ready | Production payment integration remains |
| Order idempotency | N/A | Yes | Server | N/A | N/A | Pilot-ready | Provider payment idempotency still needs end-to-end tests |
| Product/slot reservation | N/A | Yes | Server transaction | N/A | N/A | Pilot-ready | Release is implemented; emulator and end-to-end concurrency validation remain |
| Customer order tracking | Yes | Yes | Server | Yes | Yes | Pilot-ready | Notification-provider tests required |
| Business claim flow | Yes | Yes | Account/server | Yes | Yes | Pilot-ready | Parent approval review operations need real pilot validation |
| Claim evidence | Yes | Yes | Storage/server | Yes | Yes | Pilot-ready | Malware scanning is an external production dependency |
| Claim status timeline | Yes | Yes | Server | Yes | Yes | Pilot-ready | Review communication depth depends on admin operations |
| Merchant Today | Yes | Yes | Server | Yes | Yes | Pilot-ready | Operating-hours and team-shift data quality required |
| Merchant mobile orders | Yes | Yes | Server | Yes | Yes | Pilot-ready | Specialized non-retail archetypes remain staged |
| Retail substitution | Partial | Yes | Server | Yes | Partial | Prototype | Customer approval/price-difference lifecycle needs deeper integration |
| Catalogue quick updates | Yes | Yes | Server | Yes | Yes | Pilot-ready | Bulk workflows need pilot-scale validation |
| Catalogue management | Yes | Yes | Server | Yes | Yes | Pilot-ready | Rich variant model remains limited |
| Import review | Yes | Yes | Server | Yes | Yes | Prototype | Real source/provenance review operations required |
| Publishing/customer preview | Yes | Yes | Server | Yes | Yes | Pilot-ready | Rollback depth depends on record history availability |
| Driver workflow | Yes | No live dispatch | Session | Yes | Yes | Training-only | No operational assignments, GPS proof, payout or fleet sync |
| Staff Today | Yes | Yes | Server | Yes | Yes | Pilot-ready | Pilot data and manager processes required |
| Staff task records | Yes | Yes | Server | Yes | Yes | Pilot-ready | Some linked operational record types need richer detail views |
| Staff learning | Yes | Yes | Server | Yes | Yes | Prototype | Media hosting, assessment authoring and manager sign-off content required |
| Staff assets/pay/leave | Yes | Yes | Server | Yes | Yes | Pilot-ready | Payroll provider/export remains external |
| Admin Control Centre | Yes | Yes | Server | Yes | Yes | Pilot-ready | Real provider telemetry required |
| Admin operational queues | Yes | Yes | Server plus device saved views | Yes | Yes | Pilot-ready | Bounded progressive loading exists; true cursor pagination and richer communication remain |
| Admin platform health | Partial | Partial | Server | Yes | Yes | Prototype | Provider, callback, notification and indexing telemetry required |
| Account profile/preferences | Yes | Yes | Account/server | Yes | Yes | Pilot-ready | Notification delivery enforcement requires provider tests |
| Workspace access | Yes | Yes | Account/server | Yes | Yes | Pilot-ready | Must be verified against production role data |
| Support conversation | Yes | Yes | Account/session/server | Yes | Yes | Pilot-ready | Staffing and response commitments required |
| Support attachments | Yes | Yes | Storage/server | Yes | Yes | Pilot-ready | Production malware scanning required |
| Support lifecycle/rating | Yes | Yes | Server | Yes | Yes | Pilot-ready | SLA/agent workflow requires operational testing |
| Paynow | UI/routes exist | Pending production configuration | Server | Yes | Partial | Pending integration | Credentials, callbacks, reconciliation, refunds and settlement tests |
| Email/push notifications | Preferences/UI exist | Pending provider validation | Account/server | Yes | Partial | Pending integration | Resend/VAPID/App Check and preference enforcement |
| Legal/privacy text | Pages exist | N/A | Versioning limited | Yes | Partial | Pending integration | Final approved Zimbabwe-specific documents required |
| Firestore/Storage rules | Drafts updated | Yes | Deployed only by owner | N/A | N/A | Blocked | Emulator/adversarial test suite not run in this environment |
| Production build | Source validated | N/A | N/A | N/A | N/A | Blocked | `npm ci` failed because the internal mirror returned HTTP 404 for zod-validation-error |

# Spotly 5.3 Capability Matrix

| Feature | UI complete | Backend connected | Authorization verified | Persistent | Mobile | Tested | Status |
|---|---|---|---|---|---|---|---|
| Public marketing / waitlist | Yes | Yes | Server write + rate limit; emulator pending | Yes | Yes | Static/local | Pilot-ready after staging |
| Public business search | Yes | Firestore | Rules/query aligned in source; emulator pending | N/A | Yes | Static/local | Pending verification |
| Customer marketplace | Yes | Firestore/API | Scoped queries in source; emulator pending | Yes | Yes | Unit/static | Pending verification |
| Pickup availability/reservation | Yes | Server/Firestore | Server authority | Yes | Yes | Unit; concurrency emulator pending | Pending verification |
| Paynow initiation | Yes | Paynow/server | Server authority | Yes | Yes | State/static; live provider pending | Pending integration |
| Paynow callbacks | N/A | Server | Server-only | Yes | N/A | State/static; replay live test pending | Pending verification |
| Refunds | Admin UI/API | Manual reconciliation | Finance permission | Yes | Admin responsive | Static/local | Pilot-ready for full manual refunds after staging |
| Business claim | Yes | Server/Firestore/Storage | Server decisions; emulator pending | Yes | Yes | Local/static | Pending verification |
| Business team/invitations | Yes | Server | Scoped server grants; emulator pending | Yes | Yes | Static/local | Pending verification |
| Merchant orders | Yes | Server/Firestore | Branch scoped server mutation | Yes | Yes | Local/static | Pending verification |
| Catalogue | Yes | Firestore | Scoped rules | Yes | Yes | Theme/static | Pending verification |
| Payouts | Yes | Server | Scoped finance/server mutation | Yes | Yes | Static/local | Pending verification |
| Staff | Yes | Firestore | Domain rules; emulator pending | Yes | Yes | Local/static | Pending verification |
| Admin queues | Yes | Server | Platform/domain permission | Yes | Responsive | Static/local | Pilot-ready after staging |
| Support | Yes | Server/Firestore/Storage | Server write + participant read | Yes | Yes | Static/local | Pending scanning/staging |
| Driver | Training UI | No live dispatch | Training-only | Session | Yes | Local | Training-only |
| App Check | UI/config support | Firebase | Optional API enforcement implemented | N/A | N/A | Static | Pending production configuration |
| CSP | N/A | Header | Report-only | N/A | N/A | Static | Needs staging observation |
| Production build | N/A | N/A | N/A | N/A | N/A | Not executable here | Blocked by package registry |

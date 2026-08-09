# Spotly 5.4 Capability Matrix

| Feature | UI | Backend | Authorization | Persistence | Mobile | Test evidence | Status |
|---|---|---|---|---|---|---|---|
| Business Portfolio | Complete | Server portfolio API | Scoped active memberships | Server | Responsive | Local/static | Pilot candidate; staging pending |
| Business Claims centre | Complete | Claims server/Firestore | Account/claim scoped | Server + drafts | Responsive | Local/static | Pilot candidate; staging pending |
| Business Invitations centre | Complete | Server accept/decline | Immutable grants | Server | Responsive | Local/static | Pilot candidate; emulator pending |
| Business Access centre | Complete | Portfolio access resolver | Server scoped | Server | Responsive | Local/static | Pilot candidate; emulator pending |
| Multi-business switching | Complete | Portfolio API | Authorized businesses only | URL + safe recent local state | Responsive | Unit/static | Pilot candidate |
| Selected-business Today | Complete | Firestore/API | Business/branch scoped | Server | Responsive | Existing tests | Pilot candidate; browser pending |
| Orders | Complete | Server/Firestore | Branch/business scoped | Server | Responsive | Existing security/local | Pilot candidate; staging pending |
| Merchant catalogue | Complete | Firestore/API | Catalogue scoped | Server | Responsive | Unit/static | Pilot candidate; emulator pending |
| Spotly Master Product Library | Complete core | Server library API | Verified read + Staff governance | Server | Responsive | Unit/static | Pilot candidate; seed/review growth ongoing |
| Barcode catalogue add | Complete core | Library API | Business/Staff scoped | Server | Camera/manual | Unit/static | Device QA pending |
| Spreadsheet import | Complete | Client parser + server matching | Business scoped | Draft/batch server records | Responsive | Unit/static | Pilot candidate; browser QA pending |
| Branch product overrides | Complete | Product persistence | Business scoped | Server | Responsive | Unit | Pilot candidate |
| Staff product capture | Complete core | Staff catalogue API | Staff permissions | Server/Storage | Mobile-first | Unit/static | Pilot candidate; device/emulator pending |
| Product AI enhancement | Complete integration | OpenAI server API | Catalogue permission + rate limit | Storage + image versions | Responsive | Static/unit | Pending live provider verification |
| Image rights/provenance | Complete core | Publication validation | Catalogue governance | Server | Yes | Unit/static | Pilot candidate |
| Business Money | Complete core | Server Money API | Finance-specific | Server ledger | Responsive | Unit/static | Pilot candidate; operational verification pending |
| Merchant ledger | Complete core | Server/Firestore | Server authored | Server | N/A | Unit | Pilot candidate; reconciliation QA pending |
| Settlement account | Complete core | Server encrypted record | Finance + recent auth for change | Server | Responsive | Unit/static | Pending real bank/process verification |
| Merchant payouts | Complete controlled flow | Server ledger/payout API | Finance scoped | Server | Responsive | Unit/static | Pending operational payout rail/process verification |
| Admin settlement reconciliation | Complete core | Admin Money API | Finance admin | Server | Responsive | Static/local | Pilot candidate; staging pending |
| Admin product governance | Complete core | Staff catalogue API | Catalogue review permission | Server | Responsive | Static/local | Pilot candidate |
| Public/customer marketplace | Existing | Firestore/API | Hardened 5.3 | Server | Responsive | Existing suite | Pending staging/emulator |
| Driver | Training UI | No live dispatch | Training-only | Session | Yes | Local | Training-only |
| Firebase rules emulator | Test matrix implemented | Emulator | Adversarial matrix | N/A | N/A | Not run here | Blocked by package registry |
| Production lint/build | N/A | N/A | N/A | N/A | N/A | Not run | Blocked by package registry |

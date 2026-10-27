# Spotly First Access — launch-readiness audit

**Audit date:** 27 October 2026  
**Source:** `spotlyweb-main (3).zip`, an uploaded repository snapshot dated 22 October 2026.  
**Scope:** launch experience, registration, source tracking, early-access eligibility, agency access, admin operations, security, analytics, and rollout. This is a **code-level audit**, not an audit of live production data or credentials.

## Executive assessment

The submitted Spotly codebase already had Firebase Auth, Firestore, a public launch mode, a basic lead form, an admin shell with account roles, and a `privateBeta` profile flag. Those capabilities did not constitute a usable acquisition funnel: the old lead flow did not necessarily create a Spotly account, channel reporting was sparse, there was no cohesive agency workspace, and customer-facing access was not consistently gated after landing-page routing.

This release adds **Spotly First Access**, a purpose-built signup experience that creates real Firebase email/password accounts and records selected services, city, audience, timing and attribution, together with agency-restricted administrative tools. The separate **maintenance** screen is available via the existing admin launch-mode switch. Countdown controls exist but are **off by default**.

**Release status: CODE DELIVERED; LIVE RELEASE NOT VERIFIED.** Targeted automated tests and parser checks pass. A production dependency install, Next.js build, Firebase emulator run, authenticated end-to-end test, and deployment were not possible in this execution environment. This package must be validated in a configured CI/staging environment before activating traffic.

## Findings and implementation

| Area | Before | Implemented in this package | Remaining production work |
|---|---|---|---|
| Public marketing | Launch modes and a basic older landing | Branded, responsive First Access landing with real-account registration, service explainer, legal links, referral-sharing and separate maintenance screen | Browser/device visual QA, accessibility audit, copy approval |
| Registration | Legacy email lead document | Firebase account created before first-access record is linked; Firebase verification email attempted; optional city, 3 interests, audience, urgency, phone and marketing opt-in | Verify Email/Password sign-in, authorized domains, Firebase email templates and SMTP deliverability |
| Attribution | Source text/limited fields | UTM source/medium/campaign/content/term, referral code, first-touch and last-touch metadata, referrer origin only; classified WhatsApp, Meta, TikTok, etc. | Distribute tagged links; untagged in-app social traffic may be recorded as direct |
| Acquisition | Basic signup totals | First-party view, form-start and registration counts, sharded by UTC date; campaign rollups | Validate rates under load and monitor Firestore spend; bot-filter strategy |
| Demand signals | Limited | Interest, city, customer/business/driver audience, and urgency aggregates | Add richer feedback surveys when needed |
| CRM/agency | General admin pages | Growth → First Access dashboard; lead stages, assignee, internal notes, contact activities, next follow-up, client-side list filters, paginated source data, scoped exports | Server-side query/search across entire list, bulk actions, automation and notifications remain future work |
| Beta | Profile flag already existed | Controlled grant/revoke endpoint (audit logged), frontend customer gates and server-side checks on major new commercial transactions | Route inventory and authenticated cross-subdomain E2E tests; review any additional write paths |
| Maintenance | Existing mode | Designed maintenance screen and blocked new-customer transaction routes | Confirm exceptions and health/support flows |
| Countdown | No launch toggle in main workflow | Target date and public visibility toggle in launch settings | Set an approved public launch date only when ready |
| Agency privileges | Generic roles | Launch manager, outreach coordinator, business onboarding; access via scoped permissions and server API | Grant individual accounts, never share super-admin credentials; review custom permissions |

## Access and consent model

- First Access account creation is managed by Firebase Auth; the server accepts the UID only from a validated Firebase ID token. Email must match that authenticated account. A pre-existing account-linked registration cannot be overwritten anonymously or by a different account.
- Marketing opt-in is separate from requested operational launch updates. The form links to Spotly Terms and Privacy Policy. Agency operators must honor opt-in and outreach preferences and local legal requirements.
- Source attribution is **self-reported by URL metadata**, not a forensic guarantee that a user came from a particular app. WhatsApp/Instagram browsers frequently suppress referral headers, so agency-owned tagged links are mandatory for reliable channel classification.
- First-party visit metrics do not store IPs or browser fingerprints as analytics data. Per-session page-view deduplication and Do Not Track are observed in the page code. Infrastructure rate limiting may still process connection identifiers.
- Launch counters and contact histories are server-owned in Firestore rules. Read/write APIs require authenticated, role-scoped permissions. Sensitive personal information is not embedded in the campaign counters.
- Default roles do **not** let agency staff change platform settings, grant private beta, view payments, assign super-admin privileges or change Firestore security rules.

## Data model

| Firestore collection | Purpose | Write authority |
|---|---|---|
| `users` | Existing identity, roles, and `privateBeta` flag | Auth-provisioning process / authorized admin API |
| `waitlistEntries` | Legacy leads and new First Access registered accounts; immutable first attribution, latest attribution, audience/interests, account link, stage and owner | Public rate-limited authenticated first-access endpoint; authorized staff API |
| `firstAccessMetrics` | 32 sharded daily first-party views, starts, signups, channel and demand summaries | Server-only |
| `firstAccessCampaignMetrics` | 16 daily shards per tagged campaign | Server-only |
| `firstAccessTouchpoints` | Call/email/WhatsApp/meeting/note history | Authorized staff API, server-only |
| `auditLogs` | Privileged lead edits, agency outreach and beta grant/revoke records | Trusted server routes |
| `platformSettings/global` | Root mode, private beta global switch, countdown target/visibility | Authorized platform administrator |

## Security and operational caveats

1. **No claims of live production readiness:** no Firebase production credentials or connected browser E2E tests were used. Firestore rules and indexes are checked in but have not been deployed here. A release cannot be approved without that step.
2. **Potential bypass inventory:** server-side rollout gates cover the identified order, ticket/booking, ride, parcel, assist and independent-shopping request creation endpoints. All other customer mutation endpoints, direct Firestore client writes and legacy routes should undergo a dedicated staging-access audit before treating maintenance as a hard freeze. A frontend gate alone is not a security boundary.
3. **Current live platform mode matters:** the default for a fresh config is `first_access`, but an existing Firestore `platformSettings/global` document may retain `marketplace` (or another mode). A designated administrator must deliberately select and save **First Access landing** in admin launch settings. Updating defaults alone does not switch an existing production site.
4. **Analytics are prospective:** metrics begin when the updated build is active, not when earlier leads were collected. Referral codes permit link attribution but do not implement referral reward issuance, deduplication or fraud screening.
5. **Scale/cost:** a view or form-start records a Firestore write; campaign-tagged views write a second sharded document. Monitor Firestore write rates, Vercel function usage and budget alerts during launches. Reporting only reads recent rollup documents; lead list requests are paginated. Campaign rollups are capped at 5,000 retrieved documents per reporting request and indicate truncation.
6. **CRM limits:** filters/sorts operate on the **currently loaded page**, not the entire Firestore lead collection; CSV exports up to 500 entries per request. Do not present these as global filtered totals. Automated email and WhatsApp sending is **not implemented**; links open native mail, telephone or WhatsApp, and the team logs outcomes manually.
7. **Privacy:** review actual published Terms and Privacy pages, unsubscribe procedures, records-retention and deletion pathways for leads and touchpoints. Invite codes are random, not password-equivalent; avoid publishing private notes, exported CSVs or support details.
8. **Security posture of overall repository:** this change is a focused launch upgrade; do not interpret it as proof that every existing business/admin/commerce workflow has been audited, despite targeted coverage. Schedule further access reviews and API fuzzing.
9. **Existing project quality gates:** comparing baseline and modified full test runs shows 18 identical known failing checks (including route contracts and theme). The uploaded snapshot contains `next-env.d.ts` and `tailwind.config.ts`, while `scripts/check-javascript.mjs` rejects all TypeScript; baseline `npm run check:js` fails. The theme policy also reports numerous pre-existing fixed-color and unclassified-route violations. Those existing repo-wide checks need remediation independently of this launch screen.

## Validation performed against the edited snapshot

- **48/48 targeted Node tests passed:** First Access, existing marketing-launch integrity, commerce-security integrity, cross-site experience and admin operations. **Whole source-suite comparison:** baseline upload 498/516 passing with 18 failures; modified source 506/524 passing with the *same* 18 failing test names — no additional static-suite regressions. The eight newly introduced First Access tests all pass.
- **535 JS/TS/JSX source files parsed:** zero parser errors using a TypeScript syntax pass (not a bundled Next build).
- **Theme regression:** the new admin First Access component no longer triggers a named-palette theme-policy warning; baseline failures remain elsewhere.
- **Not performed:** complete `npm ci` (network dependency unavailable), `npm run lint`, `npm run build`, Firebase emulator end-to-end, Vercel production deployment, analytics volume test, external mail deliverability, or mobile-browser screenshot QA.

## Required release gate

In an environment with configured environment variables and dependencies:

1. `npm ci` using the Node/npm versions required by `package.json`.
2. `node --test tests/first-access-launch.test.mjs tests/marketing-launch-integrity.test.mjs tests/security-commerce-integrity.test.mjs tests/v9-cross-site-experience.test.mjs tests/admin-operations-v9.test.mjs`.
3. `npm run lint` and `npm run build`; resolve any existing baseline failures separately. Run `npm run check:js`, `npm run check:theme`, and the existing repo security test suite as standard release policy.
4. Deploy the updated Firestore rules and indexes; verify composite index `firstAccessTouchpoints(entryId ASC, createdAt DESC)` is ready before testing outreach history.
5. Use a staging Firebase account to sign up via `/?utm_source=whatsapp&utm_campaign=launch-2026&utm_content=agency-video-01`; verify Auth user creation, verification mail, corresponding Firestore lead, campaign counters and dashboard data.
6. Test account login, second signup, expired token retry, form validation, Do Not Track, multi-device referral attribution, password reset and legal links.
7. Grant a test agency account `agency_outreach_coordinator`. Verify CRM access, editing and activity logging succeed, while finance, platform configuration, user-access grants, beta permission and exports are rejected with **403**. Separately test `agency_launch_manager` export.
8. Grant/revoke private beta as a platform administrator; try new orders/rides as invited and non-invited users, including direct API calls. Switch to maintenance and confirm new requests fail while support/account access remains.
9. Verify runtime Firestore/Vercel usage and cost alerts. Only then publish the campaign links.

See `FIRST-ACCESS-AGENCY-HANDOFF.md` for agency-facing instructions.

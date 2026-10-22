# Spotly V9 Admin operating model

Audit: 22 October 2026. Source baseline: `b3473af`. Production data **not** inspected or modified in this audit. Use the authenticated Admin UI for real records.

## Mental model

- **Person/account**: Firebase Auth UID, email, status, assigned roles and memberships.
- **Organization**: legal/grouping entity; one organization can control multiple brands.
- **Business/brand**: customer-facing identity; one brand can have multiple locations.
- **Branch**: actual venue, pickup point or fulfillment location. Financial, catalogue and location evidence may vary by branch.
- **Business claim**: applicant asks to prove a relationship. **Creator**, **claimant**, **approved owner** and **merchant** are different states.
- **Directory visibility**: discovery does not imply ownership approval or orderability.
- **Commerce readiness**: secure verified merchant workflows control orders, payouts, fulfillment and launch.
- **Spotly Assist**: independent acquisition by Spotly. Source research, locations, menus and price checks are not a restaurant partnership and must not be marked as a merchant's own stock.
- **Operational case**: Support conversation, approval queue item, safety incident, payment exception or merchant review. Every decision should leave an audit trail.

## Where operations belong

| Area | Working source | What staff should do | Current shortfall | Next milestone |
|---|---|---|---|---|
| Home | 12 client subscriptions (some capped at 100) | See priority queue and navigation | Small samples presented as platform-wide metrics | Server aggregated SLA/counter dashboards with freshness labels |
| Businesses | `businesses`, `organizations`, `branches` | Inspect status and provenance; find owners or creator | Legacy table only 100, little provenance | **Milestone 1 implemented**: paginated register, filter, exact email lookup, detail drawer |
| Ownership / compliance | `businessClaims` and location/launch queues | Review evidence, request changes or approve using audited routes | Work distributed across claims, launch reviews, branch pages | Unified case details and linked evidence/action trails |
| Assist | `independentShoppingStores`, research and fulfillment records | Confirm independent store identity, requestable menus, pricing and coverage | Different hierarchy to owned merchant brands | Cross-link both entities by location and source, no merchant conflation |
| Support | `supportConversations`, messages and context | Assign, prioritize, reply/internal note, resolve or escalate | Subscription capped at 300, date/category sorting missing | **Milestone 1 implemented**: date/category triage, explicit aging and linked business register. Follow-on: SLA timers, queue metrics and cross-channel event logging |
| Work queues | `businessClaims`, `adminTasks`, `adminQueueItems`, financial issues, conversations | Own open cases and act via specialized decision endpoints | Aggregates are inconsistent, some incidents not in Work | Server-side event feed and case timeline with owner/due date |
| Finance | `paymentIntents`, settlement/refund/reconciliation collections | Reconcile actual money, never infer success from UI | Multi-route, incomplete consolidated audit | Daily close ledger, exceptions, proof-backed refunds and cash controls |
| Mobility | Driver applications, documents, dispatch heartbeats, Ride/Send lifecycles | Approve eligibility, investigate delivery and safety | Preview/lab vs live sometimes blurred | Real session, pickup/PIN, route, payment and safety monitoring |
| Team/access | Firebase Auth + `users`, memberships, role templates | Grant least privilege, audit changes | Operational roles spread across pages | Effective permission inspector and per-person capability matrix |
| Growth/content | Promotions, referrals, public content, source imports | Control content provenance, campaigns and customer reach | No unified publication calendar | Campaign calendar, approval and performance reporting |
| System | launch flags, email, routing, secrets, App Check, diagnostic endpoints | Operate protected integrations and readiness | Technical configuration lacks explanatory runbooks | Evidence-oriented launch gates, incident runbooks, change history |

## Priority fixes and acceptance standards

**P0**
1. Find the account that added two businesses via Business register → exact account email. Verify `createdBy` versus `ownerIds` versus `businessClaims.applicantId`; do not automatically approve.
2. Review Admin subscription completeness and privacy. Avoid full-collection client streams for confidential records. New register API scans bounded Firestore pages with RBAC, per-user rate limits and no mutation paths.
3. Make Support urgency and aging visible without automatically changing status or promising SLAs based on old messages alone.
4. Never consider a directory record (even publicly visible) proof of enabled merchant checkout.

**P1**
1. Add persisted/role-aware saved filtered views (Shopify-style), accurate global counts and server-indexed sorting/search for unlimited-scale registries.
2. Link organization → brand → branch → claim → launch review → commerce activity and Assist equivalents in a single timeline.
3. Build unified, actionable Work inbox including Driver safety incident queue, merchant verification and overdue Support.
4. Create a proper support analytics dashboard with first-response and time-to-resolution metrics, conversation source, cases needing customer reply vs needing staff reply.
5. Add bulk actions only for safe operations, with confirmation, RBAC and per-record audit trail.

**P2**
1. Standardize list/table patterns across Finance, People, Mobility, Growth and System: keyword search, date range, sort, filter chips, saved views, CSV with permission guardrails.
2. Implement structured operational runbooks, owner assignment, escalation and release/readiness evidence.
3. Replace old CRUD-centric menu sprawl with task-oriented navigation and inline previews, retaining traceable audit routes.

## Benchmarks

Shopify's admin resource lists use saved views, multi-dimensional search and filters. Intercom's inbox uses assignment, urgency, custom views and routing. Spotly should match those principles **without copying their interfaces** and without weakening business/financial/safety decisions.

## Known implementation constraints

- New register uses bounded scans (at most 320 source documents per HTTP request). This is **not** an unbounded full-text index; pagination allows continued searches, and page counts are explicitly partial.
- Sorting by creation/update date excludes Firestore legacy documents that lack that sort field. The Record ID sort remains available to locate those.
- Exact creator/owner lookup queries are limited to 100 records per relationship; the API advertises when that bound is hit.
- Existing Admin subscribers and Support subscriptions are still capped. This milestone does not claim complete global analytics.
- An authenticated test session must verify the account query, cross-origin routing, actual permissions, Firestore index viability and error surfaces before production promotion.

# Spotly Production Integrity, Location, Notifications and Account Gateway Audit

**Audit date:** 18 August 2026  
**Source audited:** supplied Spotly Web Platform 5.5.3 repository  
**Public surface checked:** current public Spotly homepage, Driver recruitment, Privacy and Terms routes  
**Primary production issue:** locations submitted and visible to Admin review could remain invisible inside Spotly Business

## 1. Executive finding

The location failure was not primarily an Add Location form problem and is no longer best explained as a missing composite Firestore index.

The current production data model can contain a one-sided Business ↔ Location relationship:

- the location document exists;
- a review document or Admin task contains the correct `businessId` and `branchId`, so Admin can review it;
- but `businesses/{businessId}.branchIds`, the Business primary-location pointers, and/or `branches/{branchId}.businessId` are missing or stale;
- Business then reads an empty location set even though Admin has evidence of the saved location.

That exactly matches the reported symptom: the location is saved, becomes pending review, reaches Admin, but the Business Locations module still looks empty.

This release makes the server resolve locations from both sides of the relationship and from trusted review/claim breadcrumbs, then safely repairs one-sided historical linkage when the signed-in actor has business-wide authority.

## 2. Canonical Business location resolution

Added/expanded `lib/business-branches-server.js` as the canonical location resolver.

For a Business it now combines:

- direct `branches.businessId == businessId` matches;
- `business.branchIds`;
- `primaryBranchId`;
- `primaryLocationId`;
- `defaultBranchId`;
- `businessLocationReviews.branchId`;
- `businessLaunchReviews.branchId` / `branchIdsSnapshot` / `branchIds`;
- `businessClaims.branchId` / `branchIds`.

This matters because a review record is strong server-created evidence that a specific location belongs to the Business even when an older write lost one side of the relationship.

The resolver refuses to take over a branch already linked to a conflicting Business. Safe historical repairs update the branch linkage, Business `branchIds`, `branchCount`, and canonical primary location.

## 3. Location reads no longer depend on the old compound query

`GET /api/business/branches` now uses the trusted canonical resolver and returns `Cache-Control: private, no-store`.

The normal Business location list does not use `businessId + orderBy(name)`, so it does not require the old `businessId + name` composite index simply to display locations.

Locations are sorted after trusted server retrieval.

Firestore indexes are still required elsewhere in Spotly. In particular, notifications use the repository's `userId + createdAt` index and other operational queries have their own index definitions. Firebase indexes must therefore still be deployed as part of production infrastructure.

## 4. Location writes and review integrity

`POST /api/business/branches` now keeps Business and Branch linkage together in the same transaction when a location is created.

For a new location added to an already-live Business:

1. the location is saved immediately as a private/draft location;
2. the exact location is linked to the Business;
3. a `businessLocationReviews` record is created;
4. an Admin review task is created;
5. the owner receives in-app/push/email operational activity;
6. authorized reviewers receive review notifications;
7. the Business client forces an authoritative location refresh.

For initial setup before launch, the location is saved as `pending_launch_review` and becomes part of the launch-review evidence rather than disappearing while awaiting publication.

## 5. Admin approval repairs historical drift before deciding

`/api/admin/location-reviews/decision` now invokes canonical Business-location reconciliation before applying an Admin decision.

This is important for already-created production records. If Admin can see an old review whose branch lost its Business link, the review decision path can repair the safe relationship first instead of failing or approving a location the Business still cannot discover.

After the decision, canonical resolution runs again so Business, lifecycle and Admin converge on the same location set.

## 6. Business lifecycle and Portfolio now use the same location truth

Both `lib/business-lifecycle-server.js` and `lib/business-portfolio-server.js` now use the canonical Business-location resolver.

This removes the previous class of contradiction where:

- Portfolio could say Live;
- launch setup could report 100%;
- but Locations could say Add the first location.

The lifecycle, Portfolio card and selected Business now derive location readiness from the same server-side branch set.

## 7. Client-side location reliability

Spotly Business now loads locations from the authenticated server route instead of a direct client collection query.

The location subscription is request-versioned so a slow response that started before a save cannot overwrite the newer post-save response.

Location creation emits a branch-change event and the setup/location flows explicitly refresh authoritative locations after writes.

The UI now distinguishes:

- loading locations;
- locations failed to load;
- genuinely zero locations.

A read error can no longer masquerade as an empty Business and encourage duplicate location creation.

Legacy `provisional` and draft status records are normalized safely.

## 8. Production location audit/repair utility

`scripts/audit-business-locations.mjs` now audits the full Business ↔ Branch relationship and review breadcrumbs.

Run:

```bash
npm run audit:locations
```

This is dry-run only.

It reports:

- Business linkage drift;
- stale/missing branch IDs;
- review-linked locations;
- launch-review-linked locations;
- claim-linked locations;
- safe branch repairs;
- unsafe cross-Business mismatches;
- missing branch documents;
- orphan branches;
- likely duplicate locations.

After reviewing the output, safe links can be repaired with:

```bash
npm run audit:locations -- --apply-links
```

The repair mode does not delete duplicate/location documents automatically.

## 9. Review notification architecture

Added a canonical server notification dispatcher in `lib/notification-server.js`.

Operational review events can now create:

- authoritative in-app notifications;
- Firebase Cloud Messaging push notifications when a device token exists;
- transactional email through Resend when email is configured.

Review-related email can be marked operational so an important review decision is not silently suppressed by ordinary marketing-style preferences.

Notification records carry routing/context fields such as:

- workspace;
- module;
- event type;
- category;
- importance;
- Business ID;
- entity type and ID.

## 10. Review workflows now notify both sides

The canonical notification system is wired into the principal review paths, including:

- Business access/claim submission and decision;
- Business launch review submission and decision;
- Business location review submission and decision;
- Business settlement account review;
- Driver application review;
- Driver payout account review;
- Driver/Admin operational review actions;
- relevant Admin queue decisions.

Requesters receive updates and authorized reviewer audiences receive new-work notifications.

Reviewer audience resolution checks both account role arrays and Staff `rolePackId` records so Staff reviewers are not missed simply because their role lives in People Operations rather than on the user profile.

## 11. Global notification tray

Added `components/notification-center.js` with:

- global notification bell/tray;
- unread indicator;
- All / Unread / Reviews filters;
- mark-one-read;
- mark-all-read;
- workspace/module scoping;
- deep links into the relevant record.

`PortalShell` now presents the global tray across Business, Admin, Driver and Staff workspaces.

The signed-in customer marketplace and Account gateway also expose the global notification bell.

High-priority/review activity can surface as an in-workspace banner with a direct Open action.

## 12. Segmented notification centers

Notifications are also available inside the relevant workspace rather than only in one global drawer.

Implemented/connected notification sections for:

- Customer / Account;
- Spotly Business;
- Spotly Driver;
- Spotly Staff;
- Spotly Admin.

Business notifications can be scoped to the selected Business, while the global tray can span the user's available workspaces.

## 13. Customer-first Account gateway

The main account dashboard has been made an intentional workspace gateway.

Customer is always first and remains the universal workspace.

Additional workspace tiles appear only from real access signals:

- **Business** — active membership, organization/business ownership/access, or explicit Business grant;
- **Driver** — actual Driver profile/application/access or Driver role/grant;
- **Staff** — actual Staff profile/access or Staff role/grant;
- **Admin** — an actual Admin role, mapped platform permission, or explicit Admin grant;
- **Super Admin** — all workspaces.

The Firebase provider now subscribes to the signed-in user's canonical Staff profile, Driver profile and Driver application so workspace visibility is based on actual access records rather than display-name heuristics.

During this audit an additional access bug was found and fixed: adding `notifications` to Admin's base section set had made the old `hasAdminAccess()` size check capable of treating ordinary customers as Admin-capable. Admin access now requires an explicit mapped Admin role or permission, and regression coverage prevents plain customers from receiving the Admin workspace.

## 14. Registered company presentation

The platform already has legal configuration fields for:

- legal business name;
- trading name;
- registered address;
- company registration number;
- tax/TIN;
- privacy and terms contacts.

The Account gateway now shows a registered-company card only when real `legalName` and `companyNumber` values are configured in Platform settings.

No company number or legal name was invented or inferred from unrelated uploaded material.

Admin launch readiness now treats company registration number as part of legal configuration readiness.

## 15. Public-site consistency audit

The currently deployed public homepage advertises both pickup and delivery, and the Driver recruitment page advertises live Driver approval, online availability and delivery offers. However, the deployed homepage still contains the older sentence saying Spotly is preparing an invitation-only pickup pilot.

The source now normalizes that exact legacy status string to controlled pickup-and-delivery rollout wording, and the platform default was updated as well. This prevents an older stored launch setting from contradicting delivery availability on the same page.

The Privacy notice was also behind the operational product: it did not explicitly describe precise operational Driver location or in-app/push/email operational notifications. The source notice now does so and is dated 18 August 2026.

The Terms source now explicitly covers delivery availability and Driver operational requirements without making unsupported employment or earnings promises.

## 16. Security and data integrity

The existing server-authoritative pattern is preserved:

- Branch structure writes are server-only in Firestore rules.
- Notification creation is server-only; users can only update their own read/readAt state.
- Driver/Delivery operational state remains server-authoritative.
- Precise Driver operational resources remain protected behind scoped APIs.
- Location reconciliation only auto-repairs safe one-sided relationships and refuses conflicting Business ownership.
- No production secrets are included in the distribution ZIP.

## 17. Environment contract

`.env.example` now documents placeholders for the full current production surface, including:

- Firebase web/Admin;
- FCM/VAPID/App Check;
- Resend email;
- Paynow;
- OpenAI image configuration;
- finance encryption;
- monitoring/verification;
- optional lead webhook.

For review emails to actually leave production, `RESEND_API_KEY` and a verified `RESEND_FROM_EMAIL` sender must be configured in the deployment environment.

## 18. Deployment requirements

After deploying the source:

1. preserve the real Vercel/Firebase environment variables; do not replace them with `.env.example`;
2. deploy Firestore and Storage rules:

```bash
npm run firebase:deploy:rules
```

3. deploy Firestore indexes:

```bash
npm run firebase:deploy:indexes
```

4. open the affected Business Locations module once as a Business-wide owner/manager; the trusted GET route now performs safe canonical self-repair;
5. run the production location audit dry-run:

```bash
npm run audit:locations
```

6. review its results and, if correct, repair safe historical links:

```bash
npm run audit:locations -- --apply-links
```

7. configure Resend if review email is not already configured;
8. in Admin → Platform → Legal, enter the company's actual registered details; the UI will then surface the real company identity automatically.

## 19. Validation

Final source validation on the supplied repository:

```text
npm run check:js     PASS
npm run check:theme  PASS — 147 source files / 24 route patterns
npm test             PASS — 124/124
server syntax checks PASS
git diff --check     PASS (run before packaging)
```

A full Next production build/lint was not claimed in this container because the supplied repository did not include `node_modules`, and dependency installation could not be completed within the available network execution window. The source checks and test suite above ran without requiring the missing application dependency tree.

## 20. Production conclusion

The reported location symptom is now handled as a data-integrity problem, not just as a rendering problem.

The key production invariant is now:

```text
If Admin has a trusted review/claim relationship proving that a location belongs to a Business,
Spotly Business can rediscover that location and safely repair a one-sided historical link.
```

At the product level, review activity is no longer trapped inside Admin queues: it can reach requesters and reviewers by in-app activity, global tray, workspace notification centers, push, and configured operational email.

The main Account screen is now a customer-first gateway into only the workspaces the person actually has permission to use, while Super Admins receive the complete Spotly workspace set.

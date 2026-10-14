# Spotly Staff V8 + Careers — Product & Implementation Audit

**Audit date:** 14 October 2026  
**Source of truth:** the uploaded full Next.js project archive from this conversation.  
**Release discipline:** no GitHub push and no production deployment were performed.

## Product standard used

The audit treated Staff and Careers as one continuous people system:

**Open role → application → screening → interview → reference check → offer → hired → onboarding → Staff profile → daily Staff work.**

The objective was not to reduce Staff's capabilities. It was to make the existing capability set understandable, role-aware, mobile-usable, and operational for employees, managers and People Operations without exposing internal database or permission concepts.

## Main findings before implementation

1. **Staff Today had the right data but not enough action hierarchy.** It needed to answer “what do I need to do today?” by role, with urgent work, shift, learning, SLA risk and first-day readiness surfaced before secondary information.
2. **My Work behaved too much like a task list.** Owner, due/SLA, queue, next action and personal-vs-team scope were not explicit enough.
3. **Manager mode was too close to broad HR access.** Several subscriptions and Firestore authorities were wider than the manager experience required.
4. **Team did not explain lifecycle/reporting state strongly enough.** Reporting line, employment state, schedule coverage and lifecycle exceptions needed to be visible without opening raw records.
5. **Hiring had an authoritative candidate pipeline but candidate communications were disconnected.** Stage/interview actions needed an auditable message path on the same application record.
6. **Hire → onboarding still required avoidable re-selection.** Role-pack and department intent from the opening needed to flow into the secure invitation.
7. **Onboarding was a short data form rather than a guided employee setup.** Emergency contact, work arrangement, policy acknowledgement, equipment, required learning and first-day expectations needed a coherent sequence.
8. **Schedule/attendance needed stronger ownership rules.** A manager may see team coverage, but only the assigned employee should clock their shift and employees must not be able to manufacture their own shifts.
9. **Learning, Performance, Pay and Equipment needed clearer personal-vs-management boundaries.** Team data should not appear as the manager's own record.
10. **Careers had the core routes and application backend, but needed stronger public-product polish.** Employer proposition, role clarity, structured SEO, no-role/filtered-empty states, private status tracking language and mobile/application guidance needed another pass.
11. **Sensitive employee authority was partly client-owned.** Role, permissions, manager, lifecycle and offboarding changes needed a trusted server mutation path and audit record.
12. **The staff directory was over-broad for ordinary managers.** UI filtering was not enough; the actual Firestore query/rule needed to limit ordinary managers to recorded direct reports.

## Implemented solution

### 1. Staff Today
- Role-shaped operating priorities for support, verification, business success, driver operations, finance, People Operations and platform administration.
- Personal work ordered by urgency with due/SLA and next-action framing.
- Current shift, required learning and lifecycle state surfaced as immediate context.
- Preboarding/probation first-day checklist derived from real profile, manager, training, equipment and schedule data.
- Manager view adds direct-team coverage, approvals and exceptions without turning the page into an HR database.
- Cross-product tools are permission/role gated rather than universally exposed.

### 2. My Work
- A genuinely personal queue, including for managers.
- Priority, owner, queue, due/SLA, next action, detail context and checklist are explicit.
- Search and state filters make the queue usable on both desktop and phone.
- Managers no longer inherit unrelated team tasks into their own personal queue.

### 3. Team and manager mode
- Human employee cards/table with role, department, reporting line, employment type, lifecycle state and today’s working/scheduled state.
- Ordinary manager directory queries are now scoped to `managerId == current user` at both query and Firestore-rule level.
- People Operations retains the company-wide directory required for employee lifecycle administration.
- Manager workforce mutation authority is direct-report scoped for schedule, leave and performance operations.
- Equipment issuance/record mutation is People Operations authority rather than generic manager authority.
- Workforce-request approvals are People Operations controlled; managers can still originate their own staffing request.

### 4. Hiring
- Preserved the single authoritative Careers application record.
- Added auditable recruiter-to-candidate email communication using the existing transactional-email secret provider.
- Communication history lives with the candidate workflow instead of a second hiring database.
- Interview, notes, CV access, pipeline stage and timeline remain in one candidate workspace.
- “Hired” candidates hand directly to secure Staff onboarding.
- Role-pack and department from the role opening prefill the Staff invitation so People Operations does not recreate hiring intent manually.

### 5. Careers
- Preserved Careers as a first-class Spotly product/domain with clean public routes.
- Improved employer proposition and hiring-process transparency without generic corporate filler.
- Department filters/search and deliberate filtered-empty/no-open-role states.
- Role pages expose responsibilities, requirements, nice-to-have criteria, location, arrangement and employment type.
- Added JobPosting structured data and route metadata/canonical treatment.
- Application/status routes remain private/noindex where appropriate.
- Application tracking clearly explains that the private URL must be kept private and does not require a Spotly account.
- Public applications remain server validated; CVs and application records remain unavailable through direct browser Firestore/Storage access.

### 6. Onboarding and first day
- Rebuilt onboarding into four guided stages: details, work setup, policies and first day.
- Collects preferred name, contact/emergency information and work arrangement.
- Shows assigned role, department, manager, employment context and start date.
- Requires policy acknowledgement before submission.
- Surfaces expected equipment and required learning.
- Captures first-day notes/context.
- Final profile creation remains server-authoritative and People Operations approved.

### 7. Schedule and attendance
- Mobile-first shift cards and explicit “how attendance works” guidance.
- Team coverage for managers; personal schedule for employees.
- Clock-in/out actions are available only on the current employee’s assigned shift.
- Employees can no longer create their own shifts through Firestore rules.
- Manager schedule mutations are restricted to recorded direct reports; People Operations retains full authority.
- Late/missed/exception states remain visible instead of being silently overwritten.

### 8. Time off
- Balance/request/approval/history framing retained and clarified.
- Added coverage-plan context to leave requests.
- Manager approvals are scoped to their reporting team; People Operations can administer globally.

### 9. Learning
- Personal learning stays personal even when a manager has team-read capability.
- Required, overdue and certification-oriented metrics are distinct.
- Team learning attention is a manager oversight signal, not mixed into the manager’s own course list.

### 10. Performance
- Personal and direct-report scopes are separated.
- Manager performance mutation authority is restricted to employees they actually manage; People Operations retains global authority.
- Due/review state remains useful operational context rather than broad corporate-process clutter.

### 11. Pay
- Employee Pay renders only that employee’s payroll/payslip information.
- Manager status no longer causes broad payroll subscription.
- Finance/People permissions remain separate; payroll preparation does not implicitly grant the Admin Money workspace.

### 12. Equipment
- Employee view focuses on issued items, condition and issue reporting.
- People Operations controls assignment/record mutation.
- Managers do not automatically become equipment administrators.

### 13. Employee support
- Contextual People Operations, technical, confidential and workplace-incident support categories.
- Manager status no longer causes broad support-case subscription.
- Employee support requests remain self-scoped except for authorized People Operations access.

### 14. Profile and employee lifecycle
- Employee self-service is deliberately narrow: name/contact/emergency/work-arrangement fields only.
- Role, permissions, manager, status and offboarding authority moved behind `/api/staff/people`.
- The server derives permissions from the approved Spotly role pack; arbitrary browser-provided permission arrays are not trusted.
- Lifecycle covers preboarding, probation, active, leave, suspended, offboarding and former/alumni states.
- People Operations record includes probation end, last working date, access end, equipment-return due, handover owner and offboarding reason.
- Authority changes create an audit record.

### 15. People Operations
- Recruitment, hire handoff, onboarding, employee record, leave, learning, equipment, payroll-preparation context and offboarding now share one employee/candidate lifecycle rather than requiring duplicate identity entry.
- High-authority employee record changes are server-owned.
- Browser creation/deletion of staff profiles is denied and browser updates are limited to the employee self-service field allowlist.

### 16. States and permissions
Explicit handling now covers:
- brand-new/preboarding employee
- probation
- active
- leave
- suspended access
- offboarding
- former/alumni
- empty/no-task/no-shift states
- overdue learning
- unavailable payroll information
- permission-restricted Hiring/cross-product tools
- loading and source-load errors

### 17. Visual/mobile system
- Staff keeps black as the product identity/accent without turning the whole workspace into a heavy black UI.
- Existing Spotly V8 semantic surfaces/components are retained.
- High-density Team/Schedule content gains mobile cards while desktop keeps table/coverage efficiency.
- Empty states and state badges are used for explanation and next action rather than blank panels.

### 18. Cross-product integration
- Cross-product entry points are permission/role gated.
- Recruitment navigation depends on recruitment permission, not generic manager status.
- Finance workspace access is not inferred from People Operations payroll-preparation capability.
- Existing dedicated-domain routing for Customer, Business, Admin, Driver, Staff and Careers is preserved.

## Security/authority changes

- Career applications and CVs remain server controlled and denied to direct browser Firestore/Storage access.
- Staff role/status/manager/permission changes are handled through an authenticated People Operations API.
- Ordinary manager directory reads are restricted to recorded direct reports.
- Manager schedule, leave and performance mutation authority is restricted to direct reports.
- Employees cannot create arbitrary shifts for themselves.
- Equipment mutation is People Operations only.
- Candidate emails are sent server-side and recorded in the hiring timeline/log.
- No production secret values were added. `.env.example` only restores required variable names and default model identifiers used by the repository contract tests.

## Validation performed in this environment

The following checks passed against the final source tree:

- `npm run check:js` — passed.
- `npm run check:theme` — passed for **249 source files / 47 classified route patterns**.
- `npm run audit:launch` — passed for **105 API routes**.
- `npm test` — full project test suite passed: **309 / 309 tests**.
- Staff V8 / Careers regression tests include lifecycle, manager scope, SLA/next-action UI, clocking authority, onboarding, candidate communications, Careers SEO/states, recruitment navigation permission, server-owned People authority and manager workforce mutation scope.
- TypeScript parser used as an independent syntax parser over all JavaScript/JSX source files — passed.
- `git diff --check` — passed.

### Production lint/build environment constraint

A clean dependency restore was attempted repeatedly with `npm ci`. The execution environment could not resolve `registry.npmjs.org` and returned `EAI_AGAIN` while fetching packages. Because the archive intentionally did not contain a usable `node_modules`, `eslint` and `next` could not be executed after that network failure (`eslint: not found`, `next: not found`).

Therefore this audit does **not** claim that a fresh ESLint run or a fresh Next.js production build was executed successfully in this sandbox after the rebuild. The source-level project checks and tests above are real executed results. A clean `npm ci && npm run lint && npm run build` should be the first release-gate command in an environment with npm registry access.

The stale `.next` directory from the uploaded archive is excluded from the final source package so it cannot be mistaken for a build of these changes. The failed/partial `node_modules` directory is also excluded.

## Release package policy

The returned ZIP is a complete source project, not a patch. It preserves the existing Customer, Marketplace, Admin and Business V8 work plus the uploaded Staff/Careers work and the changes documented here. `.git`, stale `.next`, and failed/partial `node_modules` are intentionally excluded from the distributable archive.

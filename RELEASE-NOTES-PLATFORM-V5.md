# Spotly Platform v5 release notes

Generated: August 6, 2026  
Version: `5.0.0`

## Release objective

Version 5 turns Spotly from a set of related dashboards into one operating network with five role-specific entrances. It preserves the existing customer, business, driver, and administrator systems while adding the full Spotly internal workforce application and the governance required to operate it.

## New `/staff` application

The staff application is a complete role-adaptive workspace rather than a generic analytics dashboard.

### Today

- Personalized shift and status
- Role-specific queue for support, business verification, finance, operations, content, driver operations, management, and People Operations
- Assigned tasks and due dates
- Training and approval reminders
- Quick actions to start a shift, open work, or request help

### Workforce operations

- Work assignments and status changes
- Team directory and manager view
- Recruitment pipeline and workforce requests
- Shift schedule and attendance records
- Leave balances, requests, approvals, and coverage context
- Learning paths, acknowledgements, quizzes, and sign-off
- Probation, goals, check-ins, feedback, and review records
- Payroll preparation, earnings components, deductions, reimbursements, and payslips
- Asset issue and return history
- Internal support and confidential concern channels
- Employment, role, access, and document profile

### Role packs

Reusable role packs define default permissions, scope, approval limits, training, schedule expectations, equipment, documents, probation checklist, and performance expectations. Included starter packs cover support, verification, business success, finance, operations, driver operations, regional operations, content, People Operations, and platform administration.

## Expanded `/admin`

### People Operations

Administrators and authorized managers can manage:

- Workforce requests
- Candidates and recruitment stages
- Employee records
- Role packs and access
- Scheduling and attendance
- Leave approvals
- Training compliance
- Performance cycles
- Payroll preparation
- Assets and offboarding

### Organization governance

A dedicated organization workspace presents the legal organization, customer-facing brand, and operating location as separate entities. It supports branch access requests, parent approvals, location governance, and inherited policy visibility.

### Platform map

The platform map explains the customer/business transaction chain and workforce chain visually. Administrators can inspect record relationships and open plain-language diagnostic answers for access, publication, approval, payment, and availability decisions.

## Shared data and security

Version 5 adds Firestore service functions, starter data, security rules, and Storage rules for:

- staffProfiles
- staffTasks
- staffShifts
- staffLeaveRequests
- staffTraining
- staffPerformance
- staffPayroll
- staffAssets
- workforceRequests
- candidates
- internalSupportRequests

Staff access uses employment status, role, permissions, scope, manager relationships, and People Operations authority. Payroll and sensitive employment data remain restricted to authorized roles.

## Portal integration

- Login and portal switching now include `/staff`
- Portal descriptions reflect five role-specific entrances
- Administrator navigation includes Organizations, People, and Platform Map
- Starter production data includes workforce role packs
- Shared role labels and access resolution include People Operations, driver operations, and regional operations

## Deployment requirements

1. Back up Firestore and Storage.
2. Install dependencies with Node.js 22 and npm 11.
3. Run `npm run check`.
4. Test Firestore and Storage rules in the Emulator Suite.
5. Seed or approve role packs.
6. Assign the first People Operations administrator.
7. Test each staff role with least-privilege accounts.
8. Test payroll, confidential support, documents, and temporary access separately.
9. Deploy to Vercel Preview before Production.
10. Monitor audit events and permission denials during pilot use.

## Known environment limitation

The generation environment could not complete `npm install` because its restricted package gateway returned a 404 for a transitive package. Source parsing, import resolution, JSON checks, and JavaScript-only validation were completed. A clean install, ESLint run, production build, and Firebase Emulator test remain required in the owner’s normal development or Vercel environment.

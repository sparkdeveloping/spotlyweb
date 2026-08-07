# Spotly Route Inventory

| Route | Audience | Authentication | Status | Purpose and primary actions | Known limitation |
|---|---|---|---|---|---|
| `/` | Public | No | Pilot-ready | Launch story, waitlist, business finder, approved featured businesses | Requires final launch content and approved imagery |
| `/login` | All | No | Pilot-ready | Sign in, sign up, reset and portal-aware redirect | Final provider and browser testing required |
| `/marketplace` | Customers | Optional/account for orders | Pilot-ready | Location discovery, business search, catalogue, basket, checkout, orders, saved | Payment launch and cancellation reservation release pending |
| `/claim` | Business claimants | Optional, sign-in before submission | Pilot-ready | Ten-stage claim, parent context, access scope, evidence and submission | Parent-review operations need pilot validation |
| `/claim/drafts` | Claimants | Yes | Pilot-ready | Resume/delete account claim drafts | Retention policy requires final configuration |
| `/claim/status/[claimId]` | Claimants | Yes | Pilot-ready | Claim status, timeline, evidence, requests and support | Review communication depends on admin workflow |
| `/business` | Merchant users | Yes | Pilot-ready | Today, operating status, urgent work and current location | Production data and role validation required |
| `/business/[section]` | Merchant users | Yes | Mixed pilot-ready | Orders, catalogue, customers, locations, team, money, insights, setup, settings and support | Non-retail archetype depth varies by section |
| `/business/kiosk/live` | Authorized merchant device | Yes | Prototype | Focused shared-device kiosk mode | Device lockdown and production kiosk testing required |
| `/driver` | Internal testers | Yes | Training-only | Fictional delivery training scenarios and reset | No live dispatch or earnings |
| `/driver/[section]` | Internal testers | Yes | Training-only | Training jobs, active stage, history, learning/profile context | No operational backend |
| `/staff` | Spotly staff | Yes | Pilot-ready | Today, shift, agenda, scoped work and help | Real employment data required |
| `/staff/[section]` | Spotly staff/managers | Yes | Mixed pilot-ready | Tasks, team, hiring, schedule, leave, learning, performance, pay, assets, support, profile | Rich linked-record detail varies by work type |
| `/admin` | Platform admins | Yes | Pilot-ready | Urgent work, exact queue links, platform health and decisions | Production telemetry required |
| `/admin/queues/[queue]` | Platform admins/reviewers | Yes | Pilot-ready | Filters, saved views, assignment, batch action, CSV and decisions | Server pagination and communication depth remain |
| `/admin/[section]` | Platform admins | Yes | Mixed pilot-ready | Organizations, people, businesses, drivers, customers, operations, money, support, content, compliance, platform | Some sections remain record-management foundations |
| `/admin/platform-map` | Platform admins | Yes | Prototype | Entity/workflow diagnostics and explanation links | Full record tracing depends on live data |
| `/admin/support-view/[businessId]` | Authorized support/admin | Yes | Pilot-ready | Audited business support context | Must be tested against production scope policies |
| `/support` | Public/authenticated | No | Pilot-ready | Help resources, context-aware message support, attachments and lifecycle | Staffing, SLA and malware scanning required |
| `/account` | Authenticated users | Yes | Pilot-ready | Profile, contact, preferences, workspaces, security and build info | Session/device management remains limited |
| `/payment/return` | Customers | Depends on order | Pending integration | Provider return and payment status continuation | Production provider tests required |
| `/privacy` | Public | No | Draft page | Privacy information | Final approved legal text required |
| `/terms` | Public | No | Draft page | Platform terms | Final approved legal text required |
| `/devstatus` | Internal legacy link | Redirect | Operational redirect | Redirects to `/admin/platform` | No public status page |
| `/api/health` | Monitoring | No/safe output | Pilot-ready | Safe application health/build signal | External monitoring must be configured |
| `/api/orders/create` | Customer checkout | Auth/anonymous policy as implemented | Pilot-ready | Idempotent transactional order, stock and slot reservation | Reservation release pending |
| `/api/payments/paynow/*` | Payment provider/customer | Protected provider flow | Pending integration | Initiate, poll and receive Paynow results | Production credentials and reconciliation required |

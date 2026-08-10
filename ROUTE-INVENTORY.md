# Spotly Route Inventory

| Route | Audience | Authentication | Purpose | Main actions | Status / limitation |
|---|---|---|---|---|---|
| `/` | Public visitors | No | Consumer launch page and business discovery entry | Join launch list, choose city, learn pickup flow, find or add a business | Complete public redesign; featured merchants remain illustrative until approved live data exists |
| `/login` | All users | No | Sign in, create an account, reset password | Email/password authentication, portal-aware return | Google and Apple primary sign-in remain dependent on configured providers |
| `/marketplace` | Customers | Public browsing; sign-in for personal actions | Location-first marketplace preview | Search, browse, save, build basket, checkout, view orders | Real inventory, merchant slots and payment completion depend on connected production data/providers |
| `/claim` | Business owners and managers | Browsing public; sign-in before submission | Find, add or claim a business | Save draft, identify authority, select scope/location, upload evidence, submit | Draft persistence and review UX completed; review processing remains connected to current backend services |
| `/business` | Merchant operators | Business access | Today view | Review operating state, urgent work, order stages and closing tasks | Operational UX rebuilt |
| `/business/[section]` | Merchant operators | Business access | Orders, offerings, locations, insights, promotions, staff, money, support and settings | Section-specific work | Capability navigation remains driven by existing business model configuration |
| `/business/kiosk/live` | Authorized merchant device | Business access | Focused shared-device pickup/check-in experience | Verify a customer code and update the current transaction | Uses existing kiosk service behavior |
| `/drive` | Prospective Drivers | Public | Driver acquisition | Understand requirements and start a Driver application | Public recruitment entry point |
| `/driver` | Drivers | Sign-in; approved Driver required for online operations | Live Driver home | Complete application/review, go online with location, receive offers, continue active delivery | Server-authoritative Driver state; no seeded training jobs |
| `/driver/[section]` | Drivers | Sign-in with Driver-specific operational checks | Jobs, active delivery, earnings, activity, support and account | Accept/decline offers, progress verified delivery states, report incidents, request payouts | Delivery/jobs/earnings persist on server; foreground web location updates while online |
| `/staff` | Spotly workforce | Staff profile required | Today agenda | Start/end shift, review agenda, open assigned queue, request help | Role-adaptive Today experience completed |
| `/staff/[section]` | Spotly workforce and managers | Staff profile required | Work, schedule, leave, learning, performance, pay, profile, team and hiring | Complete tasks, requests, learning and People Operations work | Learning viewer and progress implemented with existing workforce services |
| `/admin` | Authorized administrators | Admin access | Queue-first control centre | Resolve urgent issues, open queues, review health and decisions | Rebuilt around operational urgency |
| `/admin/[section]` | Authorized administrators | Section-specific admin access | Operations, organizations, businesses, people, drivers, customers, money, content, platform map, configuration, audit and settings | Review and operate platform records | Navigation grouped by operating domain |
| `/admin/support-view/[businessId]` | Authorized support/admin users | Admin access | Business-context support view | Inspect business context and support work | Uses existing support-view service |
| `/support` | Visitors, customers, businesses, drivers and staff | No; signed-in context used when available | Help centre and persistent support conversation | Search guides, open contextual conversation, retry failed messages | Only configured contact channels are shown |
| `/account` | Signed-in users | Yes | User profile and preferences | Edit profile/contact, language, notifications, workspaces, privacy and security links | Technical deployment details removed |
| `/payment/return` | Paying customer | Provider return context | Resolve payment return status | Check status, continue order journey | Depends on configured Paynow integration |
| `/privacy` | Public | No | Plain-language pilot privacy notice | Read data-use and user-choice information | Must receive jurisdiction-specific legal review before final public launch |
| `/terms` | Public | No | Plain-language pilot terms | Read customer/business operating expectations | Must receive jurisdiction-specific legal review before final public launch |
| `/devstatus` | Internal legacy link | Redirects | Prevent public access to the retired development report | Redirect to `/admin/platform` | Public development report removed |

# Spotly Platform Blueprint

The central correction is this:

**Spotly should not feel like five separate dashboards. It should feel like one operating network with five role-specific entrances.**

```text
/          Customer marketplace
/business  Merchant and branch operations
/driver    Delivery and field operations
/staff     Spotly workforce
/admin     Platform governance
```

Every route should use the same identity, organization, permissions, notifications, support, audit, payment, and workflow systems. What changes is what each person needs to accomplish today.

The current screenshots reveal several structural problems that should be corrected before adding more surface-level features:

* A branch is being presented as though it is an independent business.
* Users see operational modules before completing setup.
* Navigation reflects database categories rather than user goals.
* Staff records display account identifiers instead of recognizable names.
* Duplicate locations appear.
* “Activity” opens an order-management screen, creating a terminology mismatch.
* Insight cards appear before meaningful activity exists.
* Empty states explain absence but do not always advance the user.
* Brand context and location context are combined into one selector.
* Financial, staff, branch, and operational controls appear before the user understands their relationship to the organization.

The next version should correct the operating model first, then redesign every screen around it.

---

# 1. Product design doctrine

Spotly should follow six non-negotiable rules.

## One meaningful decision at a time

Long workflows should be split into logical pages, with the user’s current position and remaining work made clear. Progressive disclosure should keep advanced or uncommon controls out of the primary path. Research on complex forms consistently emphasizes structure, transparency, clarity, and support as ways to reduce cognitive load. ([Government Project Delivery][1])

A new business owner should initially see:

```text
Welcome
Find or create your business
Confirm your relationship
Complete required information
Submit for review
Prepare for launch
```

They should not initially see:

```text
Insights
Finance
Promotions
Staff permissions
Payout policies
Branch governance
Integrations
```

Those become visible only when they are relevant.

## Every screen answers three questions

At a glance, every user should understand:

1. **Where am I?**
2. **What needs my attention?**
3. **What should I do next?**

## Navigation follows work, not architecture

The system may internally have organizations, brands, locations, capabilities, memberships, policies, and transactions. The user should see plain-language tasks:

* Finish setting up
* Open today
* Prepare orders
* Help a customer
* Add products
* Invite someone
* Review a request
* Get paid

## No unexplained empty screens

Every empty state should do one of four things:

* Confirm that everything is okay.
* Explain what will eventually appear.
* Offer the next useful action.
* Explain that the user lacks access.

## No dead interactions

Every visible button must:

* Complete an action.
* Open a working flow.
* Explain why it is unavailable.
* Be hidden until it becomes available.

There should be no “coming soon” buttons inside operational workspaces.

## Important moments receive complete interfaces

Actions such as submitting a business claim, approving a branch, publishing a catalogue, hiring a staff member, starting a shift, receiving a payment, or completing an order should have:

* Full-screen processing state.
* Clear progress.
* Animated confirmation.
* Plain-language result.
* Next recommended action.
* Recovery path when something fails.

Animations should confirm state changes rather than decorate ordinary navigation.

---

# 2. The correct Spotly organization model

The platform needs a strict distinction between the company, brand, and operating location.

```text
Organization
└── Brand
    ├── Location
    ├── Location
    └── Location
```

Example:

```text
OK Zimbabwe Limited
└── OK Zimbabwe
    ├── Hillside
    ├── Avondale
    └── Borrowdale
```

Another organization could own multiple brands:

```text
Parent Organization
├── Brand A
│   ├── Harare location
│   └── Bulawayo location
└── Brand B
    └── Mutare location
```

## Organization

The legal or controlling entity.

It controls:

* Ownership.
* Company documents.
* Executive access.
* Consolidated reporting.
* Brand creation.
* Organization-wide policies.
* Central finance visibility.
* Delegated authority.

## Brand

The customer-facing business identity.

It controls:

* Public name.
* Branding.
* Categories.
* Master catalogue.
* Customer policies.
* Brand-level promotions.
* Shared content.
* Default operating rules.

## Location

The physical or operational unit.

It controls:

* Address.
* Phone and WhatsApp.
* Opening hours.
* Local staff.
* Local availability.
* Inventory.
* Pickup capacity.
* Local pricing where allowed.
* Local fulfilment.
* Location-specific orders or bookings.

The UI must never identify “OK Zimbabwe — Bulawayo Hillside” as the parent business. It should display:

```text
Business
OK Zimbabwe

Location
Hillside, Bulawayo
```

---

# 3. Parent-company and branch governance

A branch must not be claimed as though it exists independently from its parent structure.

## Branch claim workflow

```text
User finds a location
→ Spotly identifies its parent brand
→ User requests location access
→ Parent organization reviews request
→ Spotly reviews identity and risk
→ Both approvals are recorded
→ User receives setup responsibilities
→ Location remains governed by parent policies
```

When the parent organization has not yet claimed its business:

```text
Branch claimant submits request
→ Spotly verifies the branch relationship
→ Spotly invites or identifies parent representatives
→ Temporary branch setup may proceed
→ Sensitive or brand-wide changes remain locked
→ Parent ownership is reconciled when verified
```

## Approval outcomes

A request can be:

* Approved by parent and Spotly.
* Approved by parent, pending Spotly.
* Approved by Spotly, pending parent.
* More information required.
* Temporarily delegated.
* Rejected.
* Escalated for ownership conflict.

## Field-level governance

Every parent organization should configure each operational area as one of:

```text
Centrally controlled
Branch may suggest changes
Branch changes auto-approved
Branch fully controls
```

This applies separately to:

* Business identity.
* Location details.
* Catalogue.
* Prices.
* Inventory.
* Promotions.
* Opening hours.
* Pickup settings.
* Customer policies.
* Staff invitations.
* Refund authority.
* Financial visibility.
* Support responses.
* Public content.

A branch manager editing a centrally controlled item creates a **change request**, not an immediate change.

The interface should clearly show:

```text
Inherited from OK Zimbabwe
```

or:

```text
Your change is waiting for head office approval
```

rather than silently failing or exposing unnecessary permission terminology.

## Financial visibility

The parent organization configures:

* Consolidated financial access.
* Location-level isolation.
* Whether branch managers see revenue.
* Whether they see fees or only settlement totals.
* Whether locations can request payouts.
* Whether refunds require parent approval.
* Whether finance staff have read-only or transactional access.

These policies must be explicit, auditable, and adjustable.

---

# 4. `/staff`: Spotly People Operations

`/staff` should be for **Spotly’s own employees, contractors, interns, field teams, support agents, operations staff, finance staff, administrators, and managers**.

Merchant employees remain within `/business/team`. Drivers remain within `/driver`.

All three workforce systems can share the same underlying people infrastructure, but they must not be presented as the same employment relationship.

```text
/staff            Spotly internal workforce
/business/team    Business employees and operators
/driver           Drivers and fleet personnel
```

## The `/staff` home experience

A staff member should not land on a generic analytics dashboard.

They should land on **Today**:

```text
Good morning, Tariro

Today
• 3 business claims need review
• Training starts at 10:00
• One task is due today

Your shift
08:00–17:00

Quick actions
Start shift
View work
Ask for help
```

A support agent sees support work.

A verification officer sees claims.

A recruiter sees candidates.

A finance officer sees payment exceptions.

A manager sees team approvals.

The portal should adapt automatically based on role and assignments.

## Staff lifecycle

The system should cover the complete relationship:

```text
Workforce request
→ Job approval
→ Vacancy
→ Candidate
→ Screening
→ Interview
→ Offer
→ Preboarding
→ First day
→ Probation
→ Active employment
→ Development
→ Role change
→ Leave or absence
→ Exit
→ Alumni record
```

## Hiring

### Workforce request

A manager requests a person by specifying:

* Why the role is needed.
* Team.
* Reporting manager.
* Employment type.
* Location or remote arrangement.
* Proposed budget.
* Start date.
* Required skills.
* Access expected.
* Equipment required.

The system routes approval to the correct manager, finance reviewer, and People Operations user.

### Candidate experience

Candidates receive a simple application journey:

* Personal details.
* Contact information.
* Preferred language.
* Work history.
* Qualifications.
* Availability.
* Location.
* References.
* Documents.
* Consent.
* Review and submit.

Do not ask for payroll, system access, or internal permissions during the application.

### Recruitment workspace

Recruiters receive:

* Applicant pipeline.
* Duplicate candidate detection.
* Screening questions.
* Interview scheduling.
* Interview scorecards.
* Reference checks.
* Document review.
* Offer preparation.
* Candidate communication.
* Reason-coded rejection.
* Talent pool.
* Recruitment analytics.

### Offer and preboarding

Once approved:

* Offer is generated.
* Candidate accepts.
* Employment information is collected.
* Required documents are requested.
* Manager and start date are confirmed.
* System account is prepared.
* Role pack is assigned.
* Equipment tasks are generated.
* Orientation is scheduled.
* Training is assigned.

## Employee record

The staff profile should be organized into plain sections:

```text
Overview
Employment
Role and access
Schedule
Pay and statutory details
Documents
Training
Performance
Assets
Leave
History
```

Sensitive sections appear only to authorized users.

## Role pack

Hiring should not require administrators to configure dozens of disconnected fields.

A **role pack** should define most of the employee setup at once:

```text
Role title
Department
Manager type
Default permissions
Required training
Approval limits
Typical schedule
Required equipment
Document requirements
Performance expectations
Probation checklist
```

Examples:

* Support Agent
* Senior Support Agent
* Business Verification Officer
* Business Success Manager
* Driver Operations Coordinator
* Finance Reviewer
* People Operations Administrator
* Platform Administrator
* Content Editor
* Regional Operations Manager

The administrator chooses a role pack, adjusts exceptions, and sends the invitation.

## Time and attendance

The staff system should support:

* Scheduled shifts.
* Flexible schedules.
* Clock in and out.
* Manual timesheets.
* Manager corrections.
* Late and missed-shift alerts.
* Overtime requests.
* Break tracking where required.
* Location or device-based clocking policies.
* Shared-device staff kiosk.
* Offline clock event queue.
* Attendance exception review.

## Leave

Employees should be able to:

* View available leave.
* Request leave.
* Attach supporting documents where needed.
* See approval status.
* Withdraw a pending request.
* View team availability where permitted.

Managers should see:

* Conflicting requests.
* Coverage impact.
* Approve or decline.
* Delegate approval.
* Request more information.

Leave types, accruals, public holidays, and approval chains should be admin-controlled and effective-dated.

## Payroll preparation

The system should support:

* Salary or hourly pay.
* USD and ZiG pay records.
* Allowances.
* Bonuses.
* Deductions.
* Reimbursements.
* Overtime.
* Statutory contribution fields.
* Payroll approval.
* Payslip generation.
* Export to an accountant or payroll provider.
* Payment reconciliation.

ZIMRA states that employers must register for PAYE within 14 days of becoming an employer and must calculate and deduct PAYE. NSSA states that employers must register within 30 days and that contributions become due when an employee begins receiving remuneration. These obligations should appear as compliance setup tasks, not as hidden assumptions. ([Zimbabwe Revenue Authority][2])

Tax tables, statutory rates, and payroll rules must be versioned by effective date instead of hardcoded. Zimbabwe also has sector-specific collective bargaining agreements that continue to be published and updated, so the system needs configurable NEC classification and rule packs rather than one universal employment configuration. ([Zimbabwe Revenue Authority][3])

## Training and knowledge

Each role should receive a learning path:

```text
Welcome to Spotly
Security and privacy
How Spotly works
Role-specific orientation
Required operating procedures
Customer care
Incident handling
Assessment
Manager confirmation
```

Training can contain:

* Unlisted YouTube videos.
* Short articles.
* Checklists.
* Quizzes.
* Acknowledgements.
* Practical manager sign-off.
* Renewal dates.

## Performance

The system should support:

* Probation goals.
* Role expectations.
* Regular check-ins.
* Feedback.
* Recognition.
* Coaching plans.
* Performance reviews.
* Improvement plans.
* Promotion recommendations.
* Skills profile.
* Career goals.

It should avoid ranking employees publicly or turning every action into a score.

## Employee support

Every staff member should have access to:

* People Operations chat.
* Manager contact.
* Technical support.
* Anonymous or confidential concern channel.
* Workplace incident reporting.
* Policy library.
* Emergency contact information.
* Request history.

## Assets

Track:

* Laptop.
* Phone.
* SIM card.
* Uniform.
* ID badge.
* Vehicle access.
* Scanner.
* Payment device.
* Other equipment.

Each asset has issue date, condition, owner, return status, and incident history.

## Offboarding

An employee exit automatically creates a checklist:

* Record final day.
* Revoke access.
* Transfer ownership.
* Reassign open work.
* Recover equipment.
* Process final pay.
* Archive documents.
* Conduct exit interview.
* Preserve required audit records.

---

# 5. Spotly internal access model

Access should be resolved through:

```text
Person
→ Employment or membership
→ Role pack
→ Permission set
→ Scope
→ Approval limits
→ Temporary exceptions
```

## Scope levels

* Platform.
* Country.
* Province.
* City.
* Department.
* Organization.
* Brand.
* Location.
* Assigned case only.

A verification officer may review businesses but not payments.

A support agent may view customer context but not identity documents.

A finance administrator may review settlements but not change business ownership.

A regional manager may oversee businesses in selected provinces.

## Temporary access

Support or investigation access should require:

* Reason.
* Duration.
* Approval where necessary.
* Visible support-view banner.
* Audit trail.
* Automatic expiry.

---

# 6. Adaptive `/business` experience

There should not be one universal merchant dashboard.

A business receives a capability profile during setup.

## Supported operating models

### Grocery and retail

Relevant modules:

* Products.
* Variants.
* Inventory.
* Prices.
* Locations.
* Pickup.
* Substitutions.
* Promotions.
* Orders.
* Customers.
* Finance.

### Restaurant and prepared food

Relevant modules:

* Menu.
* Modifiers.
* Preparation time.
* Availability.
* Kitchen workflow.
* Pickup slots.
* Orders.
* Promotions.
* Customers.

### Services and appointments

Relevant modules:

* Services.
* Duration.
* Staff availability.
* Appointments.
* Resources.
* Customer notes.
* Check-in.
* Deposits.
* Cancellations.

No inventory screen unless the business enables retail products.

### Events and ticketing

Relevant modules:

* Events.
* Venues.
* Dates and sessions.
* Ticket types.
* Capacity.
* Sales.
* Attendee list.
* Check-in.
* Refund policies.
* Promoters and staff.

No branch inventory or driver menu unless relevant.

### Accommodation and activities

Relevant modules:

* Properties or experiences.
* Units or capacity.
* Availability.
* Bookings.
* Guests.
* Check-in.
* Policies.
* Add-ons.
* Payments.

### Public listing only

Relevant modules:

* Profile.
* Locations.
* Hours.
* Contact methods.
* Photos.
* Customer enquiries.
* Reviews or feedback when enabled.

## Business onboarding stages

```text
1. Find or create the business
2. Confirm your relationship
3. Confirm the parent organization
4. Choose or create the location
5. Tell us how the business operates
6. Confirm public details
7. Add initial offerings
8. Choose fulfilment or booking rules
9. Invite the right people
10. Review and submit
```

Only the current stage should dominate the screen.

The sidebar before completion should contain:

```text
Continue setup
Preview
Help
Account
```

After verification:

```text
Home
Today’s work
Offerings
Customers
Team
Money
Insights
Settings
```

Additional modules appear only when enabled.

## Business home

The home screen should prioritize actionable work:

```text
Needs your attention
• Confirm Friday opening hours
• 2 products are unavailable
• Parent approval is waiting
• Add a pickup contact

Today
• 7 pickup orders
• 3 ready
• 2 need substitutions

Next best step
Complete your first catalogue
```

Do not lead with six empty metric cards.

---

# 7. Product and offering enrichment

Spotly should maintain a verified catalogue library rather than forcing every business to type everything manually.

## Enrichment pipeline

```text
Approved source
→ Import record
→ Duplicate matching
→ Brand matching
→ Product normalization
→ Category mapping
→ Rights and source status
→ Merchant confirmation
→ Location activation
```

Sources can include:

* Manufacturer catalogues.
* Official merchant websites.
* Merchant-provided spreadsheets.
* Merchant APIs.
* Barcode scans.
* Administrator research.
* Existing approved Spotly records.

Imported records must retain:

* Source.
* Retrieval date.
* Confidence.
* Rights status.
* Last verification date.
* Business confirmation status.

Prices and stock must never be inferred from an old public page.

Images should remain provisional until Spotly or the business has confirmed usage rights.

## Starter experience

When an OK Zimbabwe location activates:

```text
We found 1,240 likely catalogue items.
Review categories first.
Activate only what this location sells.
Add prices and availability later.
```

The user should be able to:

* Accept a category.
* Remove irrelevant items.
* Bulk activate.
* Apply location prices.
* Mark products unavailable.
* Add missing products.
* Copy settings from another authorized location.

For events, the equivalent starter library is not products; it is event templates, venues, ticket policies, and ticket structures.

---

# 8. `/driver`: full field-operations product

The driver portal should only appear when delivery capability is enabled.

It should support:

* Spotly-employed drivers.
* Independent drivers.
* Business-employed drivers.
* Fleet partners.
* Fleet dispatchers.

## Driver onboarding

```text
Create account
→ Confirm identity
→ Choose driver relationship
→ Add licence
→ Add vehicle or join fleet
→ Submit required documents
→ Complete safety training
→ Review
→ Approval
→ First-shift orientation
```

Documents and expiry reminders should be configurable by vehicle and work type.

## Driver home

The driver sees only what matters now:

```text
You are offline

Today
2 scheduled shifts

Before you start
Vehicle check required

Primary action
Start shift
```

During a shift:

```text
Current task
Next task
Earnings today
Report a problem
End shift
```

## Delivery workflow

```text
Offer received
→ Accept
→ Navigate to pickup
→ Arrive
→ Verify pickup code
→ Confirm items
→ Navigate
→ Contact customer safely
→ Confirm handoff
→ Capture proof
→ Complete
```

The interface should switch into a simplified **driving-safe mode** once navigation begins. Large controls, minimal text, voice-friendly actions, and no dense dashboard should be displayed while driving. Poor driving interfaces increase cognitive burden and distraction, so operational information must be deferred until the vehicle is stopped. ([Nielsen Norman Group][4])

## Driver capabilities

* Availability.
* Shift scheduling.
* Job offers.
* Batch deliveries.
* Route sequence.
* Pickup verification.
* Customer contact masking.
* Proof of delivery.
* Failed delivery reasons.
* Cash handling.
* Expenses.
* Earnings.
* Payouts.
* Safety check.
* Vehicle incidents.
* Emergency support.
* Performance feedback.
* Document expiry.
* Training.
* Appeals.

## Fleet workspace

Fleet managers receive:

* Drivers.
* Vehicles.
* Dispatch board.
* Availability.
* Document compliance.
* Maintenance.
* Incidents.
* Earnings.
* Settlements.
* Performance.
* Assignment rules.

Businesses that do not offer delivery never see driver controls.

---

# 9. Customer `/` experience

The customer site should remain visually calm, especially during coming-soon mode.

## Coming-soon home

The page should use:

* Strong hero image or illustrated marketplace scene.
* Short value statement.
* Location selector.
* Visual business categories.
* Business claim/listing action.
* Customer waitlist.
* Featured verified businesses.
* Simple launch-status visual.
* Support access.

Avoid long paragraphs about platform infrastructure.

## Marketplace

The customer journey should be:

```text
Where are you?
→ What do you need?
→ Choose business
→ Choose exact location
→ Browse relevant offering
→ Complete the appropriate transaction
```

Transactions depend on the business:

* Product purchase.
* Grocery pickup.
* Restaurant pickup.
* Appointment.
* Ticket.
* Accommodation booking.
* Activity reservation.
* Enquiry.

The customer should never see delivery options for a pickup-only location or booking controls for a retail listing.

---

# 10. `/admin`: platform control centre

The admin portal should not merely be another list of menus. It should be the operating system for Spotly.

## Admin home

```text
Platform attention

Urgent
• 2 payment exceptions
• 1 security alert

Needs review
• 14 business claims
• 3 parent-company conflicts
• 8 staff applications
• 6 driver documents

Launch health
• 72 verified businesses
• 41 ready for customers
• 18 locations incomplete
```

## Core sections

### Control centre

* Platform readiness.
* Current incidents.
* Queues.
* Approvals.
* Configuration gaps.
* Service health.
* Launch controls.

### Organizations

* Parent organizations.
* Brands.
* Locations.
* Ownership.
* Governance policies.
* Conflicts.
* Merges.
* Publication status.

### People

* Spotly staff.
* Recruitment.
* Onboarding.
* Roles.
* Scheduling.
* Leave.
* Payroll preparation.
* Performance.
* Training.
* Assets.
* Offboarding.

### Businesses

* Claims.
* Verification.
* Location requests.
* Parent approvals.
* Catalogue readiness.
* Business health.
* Publication review.
* Support view.

### Drivers

* Applicants.
* Verification.
* Fleets.
* Vehicles.
* Availability.
* Incidents.
* Payouts.
* Performance.

### Customers

* Accounts.
* Access.
* Orders and bookings.
* Support.
* Risk.
* Consent.
* Deletion and data requests.

### Operations

* Orders.
* Bookings.
* Tickets.
* Pickup.
* Delivery.
* Exceptions.
* Refund requests.

### Money

* Payments.
* Fees.
* Commissions.
* Settlements.
* Payouts.
* Refunds.
* Reconciliation.
* Currency configuration.

Zimbabwe’s payment environment requires continued support for both ZiG and USD workflows, and current RBZ reporting continues to track substantial activity in both local-currency and USD payment streams. Currency, settlement, and payment-method configuration therefore needs to remain versioned and adjustable rather than assumed globally. ([Reserve Bank of Zimbabwe][5])

### Support

* Realtime conversations.
* Assignments.
* Escalations.
* Internal notes.
* Saved responses.
* Service levels.
* Satisfaction.
* Linked records.

### Content

* Website.
* Coming-soon content.
* Categories.
* Help centre.
* Training.
* Notifications.
* Email templates.
* Translations.
* Announcements.

### Compliance

* Legal settings.
* Employer setup.
* Data protection.
* Document retention.
* Consent.
* Audit.
* Security.
* Incident management.
* Policy acknowledgements.

Zimbabwe’s Cyber and Data Protection Act establishes a national data-protection framework, so staff, driver, business, customer, identity, and payment records should have documented purpose, access limits, retention periods, export capability, and deletion workflows. ([Potraz][6])

---

# 11. `/admin/platform-map`

This should be a major administrative feature.

It visually explains how Spotly works.

## Entity map

```text
Account
  ↓
Membership
  ↓
Organization
  ↓
Brand
  ↓
Location
  ↓
Offering
  ↓
Order / Booking / Ticket
  ↓
Payment
  ↓
Pickup / Delivery / Check-in
  ↓
Settlement
  ↓
Support and audit history
```

The workforce map shows:

```text
Candidate
  ↓
Employment
  ↓
Role
  ↓
Permissions
  ↓
Schedule
  ↓
Task
  ↓
Performance
  ↓
Payroll
```

## Interactive behavior

Administrators can:

* Click any node.
* See real record counts.
* Filter by business type.
* Filter by location.
* See failed or incomplete relationships.
* Open a relevant queue.
* Trace a customer transaction.
* Trace why a person has access.
* Trace why a branch change requires approval.
* View which platform setting controls a behavior.

## “Explain this” mode

Every important record should have:

```text
Explain this record
```

Examples:

* Why can this user access this location?
* Why is this business not public?
* Why is this payment held?
* Why did this branch change require approval?
* Why is this driver unavailable?
* Why did this order not reach the business?

The answer should be presented in plain language with links to the relevant records and settings.

---

# 12. Shared platform event system

All applications should react to the same events.

Examples:

```text
BUSINESS_CLAIM_SUBMITTED
PARENT_APPROVAL_REQUIRED
BUSINESS_VERIFIED
LOCATION_CREATED
STAFF_INVITED
STAFF_ACCESS_CHANGED
DRIVER_APPROVED
ORDER_PLACED
ORDER_READY
PAYMENT_CONFIRMED
SUPPORT_CONVERSATION_OPENED
```

An event can trigger:

* Firestore update.
* Notification.
* Email.
* In-app task.
* Approval request.
* Audit record.
* Insight metric.
* Admin alert.

This is how the applications remain synchronized instead of each screen inventing its own behavior.

---

# 13. Navigation strategy

## Before setup is complete

```text
Continue setup
Help
Account
```

## After setup, before approval

```text
Setup status
Preview
Requests
Help
Account
```

## After launch

Navigation becomes capability-based.

A grocery branch might see:

```text
Home
Orders
Catalogue
Inventory
Customers
Team
Money
Insights
Settings
```

An events business might see:

```text
Home
Events
Tickets
Attendees
Check-in
Customers
Team
Money
Insights
Settings
```

A service provider might see:

```text
Home
Appointments
Services
Calendar
Customers
Team
Money
Insights
Settings
```

A Spotly support employee might see:

```text
Today
Conversations
Assigned work
Knowledge
Schedule
Profile
```

---

# 14. Interaction and visual details

## Important action hierarchy

Each page should generally have:

* One primary action.
* At most two secondary actions.
* Additional actions behind a clearly labelled menu.

## Icons

Use icons with text for important actions.

Avoid unexplained icon-only controls, especially for older or less digitally experienced users.

## Confirmation

Small reversible actions:

```text
Saved
```

Destructive or financial actions:

```text
Review
Confirm
Processing
Completed
```

## Autosave

Forms should save automatically and show:

```text
Saved just now
```

When offline:

```text
Saved on this device. We will sync when you reconnect.
```

## Long-running work

Directory import, bulk catalogue generation, report export, or migration should not trap the user on a spinner.

Use:

```text
Preparing your catalogue
You may leave this page.
We will notify you when it is ready.
```

## Multilingual design

English, ChiShona, and isiNdebele should share translation keys, but public and operational translations should be reviewed by fluent speakers rather than relying solely on machine translation.

Language choice should be remembered per account and device.

## Accessibility

* Large tap targets.
* Strong contrast.
* Keyboard navigation.
* Visible focus.
* Screen-reader labels.
* Text plus icons.
* Reduced-motion support.
* Clear errors beside fields.
* No color-only status meanings.

---

# 15. Zimbabwe-specific operational setup

The admin launch centre should guide Spotly through:

```text
Company identity
Employer registration
PAYE configuration
NSSA registration
NEC classification
Staff contracts
Data protection
Payment providers
Support information
Legal policies
Driver compliance
Insurance
Settlement policies
Incident response
```

These should be admin-configured with effective dates, supporting documents, responsible owners, and renewal reminders.

The platform should not silently claim legal compliance. It should show:

```text
Configured
Needs review
Awaiting document
Expires soon
Not applicable
```

---

# 16. Recommended implementation sequence

## Foundation

* Correct organization, brand, and location model.
* Remove duplicate branch-as-business records.
* Shared identity and permission engine.
* Shared event and audit system.
* Capability-based navigation.

## Staff

* `/staff`.
* Recruitment.
* Hiring.
* Onboarding.
* Role packs.
* Scheduling.
* Leave.
* Training.
* Employee support.
* Manager approvals.

## Business governance

* Parent approval.
* Branch requests.
* Field-level governance.
* Financial visibility.
* Change approvals.
* Business-model-specific setup.

## Business operations

* Tailored retail, food, service, events, and accommodation workspaces.
* Catalogue enrichment.
* Kiosks.
* Operational workflows.
* Insights based on real activity.

## Driver

* Driver and fleet onboarding.
* Dispatch.
* Delivery.
* Earnings.
* Safety.
* Support.

## Admin

* Complete operations control.
* People Operations.
* Platform map.
* Explain-this diagnostics.
* Configuration centre.
* Compliance centre.

## Customer

* Visual coming-soon experience.
* Business and location discovery.
* Capability-specific marketplace.
* Orders, bookings, tickets, pickup, and delivery.

## Production validation

* Permission testing.
* Security Rules.
* App Check.
* Payment reconciliation.
* Data protection.
* Legal review.
* Accessibility testing.
* Low-bandwidth testing.
* Pilot with actual staff, businesses, drivers, and customers.

---

# Final product vision

Spotly should behave less like a collection of dashboards and more like a guided operating partner.

A new business owner should feel:

> Spotly already understands my type of business and is helping me get ready.

A branch manager should feel:

> I know what I control, what head office controls, and what needs approval.

A staff member should feel:

> I know what I need to do today.

A driver should feel:

> The app gives me only what I need for the current job.

A customer should feel:

> I can find and complete the right transaction without learning how Spotly is structured.

An administrator should feel:

> I can see how the entire platform works, why something happened, and where intervention is required.

That is the standard the next full build should follow.

[1]: https://projectdelivery.gov.uk/get-involved/connect-and-contribute/publishing-content-on-the-government-project-delivery-website/design-system/components/progress-indicator/?utm_source=chatgpt.com "Progress indicator"
[2]: https://www.zimra.co.zw/domestic-taxes/corporate/new-businesses?utm_source=chatgpt.com "Requirements For New Businesses"
[3]: https://www.zimra.co.zw/domestic-taxes/tax-tables?utm_source=chatgpt.com "Tax Tables"
[4]: https://www.nngroup.com/articles/distracted-driving-ux/?utm_source=chatgpt.com "Distracted Driving: UX's Responsibility to Do No Harm"
[5]: https://www.rbz.co.zw/documents/nps/quarterly/2026/NPSD_FIRST_QUARTER_REPORT_ACTIVITY_MARCH_2026.pdf?utm_source=chatgpt.com "financial markets division national payment systems ..."
[6]: https://www.potraz.gov.zw/wp-content/uploads/2022/02/Data-Protection-Act-5-of-2021.pdf?utm_source=chatgpt.com "65384-T Cyber & Data Protection Act.indd"

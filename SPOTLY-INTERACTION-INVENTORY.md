# Spotly Interaction Inventory

## Repaired or completed

### Public

- Replaced decorative category hover behavior with truthful static/filter behavior.
- Business finder now supports arrow keys, Enter, Escape, outside click, active-descendant, result count, loading, failure and no-result states.
- Waitlist success can be edited, reset and reopened cleanly.
- Featured businesses open real marketplace destinations only when approved data exists.

### Shared UI

- Static list rows render as non-interactive content.
- Tabs use unique IDs and keyboard navigation.
- Added controlled TabPanel relationships.
- Modal, drawer, sheet, full-screen task, notifications, command palette, mobile More and support use a shared focus-managed overlay.
- Removed native `window.prompt()` and `window.confirm()` usage.
- Card shadows are optional.
- Removed `font-black` usage.

### Navigation

- Workspace visibility uses access records rather than role-name pattern matching.
- Workspace settings use explicit valid routes.
- Mobile More contains command navigation.
- Notification links open exact destinations.

### Customer

- Search, Orders and Saved retain URL state.
- Order deep links open the exact order.
- Location selection changes discovery.
- Basket and checkout state are scoped by user/session.
- Location switching confirms basket consequences.
- Mobile basket opens in an accessible sheet.
- Checkout uses location-derived slots rather than generated times.
- Missing prices block basket/checkout and never appear as Free.
- Unsupported currencies/payment methods are hidden or explained.
- Query failures no longer masquerade as empty data.
- Duplicate checkout submission uses an idempotency record.

### Claims

- Four overloaded steps replaced with ten progressive stages.
- Parent/head-office relationship and access scope added.
- Anonymous draft transfers after sign-in.
- Signed-in drafts persist across devices.
- Evidence uploads persist and expose progress/retry/remove.
- Review sections have exact Edit actions.
- Submission opens a real status timeline rather than only redirecting to Business.

### Merchant

- Open/pause/resume/close is available from Today.
- Urgent items include age, promised time and primary action.
- Before-closing guidance is a stateful checklist.
- Orders have mobile cards and URL-preserved filters.
- Catalogue has Quick, Manage, Import and Publishing modes.
- Missing prices block publication.
- Customer preview and publication status are explicit.

### Driver

- Removed any implication that training jobs are live.
- State is scoped to the current session/user.
- Added reset and scenario controls.
- Added pickup-code and customer-PIN training steps.

### Staff

- Staff work no longer links ordinary employees into Admin.
- Tasks deep-link to exact task records.
- Added checklist, notes, completion and escalation actions.
- Agenda uses Harare timestamps.
- Learning supports content/checklist/quiz/progress/retry.
- Assets and routine records have mobile cards.

### Admin

- Dashboard cards open exact queue routes and filters.
- Queue filters persist in the URL.
- Added saved device views, assignment, batch assignment and CSV export.
- Added record-specific claim, support, payout and task decisions.
- Added reason validation and review dialogs.
- Removed false “ready after timeout” behavior.

### Account and support

- Profile and pickup-contact details can be edited.
- Preferences save to the account record.
- Password recovery is exposed.
- Support conversation state is scoped.
- Attachments provide type/size validation, progress and retry.
- Structured order/claim/job/task context is preserved.
- Close, reopen and satisfaction actions persist.

## Explicitly disabled, hidden or reclassified

- Driver dispatch, live earnings, live GPS and payout are training-only and not represented as operational.
- Unsupported payment methods are not offered.
- Pickup times are not invented when location configuration is incomplete.
- Customer publication is blocked for unresolved prices.
- Public development status is removed; `/devstatus` redirects to authenticated Admin configuration.
- Previous static customer/business/admin demo modules were removed.

## Known remaining interaction gaps

- Order cancellation/refund/expiry must release stock and slot reservations.
- Full customer substitution approval and price-difference workflow needs deeper integration.
- Specialized appointments/events/accommodation operations need further task-specific depth.
- Notification preference enforcement must be proven in provider delivery code.
- Support attachment malware scanning is external.
- Session/device management in Account remains limited.

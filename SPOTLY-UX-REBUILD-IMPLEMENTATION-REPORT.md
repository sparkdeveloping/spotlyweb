# Spotly Functionality, UI and UX Rebuild — Implementation Report

**Implementation date:** 6 August 2026
**Repository:** Spotly web platform v5
**Primary scope:** Public website, customer marketplace, business claiming and operations, driver workflow, staff workflow, admin operations, support, shared UI, mobile behavior, accessibility and brand assets.

## Executive summary

This rebuild changes Spotly from a repeated dashboard-card prototype into a more differentiated operating product:

- The public website now leads with a narrow customer outcome: find nearby, order ahead and collect when ready.
- The customer experience is location-first, URL-restorable, basket-aware and mobile-friendly.
- Business onboarding saves progress and asks for authority before access scope and locations.
- Merchant Today begins with operational status and work, not analytics.
- The driver portal is a persistent state-based workflow rather than a collection of static dashboard cards.
- Staff Today is an agenda and work queue, with working shift and learning actions.
- Admin begins with urgent work, queues and platform health, and its navigation is grouped by operating domain.
- Shared controls no longer create false affordances.
- Technical deployment language has been removed from normal user surfaces.
- Large raster role logos were replaced by a lightweight flat brand asset system.

The implementation is based on the supplied complete-rebuild brief and functionality/UI/UX audit.

## Major implementation areas

### 1. Public website

Rebuilt `components/coming-soon-app.js` around:

- Customer-first header and mobile menu.
- Location/city selection.
- Direct launch-list form.
- A clearly labelled illustrative search → order → ready product sequence.
- Visual customer categories.
- A real three-step pickup explanation.
- Controlled-pilot explanation.
- Business owner finder and add-business entry.
- Specific trust commitments.
- Launch FAQ.
- Simplified customer/business footer.

Removed public links to development, admin, staff and driver interfaces.

### 2. Shared visual and interaction system

Rebuilt `components/ui.js` and refined global styles:

- Smaller, more restrained radius hierarchy.
- Less default card/shadow weight.
- Accessible search labels.
- Proper button/link composition.
- Static, button and link variants for list rows.
- Keyboard-operable tabs.
- Focus-managed dialogs.
- Better empty, loading and progress semantics.
- Reduced-motion support retained.

### 3. Brand assets

Added:

- `public/brand/spotly.svg`
- `public/brand/spotly-business.svg`
- `public/brand/spotly-driver.svg`
- `public/brand/spotly-admin.svg`
- `public/brand/spotly-wordmark.svg`
- 192×192 and 512×512 PWA icons.
- Apple touch icon.

Removed four oversized legacy PNG marks, reducing the role-logo payload by roughly 7 MB.

### 4. Customer marketplace

Rebuilt `components/marketplace-app.js` with:

- URL-driven Discover, Search, Orders and Saved states.
- Direct order opening through `?order=`.
- Location-first header and category discovery.
- Merchant cards that do not impersonate businesses with the Spotly logo.
- Store-level search and category controls.
- Persistent basket and checkout draft.
- Confirmed location switching.
- Sticky mobile basket.
- Multi-stage checkout.
- Distinct no-results, unavailable and failure states.
- Customer-appropriate listing correction and notification actions.

### 5. Business claim and onboarding

Updated `components/claim-app.js` to provide:

- Accurate progress from the first step.
- Authority before scope/location selection.
- Persistent local draft across authentication.
- Save and exit.
- Saved-time feedback.
- Evidence type and size validation.
- Clear review edit actions.
- Plain-language submission and review states.

### 6. Merchant operations

Reworked business home and catalogue:

- Today begins with business/location context, operating status and immediate work.
- Urgent transaction, availability, team and approval issues are prioritized.
- Active order stages are visible before performance analytics.
- Before-closing actions are explicit.
- Catalogue quick add reflows on mobile.
- Products render as actionable mobile cards.
- Availability updates remain directly accessible.
- Desktop tables remain for higher-density operation.

### 7. Driver workflow

Rebuilt `components/driver-app.js` around a persisted state machine:

```text
Offline → Offer → Going to pickup → At pickup → Going to customer → Handoff → Completed
```

Implemented:

- Persistent job state through refresh and navigation.
- Explicit training-preview notice while seeded data remains.
- One primary action per delivery stage.
- Map deep links.
- Contextual issue/support links.
- Safe active-job layout.
- Completion and earnings update behavior.
- Working profile/support destinations instead of inert rows.

### 8. Staff and People Operations

Updated `components/staff-app.js` and `components/admin-people-operations.js`:

- Staff Today is an agenda, shift action, approvals and assigned work.
- Missing employment profiles direct users to People Operations rather than allowing self-creation.
- Learning opens a working content/acknowledgement workflow.
- Role cards show learning and equipment rather than permission codes.
- Compact shift controls work correctly.
- Staff and admin directories provide mobile record cards.
- User-facing role-template identifiers are removed from directory tables.

### 9. Admin operations

Rebuilt the admin dashboard to prioritize:

- Urgent issues.
- Operational queues.
- Platform health.
- Recent decisions.

Improved navigation:

- Operations.
- Marketplace.
- People.
- Money.
- Platform.

Added persistent compact desktop sidebar behavior and current-workspace command navigation.

### 10. Account, login and support

Account:

- Profile/contact details.
- Language and accessibility.
- Notification preferences.
- Sign-in methods.
- Accessible workspaces.
- Privacy/data and support paths.

Login:

- Removes the architecture-heavy five-portal explanation.
- Adds password requirement feedback.
- Includes terms/privacy acknowledgement.
- Preserves portal-aware redirects.

Support:

- Shows only configured contact channels.
- Uses plain language.
- Preserves conversations.
- Supports contextual `topic` and `subject` links.
- Provides task-based starter resources.
- Keeps failed-message retry behavior.

### 11. Metadata, indexing and legal placeholders

Updated:

- Metadata and public descriptions.
- Sitemap to public routes only.
- Robots exclusions for private workspaces.
- Manifest and PWA icons.
- Privacy and terms pages.
- Legacy `/devstatus` redirect to `/admin/platform`.

The privacy and terms pages are operational pilot drafts and still require qualified legal review before a public commercial launch.

## Interaction audit

A static JSX interaction scan was run after implementation.

**Potential visible buttons without an action/destination/disabled/submit behavior: 0.**

See `INTERACTION-INVENTORY.md` for repaired and removed interactions.

## Route inventory

See `ROUTE-INVENTORY.md` for route purpose, audience, authentication and current limitations.

## Accessibility changes

- Accessible search labels.
- Dialog role, modal state, title/description association, focus trap, Escape close and focus restoration.
- Tab roles, selection state and keyboard arrows/Home/End.
- Non-interactive content no longer rendered as a button.
- Better disabled-link handling.
- Progress semantics.
- Existing reduced-motion support retained.
- Mobile record cards reduce two-dimensional table navigation.
- Explicit labels added to destructive and icon-only controls.

A final manual WCAG 2.2 AA test with NVDA, VoiceOver, keyboard-only navigation, 320px reflow and 200%/400% zoom remains required in a browser environment.

## Mobile and low-bandwidth changes

- Explicit More navigation sheet.
- Persistent bottom customer basket.
- Mobile catalogue cards.
- Mobile staff/People Operations cards.
- Responsive quick-add form.
- Sticky/scroll-safe dialogs.
- Driver active-job phone-first composition.
- Local draft/state restoration for customer checkout, business claiming and driver work.
- Heavy role-logo PNG files removed.

## Data and migration

No destructive database migration is required for this UI/UX rebuild.

New local browser keys:

- `spotly-driver-workflow-v2`
- `spotly-business-claim-draft-v2`
- customer basket/checkout keys defined in `components/marketplace-app.js`
- `spotly-sidebar-collapsed`

Existing Firestore service functions and record structures were retained where practical.

## Environment variables

`.env.example` has been expanded to include all environment variables referenced by the repository:

- Public app URL.
- Firebase web and Admin configuration.
- App Check and web push.
- Bootstrap administrators.
- Paynow.
- Resend.
- Optional lead forwarding.

No real credentials are included.

## Validation performed

| Validation | Result |
|---|---|
| JavaScript-only repository check | Passed |
| JavaScript/JSX parser validation | Passed — 108 files |
| Local import resolution | Passed — 0 failures |
| Undefined/local name diagnostics | Passed — 0 diagnostics |
| Unused local/import diagnostics | Passed — 0 diagnostics |
| Potential inert-button scan | Passed — 0 findings |
| JSON parsing | Passed — 6 files |
| SVG XML parsing | Passed — 5 files |
| Git whitespace validation | Passed |

## Build and lint limitation

`npm ci --ignore-scripts` was attempted in the generation environment.

It could not complete because the environment’s internal npm gateway returned HTTP 404 for:

```text
zod-validation-error-4.0.2.tgz
```

The environment also supplied npm 10.9.2 while the repository requests npm 11 or newer.

Because dependencies could not be installed, the following were **not claimed as completed** here:

- ESLint.
- Next.js production build.
- Browser component/integration tests.
- Live responsive screenshots.

Run these in a normal networked environment with Node 22 and npm 11:

```bash
npm ci
npm run lint
npm run build
npm run dev
```

Then complete the manual/browser QA matrix described below.

## Browser QA still required

- Public waitlist submission against the deployed Firebase project.
- Login/signup/reset and verified-email behavior.
- Customer URL navigation and order deep links.
- Basket/location change and checkout recovery.
- Claim draft across real authentication redirect.
- Merchant order updates and catalogue saves.
- Driver refresh/reopen across real dispatch data.
- Staff learning and shift updates against production-like records.
- Admin assignment/review against real queues.
- Support retry and notification delivery.
- iPhone, low-end Android, 320px, slow 3G and intermittent network.
- Keyboard, NVDA, VoiceOver and zoom/reflow.

## Known integration limitations

- Driver offers, earnings and history remain explicitly labelled training data until a live dispatch backend connects.
- Maps use external deep links rather than an embedded live navigation SDK.
- Customer pickup slots still depend on the current merchant/backend configuration; a full capacity engine is outside this visual rebuild.
- Google/Apple primary authentication depends on configured identity-provider behavior.
- Real email, push, Paynow, support channels and merchant imagery depend on environment configuration and approved data.
- Privacy and terms require final legal review.

## Deployment

1. Copy `.env.example` to the deployment environment and supply real values through Vercel/Firebase secrets.
2. Use Node 22 and npm 11+.
3. Run `npm ci`, `npm run lint` and `npm run build`.
4. Deploy Firestore indexes/rules only through the project’s existing controlled process.
5. Deploy to a preview environment first.
6. Complete route and interaction smoke tests.
7. Verify public robots/sitemap behavior.
8. Promote to production only after pilot sign-off.

## Final result

The rebuilt repository now concentrates on the product’s core journeys instead of adding more surface area. Public, customer, merchant, driver, staff and admin experiences are visually and behaviorally more distinct while continuing to share one coherent Spotly identity and operating model.

# Spotly Full Platform UX, Marketplace & Operational Clarity Audit

**Audit date:** 18 August 2026  
**Repository:** Spotly Web Platform 5.5.3  
**Scope:** Customer Marketplace, Business, Kiosk, Delivery, Notifications, Driver, Staff, Admin, shared visual language, query resilience and cross-workspace usability.

## Executive result

This pass treats the screenshots as symptoms of broader platform patterns rather than isolated pages.

The most important changes are:

1. **Marketplace discovery is now server-backed and production-safe.** Customer Marketplace no longer depends on client Firestore compound ordering/search queries that can turn one missing index into a full discovery outage.
2. **The public business directory and live Marketplace are now separate concepts.** Claiming a business can still find provisional/public records while Marketplace exposes only businesses that are actually live for customers.
3. **Business notifications are account-level, not selected-business navigation.** A dedicated Business Notifications workspace provides business and module filters. The global bell remains account-wide. High-priority banners inside a selected business are now scoped to that exact business.
4. **Shared visual language is stronger.** Reusable cards have intentional content insets, tabs support semantic icons, buttons use restrained tactile motion, and all Framer Motion animations honor the user's reduced-motion preference.
5. **Business/Location context is clearer.** Full names are preserved, typography is consistent, and location-management actions live inside the Location context switcher instead of being repeated in page headers.
6. **Kiosk is explained as a staff workflow.** The screen describes what the tablet does, what the staff PIN actually protects, and how a one-time setup code activates the shared device.
7. **Silent-empty failure patterns were reduced.** Core Business, Marketplace, Money, Staff catalogue, notification and claim-request reads distinguish technical failure from a legitimate empty state.
8. **Admin now has an explicit Marketplace directory readiness check.** A customer discovery failure can be surfaced as an operational launch-readiness issue instead of only being discovered by a customer.

---

## 1. Visual language and spacing

### Problem observed

Several operational cards were visually edge-to-edge even when they contained forms or setup instructions. That made form boundaries feel accidental and made different modules look like they were built from different systems.

### Implemented

- Extended the shared `SectionCard` with a deliberate `padded` content mode.
- Standardized form/setup card interiors to `p-4 sm:p-5` while preserving intentional full-bleed tables and queue rows.
- Applied the inset system to Kiosk, Delivery, Driver Operations and other form-heavy operational surfaces.
- Tabs now accept semantic Lucide icons rather than relying on text alone.
- Shared buttons have restrained hover/press motion, limited to devices/users that allow motion.
- `MotionConfig reducedMotion="user"` now wraps the application so Framer Motion respects OS accessibility preferences.
- Empty-state iconography and content enter with short, non-looping motion rather than decorative continuous animation.

### Design decision on Lottie/GIF animation

This release intentionally does **not** add a heavy Lottie/GIF layer to operational pages. Spotly already has Framer Motion and Lucide, which provide small semantic animations without additional network payload, battery cost, or visual noise. Lottie is best reserved for future branded onboarding/marketing illustrations where animation adds comprehension; it should not become the default language for active delivery, finance, Kiosk, incidents or Admin operations.

---

## 2. Business and Location identity

### Problem observed

The top-right Business and Location context controls could truncate important names and use inconsistent hierarchy. A separate `Manage location` action also duplicated what the context control should already communicate.

### Implemented

- Business and Location names use the same hierarchy, weight and line-height.
- Full names wrap instead of collapsing to arbitrary ellipses.
- Business and Location context tiles remain actionable even when only one option exists.
- The Business context menu provides Portfolio/claim management.
- The Location context menu provides:
  - `Edit selected location`
  - `Add location`
  - location switching
- Removed the redundant Dashboard `Manage location` action.
- Locations support direct deep links such as edit/add actions from the context switcher.

The result is a clearer mental model:

> **Business = the brand/account being operated.**  
> **Location = the exact physical operating point currently in context.**

---

## 3. Business notifications information architecture

### Problem observed

Notifications appeared inside an individual selected business even when the records belonged to other businesses on the same account. That made account-wide information look business-specific.

### Implemented

Business now has two distinct layers:

#### Global notification tray

The top-right bell remains intentionally global. It can show account-wide activity and provides filters for:

- All
- This workspace
- Reviews

Notification rows now use semantic icons rather than only a status dot.

#### Business account notifications

`/business/notifications` is now a **Business account-level** destination alongside:

- Portfolio
- Notifications
- Claims & applications
- Invitations
- Your access

It is no longer inserted into the selected-business navigation.

The Business Notifications center supports:

- exact Business selection
- All / Unread
- Reviews
- Orders & delivery
- Locations
- Money
- Support

Legacy notifications without a reliable `businessId` remain account-level and are not allowed to leak into an exact-business view.

#### Selected-business attention banners

High-priority/review banners displayed while inside a selected Business are now filtered by that exact `businessId`. A review for Business B cannot appear as an attention banner while the user is actively operating Business A.

#### Reliability

Global and Marketplace notification trays no longer convert subscription failure into a fake `You're caught up` state. Technical refresh failures are visible as failures.

---

## 4. Customer Marketplace production repair

### Problem observed

The customer Marketplace could show `Businesses could not be loaded`. The previous customer discovery path depended too much on browser Firestore query/index behavior.

There was also an architectural constraint: the same broad business-search helper is used by the claim flow. Simply making that helper return only live Marketplace businesses would fix customer discovery while breaking legitimate business-claim discovery.

### Implemented architecture

#### `/api/public/marketplace`

New bounded, public, rate-limited server route for live customer discovery.

It:

- uses Firebase Admin;
- queries `public == true` only;
- does **not** use compound `orderBy` queries;
- filters live/paused Marketplace eligibility server-side;
- filters city/search terms in bounded memory;
- returns a safe public business shape;
- is not allowed to take the Marketplace offline merely because App Check is still rolling out to a browser.

#### `/api/public/marketplace/business`

New customer-safe detail route.

It:

- verifies that the business is currently live/public;
- resolves branches by `businessId` only;
- resolves products by `businessId` only;
- filters public/published/active state server-side;
- sorts in the server response rather than depending on a compound index;
- exposes only customer-safe branch/product fields.

#### Separate claim directory

New routes:

- `/api/public/directory`
- `/api/public/directory/business`

These intentionally include public provisional/unclaimed records needed by business claiming/correction flows. This preserves claim behavior while allowing Marketplace to enforce live-customer eligibility.

### Customer UX improvements

- Marketplace tabs now have semantic icons: Discover, Search, Orders, Saved.
- Discovery copy explicitly teaches the customer that availability belongs to the exact location.
- Business cards communicate ordering, locations and fulfilment more clearly.
- Fatal first-load errors remain explicit.
- A refresh failure after results have already loaded now preserves the last known results and shows a warning/retry banner instead of replacing usable data with a blank error screen.
- Business detail loading distinguishes location loading, catalogue loading and actual empty states.

### Operational visibility

Admin Launch Readiness now includes a `Customer marketplace directory` health check. It verifies that the production-safe `public == true` query resolves and reports whether live Marketplace businesses are currently discoverable.

---

## 5. Product/catalogue resilience retained and strengthened

The prior Product blank-screen repair remains in this release: shared `TabPanel` supports the `value + tabValue` contract used by catalogue modules, so a saved product can no longer be counted in `Publishing (1)` while every tab body renders blank.

Additional resilience in this pass keeps core catalogue reads from depending on unnecessary compound ordering indexes. Bounded data is scoped first and sorted in the application/server where appropriate.

Important Business reads that now avoid unnecessary compound ordering include:

- Business products
- Orders
- claims and drafts
- support conversations/messages
- promotions
- Business Money records
- selected catalogue library/staff catalogue queries

A read failure is represented as a failure, not as an empty catalogue/order list.

---

## 6. Kiosk comprehension and safety

### Previous problem

The Kiosk screen exposed implementation concepts before explaining the job to the Business owner. A credential/enrollment flow can be technically correct and still be confusing.

### Current flow

The page is now introduced as a **Check-in kiosk / shared tablet** with three steps:

1. **Choose the job** — Customer pickup check-in or Driver pickup.
2. **Protect staff controls** — Use a staff-only Spotly exit PIN.
3. **Activate the tablet** — Open the kiosk screen and enter the one-time setup code.

Each step has a semantic icon and short motion-on-entry.

The setup form uses plain language:

- `What should people do on this tablet?`
- `Tablet name (staff only)`
- `Protect kiosk mode with a staff PIN`
- `Create kiosk setup`
- `Copy code`
- `Open kiosk screen`
- `Activate kiosk`

The copy now explicitly distinguishes Spotly's exit PIN from full OS-level kiosk/guided-access locking.

The live kiosk continues to use its own scoped device credential and does not inherit a Business owner's Firebase session.

---

## 7. Delivery clarity

Delivery continues to use the canonical Location map pin rather than maintaining a second latitude/longitude truth.

The Business owner sees operational concepts rather than raw implementation fields:

- Pickup map pin
- Delivery radius
- Typical preparation time
- Driver pickup point
- Driver pickup instructions
- Pickup contact
- Supported vehicle types
- Pause new delivery orders

Delivery readiness is displayed as an understandable checklist. Delivery cannot be enabled until the required real Location information exists.

---

## 8. Suspended Business state

A suspended Business could previously produce a contradictory Portfolio experience such as:

> Suspended  
> Your launch setup is complete  
> Submit for Spotly review

The Portfolio server now treats suspension as its own authoritative operating state. The primary action becomes **View suspension status**, not another launch-review submission.

---

## 9. Admin usability and operations

### Navigation

Admin navigation is clearer:

- Drivers moved into the **Operations** group and are labeled `Drivers & delivery`.
- Content is grouped as **Growth** and labeled `Content & growth`.
- Removed stale `Coming-soon content` wording from Admin metadata.

### Data-source clarity

The existing Admin Control Centre already tracks each major subscription independently and distinguishes loaded/failed/connecting sources. This behavior was preserved.

### Marketplace health

Admin Launch Readiness now actively tests the customer Marketplace directory query and exposes one of:

- ready
- needs verification
- blocked

This provides a platform-operations signal before the problem becomes solely a customer screenshot.

### Driver/Admin operational cards

Driver Operations cards use the shared inset system so eligibility, location, application/documents and Driver Money read as contained operational tools rather than edge-to-edge fragments.

---

## 10. Driver, Staff and account-wide wording

A smaller cross-product wording audit removed several generic CTAs where the outcome can be named:

- signed-in login continuation → `Open Spotly`
- claim wizard → `Continue to <next stage>`
- Driver active job → `Resume delivery`
- Staff task → `View task`
- shared full-screen task default → `Done`

This follows the platform rule:

> A primary action should say what will happen when it is pressed.

---

## 11. Motion and iconography principles now applied

Spotly now has a more explicit operational visual grammar:

- **Business/Store** icons describe business identity.
- **MapPin** describes a physical operating context.
- **Package/Truck** distinguishes orders and fulfilment.
- **ClipboardCheck** communicates review/approval work.
- **Shield/Lock** communicates permissions and protected controls.
- **Money icons** are reserved for settlement/payout/payment context.
- **Activity/Bell** represent general system activity rather than being reused for every domain.

Motion is used for:

- page entry;
- tab selection;
- overlays;
- notification/empty-state acknowledgement;
- tactile button response;
- small setup-step reveals.

Motion is **not** used to decorate active operational screens continuously.

---

## 12. Firestore/index conclusion

Indexes still matter and should still be deployed for the queries that genuinely need them. However, a normal customer or Business workflow should not become falsely empty merely because an optional ordering index is absent.

This pass removes unnecessary `orderBy` dependencies from bounded, scoped reads where deterministic local/server sorting is sufficient.

The remaining explicit `orderBy` found in the audited app/server source is the Admin queue pagination query, where ordered cursor behavior is intentional.

---

## 13. Validation

Final validation for this source package:

- `npm run check:js` — **PASS**
- `npm run check:theme` — **PASS**
- Node test suite — **139/139 PASS**
- TypeScript parser syntax sweep across application JS/JSX — **PASS**
- Server-side changed modules parsed successfully
- clean source ZIP integrity — **PASS**

A local Next production build could not be executed in this sandbox because the supplied working tree does not contain the installed `next`/`eslint` packages and the sandbox package-install attempt is unavailable. This is not marked as a successful build. Vercel should run the real `npm install` + `next build` on deployment; the source parser sweep was added specifically to prevent recurrence of simple ECMAScript/Turbopack syntax failures.

---

## 14. Deployment checks

After deploying this source:

1. Confirm `/api/public/marketplace?city=Harare` returns `{ ok: true, businesses: [...] }` rather than a Firestore index error.
2. Confirm Marketplace shows the live Monomutapa listing if its business publication state is public/live.
3. Open a Marketplace business and confirm its real locations and published products resolve from the new detail route.
4. Confirm `/business/notifications` appears beside Portfolio/Claims/Invitations/Access, not inside selected-business operations.
5. While inside Monomutapa, create or trigger an important notification for another business and verify it remains in the global tray but does not become Monomutapa's attention banner.
6. Confirm Business and Location names remain fully readable at common laptop/tablet widths.
7. Confirm Kiosk can be understood by a staff member without knowing the words `credential` or `device identity`.
8. Open Admin → Platform/Launch readiness and confirm the Marketplace directory check is visible.
9. Continue deploying Firebase indexes/rules as part of release operations; this source deliberately reduces index fragility but does not replace Firebase infrastructure deployment.

---

## Final product rule

Across Spotly, the target behavior is now:

> **Show the user's real context. Name the next action. Use an icon to reinforce meaning, not replace words. Preserve useful data during transient failures. Never make a failed read look like an empty business. Keep account-wide information separate from the exact Business/Location being operated.**

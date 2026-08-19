# Spotly Business — Full Functional + Visual Production Audit

**Audit date:** 18 August 2026  
**Codebase:** Spotly Web Platform 5.5.3  
**Scope:** Spotly Business end-to-end, with emphasis on Products, Locations, Delivery, Kiosk, workspace context, Firestore read resilience, setup continuity, empty/error states, and cross-module usability.

## Executive result

This pass found that the screenshots were not isolated cosmetic issues. Several different failure modes were producing the same user experience: **the data exists, but the Business workspace renders as if it does not**.

The highest-impact defects were:

1. The Products tabs used a `TabPanel` prop contract that the shared component did not support. Product counters could show `Publishing (1)` while every panel rendered `null`, producing the large blank page in the screenshots.
2. Business catalogue and several other scoped listeners depended on Firestore composite ordering patterns that can fail when indexes are not deployed. This is the same class of production failure that previously hid Locations.
3. Read failures in Products and Orders were previously able to look like valid empty states.
4. `/business/kiosk/live` still inherited the full Business owner authentication/layout even though the kiosk was intended to use a device-scoped credential.
5. The kiosk management flow exposed backend/device concepts before explaining the simple user goal, used vague validation feedback, and did not clearly explain how the setup code moves from Business to the shared tablet.
6. Delivery duplicated geospatial truth by asking owners to manually enter latitude and longitude instead of using the canonical Business location.
7. The Business/Location context control truncated important names and gave Business and Location unequal visual hierarchy.
8. Initial Business setup and post-launch Location editing did not use the same map-location model.

These have been corrected in the source package accompanying this audit.

---

# 1. Products — root cause of the blank catalogue

## What was happening

`components/business/catalog.js` correctly knew that a product existed. That is why the screenshot showed a counter such as:

```text
Publishing (1)
```

However the page used:

```jsx
<TabPanel value={catalogMode} tabValue="products">
```

while the shared `TabPanel` implementation only understood a separate boolean `active` prop.

The result was that the surrounding tabs and counters rendered, but the actual tab body returned `null`.

This was a deterministic UI component bug—not missing product data.

## Fix

The shared `TabPanel` now supports both:

```jsx
active={true}
```

and:

```jsx
value={currentTab}
tabValue="products"
```

The same fix also repairs any other module using the value/tabValue pattern, including Admin catalogue governance.

## Catalogue information architecture

The Products page was simplified to three primary modes:

- Products
- Imports
- Publishing

The previous overlap between “Quick updates” and “Catalogue manager” created two competing mental models for the same catalogue.

The primary actions are now explicit:

- Add product
- Quick add
- Import
- Spotly Library

New items are explicitly described as appearing in Business immediately even before customer publication.

## Product read resilience

The Business catalogue listener no longer requires a `businessId + orderBy(name)` composite index. It queries by Business and sorts the returned records in the client.

This prevents an undeployed Firestore index from turning an existing catalogue into an apparently empty screen.

## Error-state integrity

Products now distinguish:

- loading;
- actual empty catalogue;
- filtered empty catalogue;
- Firestore/read failure.

A failed read now says the products could not be loaded rather than showing an “Add your first product” state.

---

# 2. Firestore scoped-read audit

The earlier Location incident proved that normal Business operations cannot safely depend on every composite index being perfectly deployed before the UI can display existing data.

This pass removed avoidable scoped `orderBy(...)` dependencies from key Business flows and sorts the bounded result set after retrieval.

Hardened reads include:

- Business catalogue;
- public Business catalogue;
- Business orders;
- Business claims;
- Business promotions;
- Business payouts;
- Business activity/audit feed;
- Business support conversations;
- support messages.

This does **not** remove the need to deploy `firestore.indexes.json`. Some platform/customer/Admin queries legitimately still use composite indexes. It reduces the chance that a missing index silently breaks the core Business workspace.

---

# 3. Orders — false-empty protection

Orders now have explicit `ordersLoading` and `ordersError` state in Business context.

The Orders screen will no longer show “no orders” when the underlying query itself failed.

This follows the same invariant now used for Locations and Products:

> A technical read failure must never be represented as valid business emptiness.

---

# 4. Workspace Business + Location selector

The top-right context control was visually inconsistent and could shorten the Business name to values such as `Mon...` while giving Location a different text treatment.

## Fix

Business and Location now use the same visual hierarchy:

- same name font size;
- same line height;
- same weight;
- consistent icon container;
- full names wrap instead of silently truncating;
- wider responsive context surface on desktop.

Clicking Business or Location opens a proper selection sheet with full names and context rather than squeezing critical identity into a tiny native control.

This is important operationally because every page in Business is scoped to an exact Business and often an exact Location.

---

# 5. Kiosk — product concept and architecture redesign

The previous kiosk screen required too much knowledge of how Spotly had implemented the device.

A Business owner should understand only:

> I want this tablet to let customers check in, or let Drivers announce pickup, at this location.

## Management flow

The screen is now structured as three steps:

1. Choose the job.
2. Protect staff controls.
3. Activate the tablet.

The two first production modes are presented as:

- Customer pickup check-in
- Driver pickup

The device name is explicitly described as staff-only.

The exit PIN explains exactly what it protects and validates inline as a 4–8 digit PIN.

The primary action is now:

```text
Create kiosk setup
```

After creation, Spotly provides a one-time setup code with clear Copy/Open actions.

The shared tablet then uses:

```text
Activate kiosk
```

instead of backend terminology.

On the live kiosk, the primary actions are contextual:

- Find order
- Check in Driver
- I’m here — notify the team

rather than a generic “Find”.

## Security architecture bug

The most important Kiosk issue was architectural.

`/business/kiosk/live` was still being wrapped by the normal Business `AuthGate` and `BusinessDataProvider` from the Business layout.

That contradicted the device-scoped design and could expose the live/shared-device route to owner-session lifecycle failures.

The Business layout now bypasses owner authentication specifically for `/business/kiosk/live`.

The live kiosk uses only its revocable device ID and credential headers for kiosk requests.

## Privacy behavior

The kiosk continues to automatically clear successful lookup/check-in information after a short timeout.

Staff exit does not silently revoke the device; revocation remains a deliberate Business action.

---

# 6. Delivery — remove raw latitude/longitude from Business workflow

The old Delivery screen exposed raw Latitude and Longitude inputs and a “Use this device location” action inside Delivery.

This creates two location truths:

- the Business Location record;
- the Delivery configuration record.

It also forces a non-technical Business owner to understand coordinates.

## New invariant

**The exact Location owns its map pin. Delivery consumes that map pin.**

A Location now supports the canonical structure:

```text
location.lat
location.lng
location.accuracy
```

The Location editor presents this as a plain-language **Map pin** section with:

- Use this device here;
- Update map pin;
- Map pin saved;
- Remove pin.

The Delivery screen no longer exposes raw coordinate fields.

Instead it shows:

```text
Pickup map pin
```

with a link to update the exact Location.

## Delivery configuration redesign

The Delivery screen is now organized around Business concepts:

- Offer delivery from this location;
- Delivery radius;
- Typical preparation time;
- Driver pickup point;
- Driver pickup instructions;
- Pickup contact phone;
- Supported vehicle types;
- Temporarily pause new delivery orders.

The readiness side panel now answers a simple question:

```text
Ready for delivery?
```

and explains exactly which location requirements are still missing.

## Backwards compatibility

If a legacy branch has a delivery-specific map location but no canonical root map pin, the trusted Delivery API can reuse/self-heal the canonical Location map pin.

---

# 7. Initial setup and Locations now agree

The initial Business setup previously captured the address but not the same canonical map pin that the later Location editor and Delivery feature use.

Step 3 now optionally allows the owner to capture the map pin while physically at the location.

The copy explicitly says that it is optional during initial Business setup but required before delivery can be enabled.

This keeps initial onboarding simple without forcing pickup-only businesses through delivery configuration.

---

# 8. Empty, loading, and failure states

A recurring Spotly usability risk was collapsing several states into one empty screen.

The core Business modules touched in this pass now deliberately distinguish:

```text
loading
real empty state
filtered empty state
read failure
```

Locations already received this protection in the previous location-integrity release. Products and Orders now follow the same standard, and Delivery/Kiosk rely on the authoritative Location loading/error state.

This is a platform rule worth preserving:

> Never encourage a user to create duplicate data because a failed read was presented as “nothing exists.”

---

# 9. CTA and wording audit

The Business interface was scanned for generic primary actions such as:

```text
Continue
Next
Proceed
```

A remaining Business-claim action was changed from `Continue` to:

```text
Review required action
```

Kiosk actions were also made task-specific.

The general rule remains:

> A primary button should describe the state change it causes.

---

# 10. Visual hierarchy audit

The screenshots showed that functional confusion was amplified by inconsistent hierarchy.

Corrections in this pass include:

- full Business/Location context names;
- consistent Business and Location typography;
- no ellipsis for the primary workspace identity;
- clearer primary/secondary action hierarchy on Products;
- fewer competing catalogue tabs;
- Kiosk instructions before configuration controls;
- Delivery concepts grouped by human task instead of data schema;
- explicit success/warning states for map-pin readiness;
- more intentional use of empty states instead of large unexplained blank canvases.

Truncation remains in high-density tables where it is appropriate for individual product/support-row content, but not for the active workspace identity.

---

# 11. Multi-location behavior

Products remain intentionally scoped to the currently selected Location when a Location is selected.

The context switcher now makes that scope clearer, and product creation explicitly assigns the offering to selected Locations.

A product can still be configured for multiple Locations from its edit flow, including per-Location pricing/stock overrides where supported.

This prevents one branch’s inventory from being silently treated as another branch’s inventory.

---

# 12. Areas reviewed but intentionally not overbuilt

This audit did not replace Spotly Business with a new design system. Existing strong architecture was preserved:

- Business lifecycle;
- Business/Location ownership model;
- Launch review;
- Business Money;
- Team and permissions;
- Notifications;
- Support;
- delivery job domain;
- kiosk device domain.

The work focused on removing contradictions, hidden failure modes, duplicate sources of truth, and confusing task hierarchy.

---

# 13. Production deployment requirements

After deploying the source package:

1. Preserve the existing Vercel/Firebase environment variables. `.env.local` is deliberately not included in the release ZIP.
2. Deploy Firestore/Storage rules as appropriate for the repository.
3. Deploy `firestore.indexes.json` even though core Business Product/Order/Support reads now depend on fewer composite indexes.
4. Confirm the deployed platform configuration does not overwrite source defaults with stale stored launch/pilot copy.
5. Smoke-test one real Business through:
   - Business switch;
   - Location switch;
   - Add/edit Location;
   - Add product;
   - Product list;
   - Publishing tab;
   - Delivery setup;
   - Kiosk setup-code creation;
   - `/business/kiosk/live` activation;
   - Orders;
   - Notifications.

---

# 14. Validation

Final repository checks after this pass:

```text
npm run check:js
PASS

npm run check:theme
PASS
147 source files
24 classified route patterns

npm test
PASS
132 / 132 tests
```

Additional regression coverage now includes:

- TabPanel value/tabValue compatibility;
- Business catalogue composite-index independence;
- Product/Order error-versus-empty behavior;
- kiosk live route bypassing Business-owner auth;
- full-name Business/Location context selector;
- canonical map pin used by Delivery;
- map-pin capture during initial setup;
- support listener index resilience.

## Lint/build limitation

`npm run lint` and `npm run build` were attempted in the supplied execution environment, but the available `node_modules` mount does not contain the `eslint` or `next` binaries:

```text
eslint: not found
next: not found
```

They are therefore **not claimed as passing**. Source checks, theme checks and all repository tests are passing.

---

# Final assessment

The central improvement from this audit is not one screen. It is a stronger Business invariant:

```text
Saved data must appear.
A failed read must look like a failed read.
The selected Business and Location must always be obvious.
A shared device must not inherit an owner session.
Location data must have one canonical source of truth.
Every primary action must explain what it will do.
```

The product failure shown in the screenshots has been fixed at the shared component level, the Kiosk has been redesigned around the Business owner’s task, Delivery no longer asks owners to manage coordinates, and several related data-loading paths have been hardened so the earlier Location-style failure is less likely to reappear elsewhere in Spotly Business.

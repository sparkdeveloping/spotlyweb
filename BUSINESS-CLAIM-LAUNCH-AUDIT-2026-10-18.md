# Spotly Business — pre-launch claim and onboarding audit

**Date:** 18 October 2026  
**Source reviewed:** user-supplied `spotlyweb(20261018-193524).zip`, five attached browser screenshots; Next.js customer onboarding, public Business acquisition, claim form, Firebase browser services, browser state, public directory, submission route, review route, Firestore/Storage rules, and Business account claims overview.

## Release status

**Code fixes delivered; live production verification still required.** The ZIP is a full, modified web project, not a patch-only bundle. No production credentials or dependency installations are included.

### Launch-blocking findings and resolutions

| Priority | Observed risk / root cause | Implemented resolution |
| --- | --- | --- |
| P0 | `?new=1` opened a generic search step; the creation option was not obvious or reliably actionable. | Added dedicated new-business entry, obvious green creation CTA, responsive search results, explicit no-match state, and duplication warning for exact name matches. Removed the inert step-one Continue path. |
| P0 | Guest state was indexed by anonymous session, but the newly authenticated session used a different key. After account creation, the form could reopen at step one. | Dedicated same-origin guest continuity hand-off, stable draft IDs, signed-in migration and Firestore draft save, synchronous local save before navigating. The account creation return URL stays on the original customer or Business domain. |
| P0 | Evidence upload was disabled for guests, with no way to preserve selected files through signup. | Browser IndexedDB temporary File/Blob staging, named pending attachments, automatic secure Firebase Storage upload on return from signup, progress UI and failure recovery. Staged documents never go to localStorage or Firestore before login. |
| P0 | Claiming a directory place could select a synthetic `-place` branch ID, which the submission server rejected as nonexistent. | Filter synthetic branches from selectable Firestore locations, server-side validation of curated records against trusted OpenStreetMap dataset, business-level review path if no actual branches exist, and location-refresh recovery if real records change mid-claim. |
| P0 | New provisional business submission created active owner-related membership and organization ownership before review, creating a permission escalation risk. | Defer both business and organization ownership until authorized approval; create pending membership; activate the authorized membership and ownership only in the admin review transaction. |
| P1 | Saving then clicking "My business requests" could navigate away before save; saved drafts were missing from Business `/claims`. | Await draft save before leaving, block navigation if account save failed, surface saved cloud drafts in `/claims` with one-click Resume. |
| P1 | Form advertised DOC/DOCX, but claim-evidence Storage rules accepted only PDFs and images. | Added Office MIME types to only the private claim-evidence Storage rule, capped uploads at 10 MB and enabled owner deletion. Empty browser MIME types get extension-based fallback. |
| P1 | Claim server accepted evidence URLs directly from the client without checking ownership or existence. | Require the storage path to be in the signed-in user's claim-evidence namespace and verify remote object metadata before submission. |
| P1 | New business required a precise address even when the owner only knew the city. | Only city/town and first location name are mandatory; street or landmark is optional and can be corrected later. |
| P1 | Existing listing data could retain the default Harare location when a different-city business was selected. | Copy known city, area and address from the selected business into the prefilled claim. |
| P2 | First-run customer artwork had insufficient contrast against its washed-out lavender backdrop. | Added darker, high-contrast illustration stage and restrained ambient animation with visually distinct service objects. |
| P1 | Firebase project-mapping file was absent and the example environment config still resembled an old generic demo, while duplicate TypeScript config files failed the JS-only check. | Added `.firebaserc` for `spotly-africa`; refreshed secret-free `.env.example`; removed redundant TS config and generated TS declaration from this JavaScript project. |

### Covered flows

- New listing via the prominent "Add business" link or search no-results state.
- Existing directory listing, single branch, multiple branches, unavailable branches and curated virtual locations.
- Name/role/parent/scope/location/business type/public details form steps, review and submit.
- Guest draft save and account sign-up return, including evidence file continuity in the same browser origin.
- Signed-in draft cloud persistence, My Business Requests, resume, file deletion, and submission.
- Submission storage validation, server-curated listing reconciliation, permission-safe provisional records, manual review and approved ownership grants.
- Customer first-run introduction art, Business account claims listing, and configuration portability.

### Validation performed

- `node --test`: **364 passed, 0 failed** (including seven new onboarding regression tests).
- `npm run check:js`: **passed**.
- `npm run firebase:preflight`: **passed** for the `spotly-africa` project, with expected warning that Admin/VAPID/App Check environment variables are absent from the distributed project.
- `npm run audit:launch`: **passed**, 111 API routes inspected.
- TypeScript parser JSX syntax checks: **passed** on changed React components.
- `node --check`: **passed** on changed non-JSX modules and server routes.

**Not verified here:** `next build`, interactive browser visual QA, live email/password signup and token persistence, real Firebase Storage/Firestore writes, and end-to-end approval in deployed Admin. NPM dependency installation in this sandbox failed due to an npm internal "Exit handler never called" error; consequently no Next production build or emulated Firebase integration tests were possible. Do not treat a passing static test suite as production transaction verification.

### Mandatory production smoke test before first merchant

1. Deploy the updated Next application to both `spotlyafrica.com` and `business.spotlyafrica.com` (same project build), and deploy updated Firebase Storage rules. Ensure the server's Admin credentials belong to `spotly-africa` and **do not** copy `.env.local` from the original archive without validating its Firebase project values.
2. On a fresh private browser session, use **My business is not listed**; enter a unique test business name; complete the wizard; attach a 1–2 MB PDF as a guest; create an account; verify name, step, entered fields and evidence survive the redirect. The file should change from "Saved on device" to "Uploaded securely".
3. Select an existing OSM-curated unclaimed business and confirm that a placeholder location is not required. Submit a reviewed claim and confirm a new business is not granted operating permissions until approved.
4. Test a PDF, PNG and DOCX upload, then delete one and check the Storage rule is actually deployed. Test an intentionally too-large file (over 10 MB) and confirm actionable error messaging.
5. Use **Save and exit** and **My business requests** mid-form; from Business `/claims`, resume the same name, saved step and document evidence. If account cloud save fails, confirm navigation stops and the Retry control appears.
6. Submit a new business claim and confirm it appears in both the applicant's claims list and Spotly Admin's verification queue. Review, approve, and confirm membership and owner IDs are granted **only then**. Review location, catalog, payment, launch and support setup after approval.
7. Repeat on a narrow mobile viewport, desktop Chrome and Safari, and with browser back/forward, refresh, permission-denied geolocation, and slow network. Geolocation is not required for basic onboarding.

### Remaining operational considerations

- Guest files remain in **the same browser origin** until signup and require IndexedDB availability. Private browsing, device changes, clearing site data, or storage quota failure can prevent file continuity; the UI falls back to authenticated upload.
- Real merchant verification remains a human review process; a submitted claim is not an approval. Admin staff must confirm any business-level claim lacking a physical branch before activating location-specific operations.
- Firebase backend Storage rules must be deployed separately; modifying `storage.rules` inside a ZIP does not apply them to live Firebase.
- Review your production environment's App Check, security monitoring and operational email deliverability before launch. Never ship `.env.local`, Firebase Admin private keys or payment credentials in the downloadable ZIP.

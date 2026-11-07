# Spotly | Assisted Driver onboarding and country-aware registration

**Implementation:** 6 November 2026  
**Applies to:** `admin.spotlyafrica.com`, `driver.spotlyafrica.com`, shared Driver eligibility and public Driver acquisition pages.  
**Delivery:** Source-code changes in this package. **Not yet deployed to a live Firebase/Vercel environment.**

## The intended journey

1. An authorized Spotly field recruiter signs into **Admin → Mobility → Prospective Drivers**. A recruiter-only account is taken directly to this workspace rather than exposed to the larger dispatch console.
2. The recruiter creates a prospect using **name**, **operating country**, and **either email or phone number**. City, vehicle, licence reference, work types, zones and private handover notes are optional. No training, evidence approval, payout details or legal agreement is collected during recruitment.
3. The record is kept in Firestore as `driverLeads/{id}` with status `awaiting_claim`. Another authorized officer can open the same prospect and finish or correct the information. Email or phone corrections automatically invalidate the previously issued invitation and return a replacement.
4. The officer copies the private invitation URL, or opens the email, SMS, WhatsApp or calling shortcut. **These are handoff shortcuts, not an integrated notification sender**; opening a channel does not mean a message was sent.
5. The Driver opens `https://driver.spotlyafrica.com/complete?token=…`, signs in or registers using the recorded verified email or phone, and returns to the invitation URL. The server verifies the Firebase identity, the invitation hash and the deadline, then atomically claims the record.
6. The Driver opens the existing **Activation Centre**, with available information prefilled, and continues at the first incomplete step. They submit their own documents, payout details, required consents and agreements. Ordinary Admin review/vehicle and payout verification is still required before activation.
7. The prospect is marked `claimed`, the invitation is consumed and can no longer be reused. Admin can open the corresponding Driver application. Archived prospects have no usable invitation.

## Permissions and access

| Who | Can create/edit prospect | Can create/reissue link | Can change an applicant's country | Can approve Driver |
|---|---:|---:|---:|---:|
| `driver_recruiter` | Yes | Yes | No | No |
| `driver_operations_coordinator` | Yes | Yes | No | Existing authorization rules apply |
| `regional_operations_manager`, `operations_manager` | Yes | Yes | Yes (with reason) | Existing authorization rules apply |
| `admin`, `platform_admin`, `super_admin` | Yes | Yes | Yes (with reason) | Existing authorization rules apply |
| Other roles | Only if explicitly granted `drivers.leads.manage` | Same | Only if explicitly granted `drivers.country.override` | Not through the recruitment permission |

Assign the `driver_recruiter` role to the appropriate internal `users/{uid}` records through Spotly's established privileged role-management workflow. The role template is also included in `data/production-seed.js`. **Do not give field recruiters an unrestricted Admin role.** Existing privileged role-management and seed processes must be reviewed before applying new role templates to production.

New server routes:

- `GET /api/admin/driver-leads` — authorized staff list, up to 250 recent records; prospect data is internal only.
- `POST /api/admin/driver-leads` — create, update, rotate invitation, archive.
- `POST /api/driver/claim-lead` — signed-in Driver claim, email-verified or verified phone match.

The new Firestore collections are `driverLeads` and `driverLeadContacts`. Both deny all direct web-client reads and writes in `firestore.rules`; the server uses the Firebase Admin SDK. Invitation tokens are generated using cryptographic randomness, stored only as SHA-256 hashes, expire after 30 days and are deleted upon claim. Contact indexes prevent two unclaimed prospects from sharing the same email or phone. Creation, edits, invitation rotation, archiving, claim and admin country override create audit records. The only time the plain invitation URL is returned is immediately after it is generated; regenerate when a link is lost.

**Important:** A private link alone does **not** authorize a claim. The Driver must sign in as an account with the exact verified email or Firebase-verified phone number recorded on the prospect. A staff member cannot impersonate Driver consent or create an active Driver identity through this flow.

## Countries, location and honest launch boundaries

`lib/driver-regions.js` centralizes countries, dialing codes, sample cities, mobile money and bank provider suggestions. Currently supported recruitment-country choices are **Malawi, Zimbabwe, Zambia, South Africa, Botswana, Tanzania, Kenya, Uganda, Nigeria and Ghana**. This list is a **data-entry country list**, not a statement that Spotly has launched dispatch, local payment services, permits or Driver approvals everywhere.

The normal Driver registration form asks the user to choose a country rather than silently picking Zimbabwe. Where supported, an explicit **Suggest using my location** action can use opt-in geolocation to propose the country/city. Users who deny location permission can simply choose country/city manually. Authorized Operations can override an existing application's operating country with a reason; the driver is then prevented from changing that field and an already active account is put on compliance hold for rechecking.

**Current Driver activation remains limited to configured Zimbabwe/Malawi operating geography.** Other supported countries may be used to collect interest, but will not be activated in production before local legal, service area, payouts and mobility integration are ready. An admin country override does not bypass these gates. Existing Zimbabwe-only payment infrastructure, isolated Ride Lab simulations, local emergency resources and place data were retained where they actually apply. Do not replace them with fictional generic services.

## Training versus safety

- Removed mandatory Driver training as a step and from shared submission and operational eligibility checks.
- Removed training promotion or prerequisite claims from Driver acquisition pages and requirements planner.
- **Kept** identity/vehicle/insurance requirements where applicable, independent evidence review, legal consent, incident reporting and the Driver **Safety Toolkit** (emergency shortcuts, support and reporting). Removing onboarding training must never automatically remove these operational protections.
- The Spotly **Staff** product has its own learning functionality; this update does not erase employee HR learning workflows unrelated to Driver registration.

## Implementation files (entry points)

- `components/admin-driver-leads.js` — prospect list, progressive form, editing, invitations, communications shortcuts, archive.
- `components/admin-driver-operations.js` — Mobility workspace tab, recruiter-only view and admin country override.
- `lib/driver-leads.js` — schema, roles, token generation, claim authorization and privacy projection.
- `lib/driver-regions.js` — shared country, dialing, provider and launch rules.
- `app/api/admin/driver-leads/route.js` — authenticated recruitment API and Firestore transactions.
- `app/api/driver/claim-lead/route.js` — single-use authenticated claim and application prefill.
- `app/driver/complete/page.js` and `components/driver-complete-invitation.js` — private claim landing.
- `components/driver-app.js`, `app/api/driver/application/route.js`, `lib/driver-capabilities.js`, `lib/driver-delivery-server.js` — saved continuation, country-aware application, training removal.
- `app/api/admin/drivers/route.js` — controlled country changes and approval gates.
- `lib/admin-access.js`, `lib/workspaces.js`, `data/production-seed.js`, `firestore.rules`, `lib/spotly-domains.js` — roles, data security and local-domain routing.
- `components/driver/driver-marketing.js`, `components/driver/eligibility-planner.js` and cross-site acquisition text — matching public presentation.

## Release procedure

1. **Review the code diff** and reconcile it with any changes made after the uploaded archive. The ZIP is a full source snapshot, not an automatic deployment or a guaranteed clean Git patch.
2. **Verify Firebase environment variables and server credentials privately** using your own secret manager. Sensitive local `.env.local` and any private credentials are intentionally excluded from the downloadable ZIP.
3. **Deploy Firestore rules** in coordination with the web release. For example, use the existing project's `npm run firebase:deploy:rules` process after reviewing `firebase.json`, the target Firebase project, and required access. The new server-only collections must not be left exposed.
4. **Deploy the Next.js app** to the Vercel project serving all Spotly product subdomains, not to separate uncoordinated builds. Configure Firebase Auth's authorized domains and relevant sign-in providers for `driver.spotlyafrica.com` and `admin.spotlyafrica.com`.
5. Assign a test account the **`driver_recruiter`** role through the existing trusted admin process, with no broader admin privileges. Verify the account can access Prospective Drivers but cannot approve a Driver or change a Driver's operating country.
6. In a Firebase emulator or staging project, run the full lifecycle: create only minimum fields; update from a second officer; invite by email; reject mismatching/anonymous accounts; verify email/phone then claim; confirm same invite is single-use; confirm old links fail after contact corrections; verify Driver fields prefill and the incomplete-step resume; confirm document and payout review still gates activation; test denied location permission and country override/hold behavior.
7. Validate a new **Malawi** application, a **Zimbabwe** application and a prospect in a **not-yet-launched country**. Confirm only authorized, configured service areas can become active.
8. Audit applicable country-specific regulatory requirements before turning on dispatch in any additional country. Local licensing, insurance, privacy notice and document retention requirements are not made compliant automatically by a country selector.

## Validation performed on the provided source

- `node scripts/check-javascript.mjs` — passed.
- `node --test tests/driver-assisted-onboarding.test.mjs tests/driver-v8-production.test.mjs tests/mobility-service-coverage.test.mjs tests/marketing-launch-integrity.test.mjs` — **44 / 44 passed**.
- Full `node --test tests/*.test.mjs` — **533 passed / 21 failed**, compared with **528 passed / the same 21 failed** in the unmodified uploaded baseline. No additional failures were introduced in this broad suite. The outstanding failures are pre-existing and should be resolved independently before marking the repository fully green.
- The modified JSX/JavaScript files also passed a syntax/React import inspection. **A complete `next build`, Firebase emulator end-to-end run and live deployment were not performed** in this offline environment, so do not treat this as production-certified without step 6 above.

## Recommended next iterations after launch

The core workflow is implemented, but worthwhile follow-ups include a proper assign-to-officer and callback due-date queue, follow-up reminders and statuses, controlled bulk import with explicit contact consent, a formal recruitment consent/disclosure and privacy retention policy, rate limits/abuse detection for invitation creation and claim attempts, delivery receipts with an SMS/email provider, operational analytics across funnel stages, country-specific regulatory evidence requirements, and an emulator-based integration suite covering Firestore transactions and Auth claims. These items are **not** claimed as implemented by this package.
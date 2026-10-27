# Spotly × NXT Workforce — Release and Agency Operations Handoff

**Prepared:** 27 October 2026  
**Status:** Code implemented and local static/Node tests completed; **not deployed or verified against live Firebase**. The `nxt.spotlyafrica.com` domain was added and Vercel reported `verified: true`. The portal cannot work until this code is merged/pushed and successfully built.

## 1. Product intent and protection rules

The new partner workspace is a private operations environment for business/customer acquisition and onboarding. It is **not** a new public business directory. Existing approved claims and customer accounts stay in their existing canonical Firebase collections, and partner-created research leads cannot silently become verified/public listings or transfer legal ownership. Spotly Administrators retain exclusive authority over business ownership verification, publication, financial settings, and platform security.

The partner must see source research and contacts that ordinary customers must **not** see. All NXT roles are scoped, authenticated and checked again on the API server; UI hiding alone is not relied upon.

## 2. What the code provides

- Dedicated `nxt.spotlyafrica.com` workspace with six operational destinations: **Overview, Business directory, Outreach pipeline, Contact history, Customer growth, Team & access**.
- Firestore-backed private **NXT prospects**, filters, pagination, agency assignment, statuses, follow-up dates and next actions, and notes.
- Manual business prospect creation and explicit private staging import of the uploaded workbook: **461 prospects**, **264 with phone-number entries**; the workbook is not automatically converted to public listings. No existing claims are overwritten.
- Existing Spotly business directory lookup with ownership and verification state; link research to existing records and avoid duplicate public businesses.
- Audited calls, WhatsApp, email, visits, meetings, dispositions, notes and opt-outs; `do_not_contact` prevents new outreach records and direct contact shortcuts. A Spotly admin must document any suppression reversal.
- Partner-side lead assignment/handover with reason, agent UID, activity record and audit trail. **This transfers NXT outreach responsibility, not verified legal business ownership.**
- Create a **private, unpublished** Spotly business/organization/branch draft from a prospect. Generate a time-limited owner-claim invitation; recipient must use the existing evidence/approval process for real ownership.
- Private evidence for call recordings, images and PDF documents, up to **32 MiB** each, uploaded to GCS directly via ten-minute signed upload URLs; secure server validation, logged access and one-minute temporary download links. Audio requires an operator assertion of lawful notice or consent.
- First Access analytics via existing first-party metrics: visit events, signup starts, registrations, campaign source and conversion percentages, plus tracked WhatsApp/social UTM link generator. Counters measure recorded events, **not exact unique users, all website visitors or ad-platform impressions**.
- NXT outreach 14-day activity chart, recent-stage breakdown, manager-only workbook import, manager/analyst CSV export of **loaded prospect page**, explicit admin-only directory visibility cleanup.
- New default `verification.publishUnclaimed=false`, and public directory, marketplace, search, individual listing and service endpoints honor the toggle. Seeded/unverified businesses are now private by default. Verified claims are not erased.
- Firebase rules deny direct browser reads/writes of private NXT prospects, activities, evidence and invitation secrets.
- Prior fixes from current GitHub main are retained, including `.firebaserc`, The Menu image fixture, `/first-access` preview and the visible “Save & publish settings” button.

## 3. Roles and delegation

| Role | NXT access | Restrictions |
|---|---|---|
| `nxt_manager` (NXT Lead) | Entire NXT workspace; imports; outreach; assignments; campaign reporting; NXT team management/exports | Cannot grant another NXT Lead, publish listings, verify business owner, access finance or change Spotly settings |
| `nxt_supervisor` | Prospect management, outreach logs, assignments, files, reporting | Cannot change NXT team roles or import wholesale |
| `nxt_outreach` | Private prospects, contact records, files and tracked campaigns | Cannot change team roles or do organization-wide export |
| `nxt_analyst` | Directory/CRM reporting and customer campaign analytics | Read only; no contact writing, recordings download, member administration |
| Existing Spotly Admin | All NXT functions, directory-visibility migration and first NXT Lead appointment | Retains authority for claims, public publication, beta and financial permissions |

Spotly Admin → **Team & access** → **Access & accounts** → assign `nxt_manager` to a person with an existing verified Spotly account. The new NXT Lead can then invite/assign `nxt_supervisor`, `nxt_outreach` and `nxt_analyst` from the NXT Team page. Do **not** assign a broad `super_admin` role to an agency employee for convenience.

## 4. Deploy safely

1. Backup existing Firestore data and check the current protected production commit. **Do not replace the GitHub tree blindly if main has changed.** Review/merge the package changes. The ZIP is a full updated source tree rather than a Git patch.
2. In GitHub, commit code, `data/nxt-outreach-starter.json`, `nxt-storage-cors.json`, Firestore rules and revised `.gitignore`. Confirm `.firebaserc` contains `spotly-africa` and The Menu test fixture exists.
3. Trigger a Vercel **Preview** build first and review `npm run build` and tests. There are 18 known pre-existing full-suite failures that do not block the configured prebuild checks; do not hide these errors.
4. Deploy Firestore rules from this updated repository: `firebase deploy --only firestore:rules --project spotly-africa`. Review indexes and deploy if required using `firebase deploy --only firestore:indexes --project spotly-africa`. Use the trusted Firebase CLI account.
5. Confirm Firebase Authentication **Authorized domains** includes `nxt.spotlyafrica.com` for sign-in/OAuth. Add the domain through Firebase Console if needed.
6. Configure Storage CORS for **the actual Firebase Storage bucket** (not project root). Example: `gcloud storage buckets update gs://spotly-africa.firebasestorage.app --cors-file=nxt-storage-cors.json`. Validate the bucket name from production settings and restrict CORS to the NXT origin. The Firebase Admin service account also must be able to sign GCS URLs and read/write the bucket. Do not put credentials in GitHub.
7. Vercel already reports `nxt.spotlyafrica.com` attached to the `spotlyweb` project, verified. Check the domain loads after the new deployment is ready. Keep custom-domain routing enabled.
8. As Spotly Admin, go to **System → Platform controls**, switch off **Publish unclaimed businesses** AND **Allow provisional public media**, then click **Save & publish settings**. This is essential if old Firestore saved settings still explicitly enable unclaimed publication; a code default cannot override a saved true value.
9. Sign into NXT as Spotly Admin, navigate to **Business directory → Directory publication safety**. Click *Preview visibility changes*, then explicitly confirm *Hide unverified public records*. It scans in pages while preserving approved claims and all source records. Re-run until complete if interrupted. This migration closes old `public:true` Firestore records to direct client reads.
10. Seed the partner roles through existing role seeding if your admin’s role presets were previously generated; the assignment picker already lists the four NXT roles in this code.
11. Assign the first NXT Lead, test as an NXT member, and use **Outreach pipeline → Import workbook dataset → Preview → Confirm private import**. The 461 entries are committed in the package but are **not imported to Firebase until confirmed**.
12. Smoke test: ordinary signed-out visitor cannot see unclaimed businesses; approved claim remains public; NXT role cannot change publication; all four NXT roles are scoped; call note is auditable; assignments transfer correctly; opt-out cannot be re-contacted; signed evidence upload/download works; tracked WhatsApp UTM visit increments and account signup increments separately.

## 5. Operational workflow for NXT

Use **Business directory** to find already known businesses; click **Start outreach** to link a private lead rather than create a duplicate legal business record. Use **Outreach pipeline** to assign people, log calls and set due follow-ups. Choose `do_not_contact` immediately when a prospect declines contact, to suppress further outreach. Store evidence only when lawful and necessary; don't publish it or forward signed URLs. For a business joining, create an **unpublished draft** and share a **seven-day owner claim invitation**; Spotly's existing claim verification process remains mandatory. Use **Customer growth** for UTM links on WhatsApp, social posts and agency campaigns, and distinguish visits from actual Spotly accounts created.

## 6. Data protection and current limits

- Workbook records may be outdated or inaccurate; no contact address is assumed verified or consented. The first call should confirm accuracy and consent, and contact must stop after opt-out.
- Contact actions open the device's phone/email/WhatsApp client. The NXT CRM allows an operator to **log** an activity; it does not place calls, verify they occurred, record calls itself, send mass email, or connect to a PBX. Recording uploads require independent lawful recording practices.
- File uploads are capped at 32 MiB and require CORS/signing setup. GCS pending upload objects need a retention/lifecycle cleanup policy; there is not yet automated content malware scanning, voice transcription or native dialer recording.
- Partner leads and source spreadsheets contain contact details. Establish a joint data-processing agreement, privacy notice, storage retention periods, access review cadence and data deletion process **before broad live rollout**. Limit raw exports to authorized personnel.
- CRM searches filter up to four bounded Firestore pages per request. Charts may be sampled/truncated and are labelled accordingly. The current CSV export only includes loaded records. Do not use them as a sole definitive audited global report.
- The latest locally validated source was not run against live Firebase credentials and cannot be described as a completed production release until the checklist is executed.

## 7. Handoff ownership

**Spotly administrator:** production release, security settings, DNS/Authentication, verification, directory visibility policy, escalation of disputes, role-granting for NXT Leads, retention/deletion rules.  
**NXT Lead:** individual NXT team roles, daily lead assignment, outreach QA, evidence review, campaign links, contacts and weekly agency reporting.  
**NXT team member:** lawful contact, factual notes, customer opt-out respect, secure file upload and justified follow-ups.

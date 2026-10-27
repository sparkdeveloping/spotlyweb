# Spotly First Access — agency operating guide

**For:** Spotly launch, marketing and business onboarding teams. **Release:** 27 October 2026 (source-code package, not yet a confirmed live deployment).

## 1. What the public sees

The public offer is **Spotly First Access** — not a generic “waiting list.” It invites visitors to create a **real Spotly account before launch**, choose up to three products they're interested in, select a city and optionally share why and when they plan to use Spotly. The product names are **Spotly Bite**, **Spotly Shopper**, **Spotly Ride**, **Spotly Live**, **Spotly Send**, **Spotly Book**, plus local places, businesses and Assist. Passwords live in Firebase Auth, not the agency lead records.

A public countdown will not appear until a Spotly administrator explicitly turns it on and enters a target. The site also has a separate maintenance mode.

## 2. Campaign tracking

**Always share a uniquely tagged link for each channel and creative.** The link builder is in `admin.spotlyafrica.com` → **Growth → First Access → Campaign links**.

Examples (safe to share only **after this build is deployed and verified**):

- WhatsApp group: `https://spotlyafrica.com/?utm_source=whatsapp&utm_medium=social&utm_campaign=first-access-launch&utm_content=community-group-a`
- Instagram Reel: `https://spotlyafrica.com/?utm_source=instagram&utm_medium=social&utm_campaign=first-access-launch&utm_content=reel-01`
- Facebook ad: `https://spotlyafrica.com/?utm_source=facebook&utm_medium=paid-social&utm_campaign=first-access-launch&utm_content=ad-c3`
- Email: `https://spotlyafrica.com/?utm_source=email&utm_medium=email&utm_campaign=first-access-launch&utm_content=agency-wave-01`

Keep campaign names stable and vary the `utm_content` label per creative, ad set, outlet, creator or WhatsApp community. No user identity is inferred from a campaign URL. Plain WhatsApp URLs often appear as **direct** traffic because the app may hide the referring page.

## 3. Access and separation of duties

A Spotly administrator provisions an **individual** Firebase/Spotly account for each team member and then assigns roles from **Team → Access & accounts**. Do not share a password or super-admin account.

| Role | Can do | Cannot do |
|---|---|---|
| `agency_launch_manager` | Launch metrics, campaign links, records, stages, ownership, follow-ups, CSV export | Beta grants, money, global platform configuration, admin role changes |
| `agency_outreach_coordinator` | View/edit launch records; contact history and reminders | Export, beta grants, admin configuration, financial data |
| `agency_business_onboarding` | Launch records and approved business/claim read operations | Approval/financial administration by default, beta, global settings |
| Platform administrator | All platform controls allowed by existing privileged account, including controlled `launch.beta` | Should avoid giving these privileges to an external agency |

If an account does not appear in the first results, admins can use the exact-email lookup. Roles require the person to sign up to Spotly first.

## 4. Daily launch workflow

1. Open **Growth → First Access → Overview & demand**. Choose 7, 30 or 90 days and a specific acquisition channel. Review recorded landing sessions, form starts, registrations, channel shares and campaign comparisons.
2. Review the demand graphics for service interest (Spotly Bite, Shopper, etc.), city and desired timing. These are voluntary preferences, not confirmed purchase intent.
3. Open **People**; filter the loaded page by channel, city, service, date, status or assignee. Open a record for full notes and history.
4. Assign an owner, advance its stage (`new`, `contacted`, `qualified`, `invited`, `activated`, `not_interested`) and add a note about next steps.
5. Click **Email**, **Call** or **WhatsApp** to open your own communication app; then **Log activity** with channel, outcome and follow-up date so the rest of the team can see the status. **This release does not auto-send emails, calls or messages.**
6. Launch managers can export up to 500 records at a time. Treat the CSV as sensitive personal data and store it in an access-controlled agency workspace, not a public group.

### Reading the analytics correctly

- Recorded visits represent participating browser-tab sessions. They do not represent unique human beings.
- Registration counts and campaign metrics start only when the new build is deployed.
- Acquisition funnel conversion is indicative, not deterministic: ad blockers, DNT and link sharing impact counts.
- Dashboard acquisition charts reflect the chosen date window. Service/city/timing breakdowns aggregate **all channels** in that window.
- The people table is **paginated**: filters apply only to records currently loaded, not the entire lead database; use Next/Previous to review older signups.
- Always distinguish customer, business and driver interest; plan different follow-up scripts and launch expectations.

## 5. Beta and maintenance operations — Spotly team only

A platform administrator uses **Growth → First Access → People → Open → Grant beta / Revoke beta** for an account that has completed Spotly signup; grants are audited. An agency member should request beta access through the authorized Spotly owner, not through a shared admin login.

In **System → Launch configuration**, the Spotly administrator selects `First Access landing`, `Marketplace`, `Private beta`, or `Maintenance`. The production configuration controls the real behavior even when the code's defaults have changed.

The countdown must stay **OFF** until the launch timeline is approved. Do not promise a hard release date if city-specific readiness is undecided.

## 6. Operational ownership and immediate launch checklist

**Spotly platform owner:** Verify latest deployment, rules/indexes, all URLs, Firebase account creation and emails, beta enforcement, analytics and billing alerts, privacy terms, and admin access separation. Configure `First Access landing` after smoke tests.

**Agency lead:** Send a clearly identified team roster with exact signup email addresses to Spotly's administrator. Set campaign naming standards, generate links, test acquisition sources end-to-end, and assign lead follow-ups. Do not start paid ads until the live public signup has passed testing.

**Customer contact standard:** Identify yourself as Spotly or its authorized agency, explain the reason for contact, honor opted-out marketing preferences, avoid collecting passwords or payment details, and log each follow-up without exposing customer information in shared chats.

## 7. What is not included

No automatic mass email or WhatsApp dispatch, CRM synchronization, AI call transcription, global server-side full-text search, full-database filter/export, fraud-reviewed referral rewards or verified launch/deployment. These are future enhancements; they should not be promised to the agency as live features.

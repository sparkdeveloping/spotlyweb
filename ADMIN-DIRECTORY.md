# Firebase business directory and administrator operations

## Populate the business directory

The browser no longer uses local business data as a marketplace or claim fallback. The included Zimbabwe business dataset is a server-side seed source only.

After Firebase Admin credentials are configured:

1. Sign in as the existing super administrator.
2. Open `/admin/businesses`.
3. Choose **Populate Firestore** in the Firebase directory control.
4. Confirm the import.
5. Wait for the success message, then choose **Check status**.

The server route writes:

- 347 provisional business listing records.
- 347 matching branch records.
- 125 organization groups.
- Search terms used by claim and public-directory search.
- Platform defaults.
- Administrator and business role templates.
- English, ChiShona, and isiNdebele help resources.
- Grocery catalogue templates.
- Seed status and audit records.

Refresh imports are idempotent. Existing business records retain owner-entered data; refreshes add seed metadata rather than overwriting the full record.

## Required server configuration

The populate action uses the Firebase Admin SDK and requires:

```env
FIREBASE_ADMIN_PROJECT_ID=denzeltinashe-spotly
FIREBASE_ADMIN_CLIENT_EMAIL=...
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Add these to Vercel Preview and Production environments, then redeploy.

## Administrator business controls

Admin → Businesses provides:

- Firebase population and current count status.
- Realtime search and filters.
- Claim, verification, visibility, publication, and data-quality states.
- Creation of a new provisional organization, business, and first branch in one operation.
- Editing existing business records.
- Audited support view for a selected business.

A newly added administrator record creates all three hierarchy levels:

```text
Organization
└── Business
    └── First branch
```

## Claims and verification

Admin → Operations provides claim review and publication queues.

For a claim, an administrator can:

- Review the applicant, role, evidence, risk score, and business record.
- Approve ownership.
- Request more information with a clear message.
- Reject the claim.
- Preserve the decision in the claim, business, membership, notification, and audit collections.

Publication approval is separate from ownership verification. A claimed business completes its readiness checklist, requests review, and then receives publication approval or a specific correction request.

## Support, payouts, content, and settings

The administrator application also includes:

- Realtime public, customer, and business support queues.
- Agent assignment, status changes, replies, and internal notes.
- Business payout request progression and settlement references.
- Waitlist and partnership lead review.
- Help article and unlisted YouTube resource management.
- Targeted announcement creation.
- Launch mode, marketplace, languages, verification, finance, support, legal, integration, and notification settings.
- User roles, account state, private-beta access, and custom permissions.
- Audit log search.

## Data review policy

The seed names represent real brands, but every imported record is provisional. Branch names, current locations, contact details, operating hours, media rights, and commercial data must be confirmed before relying on them publicly. Administrators should correct, merge, hide, or remove inaccurate records and retain source metadata for review.

# Firebase business directory and administrator operations

Release: directory version 4

## Upgrade the business directory

The browser does not use local business data as a marketplace or claim fallback. The included Zimbabwe dataset is a protected server-side seed and migration source.

After deploying this release and configuring Firebase Admin credentials:

1. Sign in as the existing Super Administrator.
2. Open `/admin/businesses`.
3. Choose **Upgrade / refresh directory**.
4. Confirm the migration.
5. Wait for the full-screen completion result.
6. Check the displayed brand, location, and organization counts.
7. Open several brands and verify their exact location hierarchy.

Run this first in a non-production Firebase project or after taking an export/backup.

## What directory version 4 writes

- 125 provisional business-brand records
- 347 exact location/branch records
- organization records connecting brands and locations
- brand and location search terms
- business type, capabilities, and operating model
- platform defaults
- administrator and business role templates
- English, ChiShona, and isiNdebele help resources
- adaptive catalogue, menu, event, service, and listing templates
- Zimbabwe official-name reference shelves requiring merchant review
- seed status and audit records

## Legacy duplicate migration

Earlier releases could store records such as `OK Zimbabwe — Bulawayo Hillside` as if they were businesses. Version 4 treats:

```text
OK Zimbabwe                      business brand
└── Bulawayo Hillside            exact location
```

The migration:

- groups directory records by brand
- creates or updates one canonical business per brand
- creates exact locations in `branches`
- archives legacy branch-as-business records
- records the canonical business ID on archived records
- migrates memberships and claims where a safe relationship is available
- preserves claimed, verified, public, owner-entered, and publication state
- avoids replacing full owner-edited records during later refreshes

Review migrated relationships before inviting merchants into Production.

## Required server configuration

```env
FIREBASE_ADMIN_PROJECT_ID=denzeltinashe-spotly
FIREBASE_ADMIN_CLIENT_EMAIL=...
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Add values to Vercel Preview and Production, then redeploy. Never commit the downloaded service-account JSON file.

## Administrator business controls

Admin → Businesses provides:

- directory version and count status
- realtime brand search and filters
- brand hierarchy inspection
- exact location count and location details
- guided creation of a business brand followed by its first location
- business type and capability selection
- claim, verification, visibility, publication, and data-quality states
- existing business editing without overwriting location data
- audited support view

A newly added administrator record creates:

```text
Organization
└── Business brand
    └── First location
```

## Claims and verification

Admin → Operations provides claim review and publication queues.

Administrators can:

- review the applicant, authority, evidence, risk score, business brand, and selected locations
- approve ownership
- request specific information
- reject a claim
- apply configured low-risk approval policy
- preserve decisions in claim, business, membership, notification, and audit records

Ownership approval and public publication remain separate decisions.

## Provisional products and references

Reference templates are intended to reduce blank-page work, not to create verified inventory. They contain no copied product images, guessed prices, stock quantities, or barcodes. Every imported item is inactive and marked for owner review.

Before publication, confirm:

- name and variant
- packaging/size
- price and currency
- stock and branch availability
- substitution behavior
- image and content rights
- barcode/SKU

## Support, payouts, content, and settings

The administrator application also includes:

- realtime support queues, assignment, replies, internal notes, and status changes
- payout request progression and settlement references
- waitlist and partnership lead review
- help article and unlisted YouTube resource management
- targeted announcements
- launch, marketplace, language, verification, finance, support, legal, integration, and notification settings
- user roles, account state, private-beta access, and custom permissions
- audit history

## Data review policy

The seed contains real business and product names found through public or official sources, but every record is provisional. Locations, contacts, hours, media rights, offerings, prices, stock, and ownership must be confirmed. Administrators must be able to correct, merge, hide, archive, or remove inaccurate records and respond to correction/removal requests.

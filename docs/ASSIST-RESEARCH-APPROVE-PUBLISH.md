# Zimbabwe Restaurant Research — Approve & Publish

**Branch:** `feature/zw-restaurant-research-staging-20261019` (draft PR #7).  
**Scope:** Real research data, explicit Admin review and optional directory publication. No payment / Driver fulfilment.

## Operator workflow

1. Sign in to the PR #7 preview as an authorized Spotly Admin.
2. Open **Marketplace → Restaurant Research** (`/admin/assist-research`).
3. Choose the staged research batch and **Check existing businesses & branches**. Review any generated-directory matches as well as live Firestore businesses; the comparison is advisory and not complete.
4. Choose **Review & publish** for the same batch.
5. For each location, select:
   - **New unclaimed listing:** verify the actual street address, existence/operation, factual-data rights, and all potential duplicates. Provide independent research or call notes. Save review; then separately confirm and publish.
   - **Link existing Spotly business:** enter matching business ID and optional branch ID. The server checks existing business identity. Linking changes *only the staged research record* and never overrides a merchant account or catalogue.
   - **Reject:** store reason and exclude.
6. For the **Prices** tab, confirm each item through phone, in-person check, or business confirmation. Online reference pricing remains unverified until checked; rejected items remain recorded for provenance.
7. If necessary, an Admin can withdraw an unclaimed, non-commerce directory listing. This action is blocked when a claim is pending/approved, the owner is verified or commerce is enabled.

## Hard safeguards

- Only Zimbabwe `ZW` research batches may be published; Malawi restaurants remain excluded for Ride-only rollout.
- Publication re-queries businesses and branches in that city and compares generated directory entries. A stronger duplicate match is blocked. Queries have bounds: hitting the bound blocks publication rather than declaring a location unique. Brand-only similarities do not auto-merge.
- Each new business uses deterministic IDs and an atomic `assistPublicationKeys` record. A retried publication returns the prior result; a conflicting record cannot silently overwrite existing data.
- New public businesses are **provisional, unclaimed, discovery-only**. They have a real but unowned organization and branch, `commerceEnabled:false`, `commerceVerified:false`, `fulfilment:[]`, `pickup.enabled:false`, `assistOperationalReady:false`, and no merchant payment or settlement configuration.
- Publication does not add any items to `products` or `independentShoppingStores`. Independently verified research prices are **private** until a separate licensed, operational and financially approved catalogue release.
- All decisions are recorded on private staging documents and written to `auditLogs`. Claimed merchants and active orders are not altered.
- Only platform administrators or operations managers may publish; import-only roles may stage/review, not publish.

## Remaining verification requirements

- Verify the preview build and run CI/static tests, including Firestore emulator transaction behavior, before merging PR #7.
- For each prospective listing, staff must genuinely verify the physical address and business operation, assess source rights, and resolve matches. The prior duplicate report of zero Firestore matches **does not** certify that there are no duplicates.
- Validate source URLs, menu currency, published prices, and business pickup permissions. Record updated evidence before activating any customer fulfilment.
- Existing public generated directory data is still present; strong matching curated records block publication until the canonical listing can be reconciled.
- Enabling customer ordering, collecting funds, or Driver dispatch remains outside the scope of PR #7.

**Never mass-publish the 41 staged locations automatically.** Apply decisions individually after review.

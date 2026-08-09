# Spotly 5.4 Production Runtime Hotfix

## Production errors addressed

### 1. `/api/business-team` returned HTTP 500

Production Firestore reported `FAILED_PRECONDITION: The query requires an index` for `businessInvitations` queried by `businessId` and ordered by `createdAt`.

The repository already contains the correct composite index definition in `firestore.indexes.json`, which means production indexes were not fully deployed. The route is now resilient before that index exists: it queries invitations by `businessId` using the automatic single-field index, then performs the bounded newest-first sort server-side and returns at most 100 records.

The composite index definition remains in the repository and should still be deployed with the normal Firebase deployment process.

### 2. `/api/admin/business-claims/decision` returned HTTP 500

Firestore reported `transactions require all reads to be executed before all writes` during claim approval.

The transaction previously wrote the claim decision before reading the existing membership that would be merged on approval. The transaction now reads the claim, business, and optional membership first, and only then performs claim, membership, business, and audit writes.

## Regression tests added

`tests/production-runtime-hotfix.test.mjs` verifies:

- Business-team invitation loading no longer relies on the undeployed `businessId + createdAt` composite index.
- Claim approval reads the membership before the first transaction write.

## Validation

- `npm run check:js` — PASS
- `npm run check:theme` — PASS
- `npm test` — PASS, 58/58
- Both modified API routes pass `node --check`.

## Deployment

Redeploy this source candidate. Then deploy Firebase indexes as part of normal infrastructure synchronization:

```bash
npx firebase-tools deploy --only firestore:indexes
```

The Business Team route no longer depends on the missing composite index to operate, but deploying the repository indexes keeps production infrastructure aligned with source.

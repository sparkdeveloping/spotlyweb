# Spotly 5.3 Public Query / Rules Compatibility Report

## Businesses
Public text search now queries:
- `public == true`
- `searchTerms array-contains <lookup>`

Empty search also uses `public == true` and name ordering. Firestore business public reads require `resource.data.public == true`.

## Locations / branches
Customer public branch reads use dedicated public helpers with:
- `businessId == <business>`
- `public == true`
- name order

Internal merchant branch subscriptions remain separate and require authenticated scoped access.

## Products
Customer public catalogue subscription uses:
- `businessId == <business>`
- `published == true`
- `active == true`
- name order

Firestore public product reads require the product to be published and active and the parent business to be public. Merchant internal catalogue subscriptions remain separate.

## Indexes
`firestore.indexes.json` includes the public business search, public branch and public product combinations used by these queries.

## Verification status
Source predicates are now aligned with the rule model. Firebase Emulator and deployed Firestore execution remain required before this is marked authorization-verified.

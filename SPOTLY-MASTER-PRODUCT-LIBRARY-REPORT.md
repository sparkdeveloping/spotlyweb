# Spotly Master Product Library Report

## Product identity versus merchant offer

The 5.4 catalogue model separates reusable product identity from a merchant's commercial offer.

### Master product

Stored in `masterProducts` and intended to represent stable identity such as barcode, brand, canonical name, variant, pack size, category and verified imagery.

### Merchant product / offer

Stored in the existing `products` collection and scoped to a business. It can reference `masterProductId` and owns merchant-specific values such as price, stock, availability, SKU, publication and branch overrides.

## Matching

Matching priority:

1. barcode / GTIN exact
2. master product ID exact
3. manufacturer SKU
4. normalized identity
5. fuzzy review candidate

Fuzzy matches are never automatic merges.

## Library API

`/api/business/catalog-library`

Supports:

- verified library search
- barcode lookup
- collection discovery
- cursor pagination
- adding multiple merchant offers
- product suggestions
- import matching

## Collections

`catalogCollections` provides reusable curated groups. Existing starter-template concepts can be migrated toward collections without claiming retailer partnerships that do not exist.

## Branch inheritance

Business offers can define a default price/availability/stock/SKU and branch-specific overrides. The customer marketplace resolves the selected branch before displaying merchant offer values.

## Staff capture

`/staff/catalogue` allows field workers to capture product observations and provisional master products. Master records have verification state and are reviewed by authorized Staff/Admin users.

## Source and rights model

`catalogueSources` records source type, rights status, permission status and allowed uses.

Product image rights include merchant-owned, Spotly-photographed, manufacturer-provided, licensed, permission-pending and reference-only. Publication rejects unapproved image rights.

## Starter data

The technical starter library is seeded from generic/legitimate records already present in Spotly source. It intentionally does not fabricate GTINs, copy protected retailer images, or claim complete SPAR/OK/Bon Marché catalogues.

## Scale controls

The library is searched through server queries; it is not loaded wholesale into the browser. Merchant imports and library results are incremental, and import batches preserve review state.

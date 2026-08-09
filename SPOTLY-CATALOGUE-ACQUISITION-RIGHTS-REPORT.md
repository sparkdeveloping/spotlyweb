# Spotly Catalogue Acquisition and Rights Report

## Policy

Spotly's reusable product catalogue should be built from data it owns, receives with permission, or is licensed to publish. Public retailer websites may be useful for research/discovery but are not automatically republishable sources.

## Source categories

- Spotly field collection
- Merchant-provided data
- Manufacturer-provided data
- Distributor/supplier feed
- Licensed dataset
- Authorized retailer partner feed
- Reference-only public source

## Rights states

- `merchant_owned`
- `spotly_photographed`
- `manufacturer_provided`
- `licensed`
- `permission_pending`
- `reference_only`

Only publishable states are accepted for customer-facing product imagery.

## Field collection

Spotly Staff capture preserves:

- business/location
- barcode
- observed availability
- observed price when collection is authorized
- packaging-match confirmation
- observation date/worker
- original images

Observations do not automatically overwrite a merchant's live price or availability.

## Public retailer research

No production scraper that republishes retailer photography/descriptions was added. The source registry can hold reference URLs and observation dates, allowing Spotly to later add explicit retailer/manufacturer integrations without changing the core data model.

## Import governance

Merchant spreadsheets are private business inputs. Imports preserve source and batch metadata, flag possible duplicate matches, and remain drafts until publication validation succeeds.

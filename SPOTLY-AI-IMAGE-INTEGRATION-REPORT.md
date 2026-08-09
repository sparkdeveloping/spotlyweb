# Spotly AI Product Image Integration Report

## Flow

Merchant product media supports:

1. Preserve original upload.
2. Use original immediately, or request Spotly enhancement.
3. Compare original and enhanced versions.
4. Approve the desired version.
5. Keep provenance for every derivative.

## Server endpoint

`POST /api/business/media/enhance-product`

The endpoint:

- requires authentication
- rate-limits enhancement usage
- verifies `catalog.update` access and business scope
- verifies the source Storage path belongs to the business catalogue
- reads the original server-side
- calls the OpenAI Images edit endpoint with a server-only API key
- saves the output as a separate Storage object
- creates a `productImageVersions` record
- writes trusted audit metadata

## Configuration

```text
OPENAI_API_KEY=
OPENAI_IMAGE_MODEL=gpt-image-2
OPENAI_TRANSPARENT_IMAGE_MODEL=gpt-image-1.5
```

No OpenAI credential is exposed through `NEXT_PUBLIC_*` variables.

## Factual-product constraints

Enhancement prompts explicitly instruct the model not to alter logo, package structure, variant, printed wording, weight/volume, product colour, barcode, certifications or claims.

Available modes include background cleanup, lighting improvement, crop/perspective correction, professional product presentation and transparent-background extraction.

## Approval and provenance

The original is never overwritten. AI derivatives remain `pending` until a merchant/reviewer deliberately chooses/approves them. Records include source image, model, mode, actor, timestamps and Storage path.

## Failure behavior

Provider/rate/storage failures leave the original intact and return a recoverable error. The merchant can retry or use the original.

## Production requirements

- Configure OpenAI organization/API access and approved models.
- Run live staging edits with representative Zimbabwe retail packaging.
- Review text/logo preservation before public publication.
- Keep rate limits/cost telemetry active.

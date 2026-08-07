# Spotly Functional Repair Report

## Waitlist

- Phone and area are included in the persisted payload.
- Consent defaults to false and requires explicit action.
- Name, email, city, optional phone, and consent are validated.
- Inline errors and an error summary are shown.
- Failed submissions preserve values.
- Existing entries return an updated-entry result.
- Success can be edited and closing resets intentionally.

## Claim save truth

- Saving state is visible.
- Signed-in account save is identified as authoritative.
- Anonymous/local save is identified as device-only.
- Account-save failure remains visible and exposes Retry.
- Evidence upload progress remains part of the draft workflow.
- Evidence removal deletes the Storage object when possible; the item is restored in the UI if deletion fails.

## Reservation release

Added transaction-safe, idempotent release for reserved stock and pickup capacity.

Supported reasons:

- Customer cancellation
- Merchant rejection
- Payment failure
- Payment expiry
- Order expiry
- Admin void
- Refund before fulfilment

Release updates the order, slot counts, product reserved quantities, reason, timestamp, and order event. Merchant terminal-state updates and Paynow failure/expiry paths invoke the release service.

## Admin queue scale

The current queue implementation uses bounded server queries and progressive loading up to a defined ceiling. It does not yet implement true Firestore cursor pagination. This limitation is intentionally not described as complete.

## Theme-related functional repair

- Error recovery buttons no longer depend on portal accent context.
- System-theme state is resolved correctly.
- Theme is applied before first paint.
- Account, Marketplace, Support, Login, and AuthGate no longer override adaptive root accents with incomplete fixed sets.
- Portal accents use paired workspace scopes rather than inline fixed values.

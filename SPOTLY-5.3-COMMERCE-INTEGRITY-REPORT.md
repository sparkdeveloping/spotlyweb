# Spotly 5.3 Commerce Integrity Report

## Immutable charge amount
Paynow now receives one authoritative charge line derived from the persisted Spotly order total. Product subtotal, service fee and other server-calculated totals therefore cannot drift from the provider charge by reconstructing product lines on the client.

## Payment initiation idempotency
- `paymentInitiationLocks/{orderId}` provides a short server lease while provider initiation is being created.
- An existing valid pending payment intent is reused.
- An in-progress initiated intent returns a conflict rather than creating another provider request.
- Provider-accepted-but-Firestore-finalization failure creates a reconciliation issue rather than pretending the order is unpaid.

## Payment state machine
Internal payment state is separated from raw provider status. `lib/payment-state.js` defines allowed monotonic transitions. `paid` cannot regress to failed, expired or cancelled; it can only enter the controlled refund flow.

Delayed successful provider confirmation from an earlier terminal pre-payment state can be observed without losing money: paid remains authoritative and an incompatible terminal order state becomes a reconciliation issue.

## Callback replay protection
Provider callbacks are assigned deterministic replay keys and recorded in `paymentCallbacks`. Replayed identical callbacks return the existing result without duplicating order events, notifications or reservation release.

## Reconciliation
`paymentReconciliationIssues` records amount mismatch, invalid transitions, provider disputes, finalization failures and paid-after-terminal-order anomalies. Admin queues can surface these records through the existing queue framework.

## Reservation authority
The old generic reservation-release route returns HTTP 410. Reservation release is now an internal primitive called only after actor-specific state validation.

- Customer: `/api/orders/cancel` with fixed `customer_cancelled` reason and pickup cancellation cutoff.
- Merchant: `/api/business-orders/update` with scoped business/branch authorization and validated transitions.
- Admin: `/api/admin/orders/void` with explicit platform permission and reason.
- Provider/server: payment failure/expiry processing.
- Refund: `/api/admin/refunds` after finance authorization.

Release is transactional and idempotent for reserved stock and pickup capacity.

## Refunds
Spotly 5.3 implements an explicit manual reconciliation workflow:
`refund_requested -> refund_processing -> refunded` or `refund_failed`.

The current controlled pilot intentionally supports full refunds only. Partial refunds are rejected instead of being represented inaccurately by a full-refund payment state. A provider reference is required before marking a refund complete.

## Payouts
Payout requests and settlement state changes are server-authorized through `/api/payouts`. Client Firestore writes to payouts are disabled. Settlement state follows a server transition map and a settlement reference is mandatory before `paid`.

## Concurrency/test status
Pure/static tests cover payment state monotonicity, callback-key stability, authoritative total usage, initiation locks, refund constraints and reservation idempotency.

The Firebase emulator concurrency suite must still be executed externally for final proof of:
- final stock unit contention,
- final slot contention,
- duplicate checkout,
- cancel-versus-paid callback race,
- success-versus-failure callback race,
- duplicate release.

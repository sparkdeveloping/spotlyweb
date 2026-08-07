# Spotly 5.3 Reservation / Terminal Action Matrix

| Action | Actor | Preconditions | Result |
|---|---|---|---|
| Customer cancellation | Order customer | Cancellable order, unpaid/refundable state, before pickup cutoff | Cancel order and release reservation once |
| Merchant rejection/cancel | Authorized business worker in correct branch | Valid merchant transition | Terminal merchant state and release when applicable |
| Payment failed/expired | Server/provider processor | Valid monotonic payment transition before paid | Payment terminal state and release when order still awaiting payment/submitted |
| Admin void | Platform operations/finance authority | Unpaid/non-refunded eligible order + reason | Void and release |
| Full refund before fulfilment | Finance refund authority | Paid order, full captured amount, manual provider reference on completion | Refund state and release reservation once |
| Full refund after fulfilment | Finance refund authority | Paid order, full amount | Refund financial state; do not restore consumed inventory |
| Generic release endpoint | Any | N/A | HTTP 410; retired |

`releaseReservationInTransaction` is internal. It does not grant authorization. Actor-specific routes validate authorization and current state before calling it.

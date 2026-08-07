# Spotly 5.3 Payment State Matrix

Internal state and Paynow provider status are stored separately.

| Current | Requested | Result |
|---|---|---|
| unpaid | initiated / pending / cancelled | Allowed |
| initiated | pending / paid / failed / expired / cancelled / amount_mismatch | Allowed |
| pending | paid / failed / expired / cancelled / amount_mismatch | Allowed |
| failed | initiated / pending / paid | Allowed; late paid confirmation is preserved |
| expired | initiated / pending / paid | Allowed; late paid confirmation is preserved |
| cancelled | paid | Allowed only as provider truth; creates reconciliation if order already terminal |
| amount_mismatch | paid / failed / expired | Allowed after provider/reconciliation evidence |
| paid | refund_pending | Allowed |
| paid | failed / expired / cancelled | **Rejected** |
| refund_pending | refunded / refund_failed | Allowed |
| refund_failed | refund_pending | Allowed retry |
| refunded | any | Rejected |

Provider callback replay is deduplicated in `paymentCallbacks`. Invalid transitions produce a reconciliation issue rather than overwriting a stronger internal state.

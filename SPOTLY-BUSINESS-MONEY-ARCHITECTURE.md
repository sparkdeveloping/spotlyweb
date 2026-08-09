# Spotly Business Money Architecture

## Pilot settlement model

Spotly 5.4 uses one truthful **platform settlement** model in the merchant UI. Customer payment methods and merchant payout destinations are separate concepts.

The Business UI no longer presents direct settlement, platform settlement and hybrid settlement as equally operational choices.

## Ledger

`businessLedgerEntries` is the trusted financial history. Ledger entries are server-authored and represent transfers/effects such as:

- payment captured
- platform fee
- settlement becoming available
- refund
- payout requested
- payout processing
- payout paid
- payout reversal/adjustment

`businessBalanceAccounts` stores per-business/per-currency buckets:

- pending
- available
- reserved
- payout processing
- paid out

The browser does not calculate authoritative withdrawal balance from loaded orders.

## Payment-to-ledger flow

Paid order -> captured amount enters pending -> Spotly service fee is debited -> reconciliation marks eligible merchant net available -> payout request reserves available balance -> processing -> paid out.

Full manual refund handling reverses eligible merchant value according to the existing controlled-pilot refund model.

## Settlement account

`businessSettlementAccounts` is a restricted server-controlled record.

The client receives only sanitized values including bank, branch, account holder, currency, status and account-number last four. The full account number is encrypted with `SPOTLY_FINANCE_ENCRYPTION_KEY` before storage.

Settlement states include:

- details submitted
- verified
- action required

Changing an already verified account requires recent authentication.

## Payout validation

A merchant payout request requires:

- active authorized business
- finance permission
- verified settlement account
- supported currency
- server-authoritative available balance
- request amount not exceeding available balance

The payout request creates a corresponding ledger reservation atomically.

## Admin operations

Admin Finance can:

- verify/reject settlement-account submissions
- reconcile paid orders into merchant available balance
- advance legacy/ledger-backed payout status through approved/processing/paid or restore funds when rejected

## Statements

Business Money exposes ledger activity and CSV statement export. Currency balances remain separate.

## Legacy compatibility

Legacy `businessFinanceSettings` remains readable where older readiness/data paths need compatibility. New Money writes use `businessFinance`, `businessSettlementAccounts`, ledger and balance records. Business readiness is derived from the new `moneySetup` summary rather than legacy payout fields.

## External requirements before real merchant payouts

- Production legal/accounting review for the platform-settlement model.
- Operational bank transfer / payout execution process or dedicated payout API.
- Reconciliation runbook.
- Production encryption key management/rotation.
- Verified payout schedule and support process.

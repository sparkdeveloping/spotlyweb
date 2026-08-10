# Spotly Business 5.5 — State Vocabulary

The merchant interface must name the thing being reviewed. Generic `Approved`, `Pending` and `Under review` labels are not sufficient when multiple reviews can exist simultaneously.

## Stage 1 — Business access

- **Not claimed** — no approved management relationship yet.
- **Claim in progress** — merchant has started access work.
- **Waiting on Spotly business access** — claim submitted/reviewing.
- **Business access needs information** — merchant action required.
- **Business access approved** — authority accepted or valid membership/owner access exists.
- **Business access rejected** — access request rejected.

## Stage 2 — Business basics

- **Not started**
- **In progress**
- **Business basics complete**

Progress is data-derived and completion-based.

## Stage 3 — Launch preparation rows

- **Complete** — requirement satisfied.
- **Your action** — merchant needs to act.
- **Waiting on Spotly** — merchant submission is complete; Spotly owns the next action.
- **Blocked** — platform/dependency prevents progress.
- **Not required** — requirement does not apply to this business configuration.

## Settlement

- **Not required**
- **Not started**
- **Details submitted / Waiting on Spotly**
- **Settlement account verified**
- **Settlement account needs action**

Settlement is not described as business-access approval or final launch approval.

## Final launch review

- **Not ready**
- **Ready to submit**
- **Submitted / Waiting on Spotly**
- **Changes requested**
- **Approved for launch**
- **Re-review required** for launch-critical changes to a live business
- **Changes waiting on Spotly** for live re-review submission

## Business operational state

- **Preparing for launch**
- **Waiting on Spotly launch review**
- **Live**
- **Live · Temporarily paused**
- **Suspended**

A branch can be internally active while the overall business is still preparing; that does not mean the business is customer-live.

## Responsibility vocabulary

- **Your action** — merchant is responsible.
- **Waiting on Spotly** — Spotly reviewer is responsible.
- **Complete** — no action.
- **Blocked** — dependency/system prevents continuation.
- **Not required** — irrelevant to this configuration.

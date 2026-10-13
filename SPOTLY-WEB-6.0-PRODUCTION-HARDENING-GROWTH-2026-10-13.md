# Spotly Web 6.0 — Production Hardening & Growth

Release date: 2026-10-13

Spotly Web 6.0 builds on the 5.9 customer marketplace and dedicated Eat, Shop, Book and Events experiences. The goal of this release is not another visual redesign. It hardens transactions, makes public marketplace content discoverable, adds controlled growth mechanics, and instruments the customer funnel without exposing sensitive customer data to analytics.

## Customer growth systems

### Promotions

- Merchant promotions and Spotly-funded platform campaigns are both eligible at checkout.
- Automatic promotions can apply without a code.
- Coded promotions are normalized and validated server-side.
- Minimum spend, date window, business scope, branch scope, product scope, audience, currency and usage limits are enforced server-side.
- Promotion usage is reserved atomically with the order/booking transaction.
- Unpaid cancellation or expiry releases reserved promotion usage.
- Checkout, booking and ticket flows show the applied discount and persist a promotion snapshot on the transaction.
- Public Eat/Shop/Book/Events feeds can surface eligible public automatic offers.
- Admin includes audited platform campaign management for marketing-authorized roles.

### Referrals

- Every signed-in customer can receive a unique referral code.
- A customer can attach only one referral claim.
- Self-referral is rejected.
- Referral claims must be attached before the invited customer's first paid Spotly purchase.
- Qualification occurs only after a paid eligible order.
- Referrer/referee rewards are created from Admin-controlled platform settings.
- Rewards can be auto-approved or held for Admin review.
- Referral profiles, codes, claims and rewards are server-only Firestore collections.

### Repeat behavior

- Home includes transaction-derived `Again` actions.
- Recently viewed businesses are stored per customer/browser state.
- Activity retry routes customers back into the relevant business or offering.
- Completed experiences can be reviewed and revisited from Activity.

## Reviews and trust

- Reviews can only be submitted from completed customer activity owned by the authenticated customer.
- Reviews are marked as verified Spotly activity.
- Business rating average and review count are transactionally maintained.
- Public business detail loads recent published verified reviews through a bounded rate-limited server route.
- Customer search and service cards can surface ratings/review counts.

## Transaction hardening

- Appointment, booking and ticket capacity is rechecked inside the Firestore transaction.
- Multi-day accommodation reservations reserve each required night.
- Reservation release is idempotent and cannot produce negative reserved quantities.
- Product prices, fulfilment, fees and promotion eligibility are revalidated server-side when the customer submits.
- Checkout uses an idempotent checkout/request identifier to reduce duplicate submissions.
- Payment provider callbacks are ledgered and deduplicated.
- Paid payment state cannot regress to failed/cancelled/expired.
- Payment amount mismatches and invalid state transitions create reconciliation issues instead of silently mutating the order.
- Failed/expired unpaid payments release inventory, availability and reserved promotion usage where appropriate.
- Activity includes recovery paths for retryable payment/transaction states.

## SEO and public discovery

- `/place/<id>` has server-derived metadata and LocalBusiness structured data.
- `/item/<id>` has server-derived metadata and Product/Event structured data.
- `/city/<city>/<service>` creates crawlable city/service discovery pages for Eat, Shop, Book and Events.
- Sitemap includes service routes, city/service routes, live public businesses and live public offerings.
- Robots rules keep customer/public discovery crawlable while protecting account/workspace routes.
- Public SEO reads are server-derived from explicitly public/live records.

## Performance

- Public service feeds use a bounded short-lived server seed cache.
- Public service feeds use bounded Firestore reads, HTTP caching and stale-while-revalidate.
- Dedicated service feeds support offset pagination and return a `nextOffset` cursor.
- Public reviews use bounded reads and HTTP stale-while-revalidate.
- Search and public marketplace APIs remain rate-limited and bounded.
- Customer product imagery continues to use Next Image where appropriate.

## Analytics

Customer funnel events now cover marketplace/service views, search results and zero-results, business/item selection, add/remove cart, begin checkout, order creation, booking creation, promotion application, retry/cancel behavior, reviews and referral sharing/claiming.

Analytics parameters are sanitized before Firebase Analytics. Keys that could contain email, phone, address, free-form messages/notes, tokens, secrets, customer/user identifiers, order identifiers, raw search queries, coordinates or display names are removed. Analytics is best-effort and never blocks a customer action.

## Admin growth controls

Admin now includes:

- Spotly-funded promotion campaigns
- business scoping for platform campaigns
- campaign dates, audience, minimum spend and usage limits
- referral reward settings
- referral reward review/approval when auto-approval is disabled
- audit records for privileged growth actions

## Security collections

The following growth/availability collections are server-authoritative in Firestore rules:

- `promotionRedemptions`
- `referralProfiles`
- `referralCodes`
- `referralClaims`
- `referralRewards`
- `businessReviews`
- `availabilityReservations`

Deploy the supplied Firestore rules with this release.

## Feature boundaries

Ride and Send remain feature-gated. 6.0 does not simulate passenger dispatch or peer-to-peer parcel dispatch. Those services should become transactional only when their Driver/Admin/dispatch operational systems are implemented.

## Validation

The source release must pass:

```bash
npm run check:js
npm run check:theme
npm test
npm run lint
npm run build
```

In the packaging environment, JavaScript/hook checks, theme-safety checks and Node regression tests were executed. The npm dependency installation did not complete inside the packaging sandbox, so Vercel remains the final Next.js compiler/linter authority for deployment.

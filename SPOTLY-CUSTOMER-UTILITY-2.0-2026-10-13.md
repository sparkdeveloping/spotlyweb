# Spotly Customer Utility 2.0 — Web 5.8.0

This release completes the persistent customer utility layer around the Spotly 2.0 marketplace.

## Implemented

### Global Search 2.0
- Server-backed mixed search across businesses, products, services, events, and published branch places.
- City and service context.
- Search filters, recent searches, empty/error/loading states, result deep links, and save actions.
- Public search endpoint is rate limited and only reads public/published marketplace data.

### Activity 2.0
- Orders, deliveries, bookings, appointments, and tickets live in one customer lifecycle destination.
- Needs-attention, active, upcoming, and past grouping.
- Existing payment, delivery PIN, status, cancellation, support, and transaction detail behavior remains wired to production data.

### Saved 2.0
- Saved businesses plus generic saved products, services, events, and places.
- Saved businesses load independently of the currently selected city.
- Self-scoped Firestore rules for `savedItems`.

### Account 2.0
- Direct links to Activity, Saved, Notifications, and Help.
- Saved places management.
- Preferred currency and default fulfilment settings.
- Existing profile, notification preferences, privacy, auth, and account flows retained.

### Notification Center
- Dedicated customer mode and `/notifications` route.
- Customer categories: All, Unread, Orders, Bookings, Support, Account.
- Existing business/admin notification behavior preserved.

### Customer Help
- Help content for orders/delivery, bookings/tickets, payments, Saved, profile, places, and notifications.
- Existing contextual support conversation infrastructure retained.

### Checkout continuity
- Customer preferred fulfilment (`pickup` or `delivery`) is used as the checkout default when supported by the selected business location.

## Integrity
- New customer utility integrity tests cover search, saves, Activity, notifications, Account, checkout preferences, and Help.
- Existing commerce, payment, driver delivery, business, notification, domain/SSO, and theme integrity tests remain in the suite.

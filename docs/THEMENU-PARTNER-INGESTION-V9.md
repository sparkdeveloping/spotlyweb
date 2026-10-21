# The Menu × Spotly: licensed-media and independently sourced menu rollout

**Permission evidence:** A signed, dated, one-page `THE MENU — OFFICIAL CONTENT USE AUTHORIZATION` was supplied privately to the project owner on 21 October 2026. It authorizes non-exclusive, royalty-free copying, storage, display and reasonable resizing/reformatting of The Menu's restaurant listings, menus, prices and photographs; attribution where practicable; no sublicense/resale; revocable with a 30-day takedown obligation. **Crucial limitation:** the grant extends only to material The Menu owns or has the ability to license; third-party Google Maps, photographer and merchant-owned photos need separate reuse rights. Keep the signed proof in the private rights register, not the public Git repository. Data and price freshness are not guaranteed.

## Safe implementation sequence

1. Obtain a written permission summary with contact, date, covered photograph origins, copying/redistribution versus embedding, attribution requirements, commercial use, permitted derivative images, refresh methods and termination policy. Photos sourced from other providers may require separate permission. Record that document in the operations rights register, not in public GitHub.
2. Match restaurant location identity by **name + city + branch address** (never name alone). Flag duplicates and independent merchant claims for human review. Never imply that The Menu's verification or Spotly Assist makes a restaurant a Spotly partner.
3. For approved photographs, import to Spotly-controlled licensed Firebase Storage only after recording the source page, original photographer if known, written usage permission, original URL, matching restaurant/branch, reviewer and import time. Store a business record with `source.type = "themenu_partner"`, `source.rightsStatus = "licensed"` and `partnerMedia = { sourceName: "The Menu", sourceUrl, storedUrl, usageApproved: true, locationMatched: true }`. The UI displays an attribution badge and does not use the merchant-owned logo or partnership badge.
4. Treat menu item descriptions, sizes, variants, currencies and prices as **source observations**. Record a per-location `menu.lastCheckedAt` and `source.lastMenuCheckedAt`. Menu information more than 14 days old cannot be promoted as recent. Display price-check expectations and confirm each customer's current price before any independent-shopper purchase.
5. Keep the existing separate Admin location review, per-location price verification and Assist activation gates. Source publishing does not activate cash checkout, merchant inventory, Driver assignments, refunds or payments.
6. Implement a scheduled freshness watch only after a licensed feed/export process is agreed. Daily reviews may detect changes but cannot guarantee price accuracy.
7. Roll out the first manually matched and reviewed locations (e.g. 5–10), then review image rendering, duplicate matches, source attribution and price disputes before a broader import. Do not auto-publish the directory as orderable.

## Display rules

- Usable verified commerce is first, independently assisted requests second, passive directory third.
- Listings without an authorized actual photograph are compact textual directory rows, not repeated fake merchant-photo cards.
- Source-licensed photographs are labeled `Photo: The Menu`, **not** `Verified Spotly Merchant`.
- Assist menus always say prices can change and require a current independent price check.
- The Menu's public restaurant popularity/ratings are not Spotly transaction ratings. Never invent customer reviews or paid partnerships.

## Implementation in this PR

`lib/themenu-source-policy.js` enforces photo source and rights attestation and exposes freshness status. `lib/marketplace-editorial.js` only renders approved partner images hosted through the allowed Spotly Firebase media origin. `components/service-experience.js` separates active Assist shops from passive directory entries and turns photo-less directory posters into concise cards. This PR **does not bulk-copy The Menu media, import its menus, change live Firebase records or enable ordering**. Those operations require the location-specific permission/evidence workflow above.


## User-facing first slice, 21 October 2026
- The first production-grade customer menu-discovery section references Doppio Zero Harare and Fishmonger with source-linked, date-stamped sample menu prices. These are editorial source listings, not products added to Spotly checkout.
- Their public The Menu profiles link or credit photographs to **Facebook and Google Maps**. The permission statement explicitly excludes third-party rights not held by The Menu, so we do **not** rehost, silently hotlink or display those as Spotly-owned business photos.
- The Bite hero uses a separately sourced editorial food photograph bundled in Spotly's existing licensed editorial asset set. It is labeled editorial, never presented as a photo of Fishmonger or Doppio Zero.
- A proper bulk picture rollout requires The Menu to identify which photos it has sublicensable rights to (or the restaurant/photographer to grant separately), plus a vetted source-URL-to-location mapping. The importer from the previous milestone already supports rights-gated, branch-matched Firebase-hosted licensed media.

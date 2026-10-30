# Spotly discovery curation: Zimbabwe pilot

Date: 2026-10-30. Branch: `feat/spotly-premium-experience-2026`. Non-transactional feature work; no production publication, database writes, migrations, review fabrication, merchant activation, or release approval.

## Why

Spotly had a deeper internal place taxonomy than the customer experience revealed, but its discovery systems did not consistently apply readiness-first ordering. The Home ranking used commerce tiers while the service-feed endpoint sorted featured flags and an unexplained numerical prior of 4.1 as if unknown review scores could infer quality. Canonical products may also arrive with generic categories such as `Groceries > Groceries`. A product with the name “A4 Exercise Book” should not remain in grocery-only browsing.

## What changed

- A named, source-supported **editorial recognition signal** for established Zimbabwe retail brands is now an explicit input to ranking **within** the existing merchant-readiness tier. The number is internal, not a 5-star rating. Merchants with real commerce are still ahead of Assist merchants, then verified listings, then open directory references.
- Unverified imports do not jump the queue using an untrusted `isFeatured` flag. Independent businesses remain eligible for discovery; an unknown name is **not** a negative quality judgement.
- Strongly documented closures are flagged for **branch re-verification**, not treated as open just because the parent chain is well known. The model does not auto-delete records, change launch flags or assert that a merchant is closed today.
- The server service-feed, public marketplace list and search share more of the same explainable ranking inputs; the service-feed no longer invents a neutral review prior for missing ratings.
- Shopper's merchant categories continue to use the existing place taxonomy; source/merchant product categories are preserved when specific, with nested inferred product paths only where the original path is unhelpful. Search exposes a product-category filter and directory cards distinguish editorial brand recognition from customer reviews.
- A bespoke **filled** five-icon set replaces outline-only customer navigation on mobile and desktop. All destination IDs, links, reduced-motion behavior and active-page semantics stay unchanged.

## Public research, checked 30 October 2026

These sources are **brand recognition and branch-review leads**, not live stock, merchant participation, guaranteed hours, or customer satisfaction evidence.

| Evidence | Implication |
| --- | --- |
| TM Pick n Pay official Zimbabwe webstore: https://tmwebstore.quatrohaus.com/hampers/1 | Established national supermarket identity; individual branches still need current status |
| OK Zimbabwe 2025 annual report: https://www.zse.co.zw/wp-content/uploads/2025/12/OKZ.zw-2025-Annual-Report.pdf | Bon Marché is a premium multi-branch supermarket identity; 2025 report identifies affected locations |
| SPAR International Zimbabwe profile: https://spar-international.com/country/zimbabwe/ | Established Zimbabwe retailer, franchise/branch-level verification still required |
| Food Lover's Market Greendale official store: https://foodloversmarket.co.za/stores/zimbabwe/food-lovers-market-greendale/ | Greendale listing should not inherit the Harare Borrowdale/Avondale closure warning |
| OK Zimbabwe corporate closure announcement: https://okziminvestor.com/ok-zimbabwe-announcement-of-closure-of-food-lovers-market-stores/ | Reported closure of Borrowdale and Avondale stores effective June 2025; review specific listings |
| 4 March 2026 Manica Post report: https://www.heraldonline.co.zw/tm-pick-n-pay-shuts-chikanga-dangamvura-branches/ | Reported closure of Chikanga and Dangamvura TM Pick n Pay branches in Mutare, not the chain nationwide |

## Next verification requirements

1. Confirm precise branch identity against normalized OSM/shop records and check current operating status. Research reports can become stale.
2. Validate independent grocery, informal-market, and premium-retailer relevance through merchant inputs, editorial checks and opted-in real user engagement. Never assign fake reviews.
3. Measure click-through and saved/return engagement by service and category, with privacy-safe, low-volume aggregation and fair exploration opportunities.
4. Add operator tools to audit and override editorial signals with cited reasons and expiry dates; permit business correction and appeal.
5. Validate shopper product categories against actually published offers. Canonical product identities may remain searchable without any seller.
6. Test 360px/390px/768px and desktop light/dark, guest/role access, search filters and disabled service states before any release. The original PR remains a draft.

## Limitations

This pilot is a deterministic, source-linked category/rank layer, not a full review platform or machine-learned recommendation system. It does not recrawl websites or auto-update business status. Existing source/image licenses and verified commerce gates remain authoritative. Production rollout requires explicit owner authorization.

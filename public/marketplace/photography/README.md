# Spotly business photography

A collection of 97 original, photorealistic illustrative subjects created for Spotly on 31 October 2026 with the built-in image-generation workflow.

These images identify business categories. They are not photographs of the named business, its actual premises, staff, stock or menu. Customer-facing covers are marked **Illustrative photo**; smaller thumbnails have descriptive alternative text. Approved merchant-owned and licensed location-matched photographs take precedence.

Every subject has 320px, 768px and 1536px WebP exports. Responsive images are lazy-loaded in lists, while business-profile covers load eagerly. Images are bundled and served as static files, with no runtime generation, image-search API, extra Firebase query or live third-party stock-photo dependency.

The shared selector uses structured amenity, shop, tourism, craft, leisure and office data before name clues. Food identities are refined only after identifying a food business. The same business retains its subject across lists, details, search, Saved and pagination. A picture is never removed because another business shares its category.

The shared image component reserves its container, fills its full width, uses object-cover cropping and recovers from a failed merchant photograph with the matching local subject. Logos are not used as photographic covers.

Source art direction and per-subject briefs are recorded in `docs/BUSINESS-PHOTOGRAPHY-PROMPTS.md`. Selection, provenance, complete dataset coverage, shipped assets and transfer budgets are checked in `tests/business-photography.test.mjs`.

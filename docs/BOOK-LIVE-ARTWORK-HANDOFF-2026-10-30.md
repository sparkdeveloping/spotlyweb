# Book + Live illustration release

**Status:** All four transparent WebP files are integrated. The former upload blocker is resolved. Require a passing Vercel preview build and review before merging.

## What is already changed
- Book fallback icon is now a calendar with a clock, not generic sparkles.
- Live fallback icon is now a ticket, not a calendar.
- Home service descriptions distinguish appointments from events. Service routes and capabilities are unchanged.
- A file-hash test records the actual optimized encodings of the selected new renders and prevents shipping the old 3D images.

## Integrated files
The following existing paths in `public/experience/services/` on `feat/spotly-book-live-artwork-20261030` now contain the new artwork:

- `book-320.webp`
- `book-640.webp`
- `live-320.webp`
- `live-640.webp`

Book now shows a violet appointment calendar, highlighted check and analog clock. Live shows a pink admission ticket, microphone and spotlights. The built-in image-generated renders retain the existing 3D material family, with true alpha transparency. Approved logos remain separate. The images use the existing 320/640 WebP asset contract, with no new dependencies or external fetch. The Live 640 export is 78,986 bytes, below the 80,000-byte cap; each compact image is below 30,000 bytes. Original PNGs remain unchanged.

## Verification
1. Keep all four image replacements **on this PR's feature branch**, never directly on `main`.
2. Ensure Vercel runs **all prebuild checks and production-style Next.js preview build** successfully.
3. Review Home cards on desktop and mobile at light/dark appearance, including their 3D edges/transparency and text overlap.
4. Inspect Book and Live service entrances and all six service illustrations together for material/lighting consistency.
5. Verify no transactions, service enablement, routes or profile permissions changed.
6. Merge only after the user approves the preview. Vercel will deploy automatically when merged into `main`.

The asset SHA256 gate now matches the integrated image encodings. This artwork integration does not change transactions, service availability, routes, profile permissions, taxonomy or ranking. No production changes are authorized by this draft.

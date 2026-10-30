# Book + Live illustration release

**Status:** Awaiting upload of four approved static WebP files. This draft PR must remain unmerged until they are present and the Vercel preview build passes.

## What is already changed
- Book fallback icon is now a calendar with a clock, not generic sparkles.
- Live fallback icon is now a ticket, not a calendar.
- Home service descriptions distinguish appointments from events. Service routes and capabilities are unchanged.
- A file-hash test prevents approving this PR if only those code changes ship and the old 3D images remain.

## Required files
Upload the contents of **Spotly_Book_Live_GitHub_Ready.zip** into the exact GitHub directory `public/experience/services/` on `feat/spotly-book-live-artwork-20261030`, **replacing** these existing files:

- `book-320.webp`
- `book-640.webp`
- `live-320.webp`
- `live-640.webp`

The ZIP is provided in the conversation, not stored in the repository. The images use an existing 320/640 WebP asset contract, no new dependencies or external fetch. The Live 640 image was recompressed below the 80 kB cap. Image credits and permission remain owner-provided.

## Verification
1. Commit all four image replacements **to this PR's feature branch**, never directly to `main`.
2. Ensure Vercel runs **all prebuild checks and production-style Next.js preview build** successfully.
3. Review Home cards on desktop and mobile at light/dark appearance, including their 3D edges/transparency and text overlap.
4. Inspect Book and Live service entrances and all six service illustrations together for material/lighting consistency.
5. Verify no transactions, service enablement, routes or profile permissions changed.
6. Merge only after the user approves the preview. Vercel will deploy automatically when merged into `main`.

The asset SHA256 gate intentionally fails until images are in GitHub. No production changes are authorized by creating this draft.

# Clean deployment instructions

This archive is root-ready: `package.json`, `app/`, `components/`, and `public/` are at the archive root.

For Vercel, deploy this directory as the project root.

The old legacy component filenames are intentionally included as compile-safe stubs. This makes the package safe even if files are merged over an older Spotly web tree instead of replacing it cleanly.

The current page only uses `components/SpotlyWebShowcase.tsx`.

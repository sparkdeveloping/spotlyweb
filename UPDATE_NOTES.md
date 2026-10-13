# Spotly Web 2.0 — Build-Fix v3

This package is the cleaned production source for the updated Spotly 2.0 web direction.

## Build fixes in v3

- Replaced path-alias imports with relative imports for the new production files.
- Removed obsolete legacy React components that were no longer imported by the rebuilt landing page but were still included in TypeScript project checking.
- Removed obsolete `data/site.ts`, which only supported the retired landing-page components.
- The live source surface is now intentionally small:
  - `app/page.tsx`
  - `app/layout.tsx`
  - `components/SpotlyWebShowcase.tsx`
  - route support files and public assets
- Kept `tsconfig.json` in the package.

## Updated experience

- Spotly 2.0 landing page
- Product story for Ride, Eat, Shop, Book, Events, Send
- Interactive service-mode showcase
- Customer app preview artwork
- Updated metadata for `spotlyafrica.com`

## Deployment

Set the Vercel root directory to the `web` folder (the folder containing `package.json`).

Run:

```bash
npm ci
npm run build
```

# Spotly Web Update Notes

## Build-fix revision

This revision removes `@/...` path-alias imports from the source files and uses explicit relative imports instead. This prevents deployment environments from failing to resolve `@/components/SpotlyWebShowcase` when TypeScript configuration is regenerated or the project is deployed from a different root.

For Vercel, set the project root to the folder containing `package.json` (the `web` folder if deploying this archive as part of a larger repository).

## Spotly 2.0 changes

- Rebuilt landing page around the Spotly 2.0 product story.
- Added an interactive service showcase for Ride, Eat, Shop, Book, Events, and Send.
- Added customer prototype preview imagery in `/public`.
- Updated metadata to use `spotlyafrica.com` and Spotly violet.

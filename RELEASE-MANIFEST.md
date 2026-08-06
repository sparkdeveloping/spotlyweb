# Spotly Business Experience v4 release manifest

Generated: August 5, 2026  
Project: `spotly-web-platform`  
Version: `4.0.0`  
Runtime: Next.js 16, JavaScript, React 19, Tailwind CSS 4, Framer Motion, Firebase

## Release contents

- 98 source/data/script files
- 97 JavaScript, JSX, or MJS modules
- Approximately 11,780 lines across application source, shared components, libraries, data, and scripts
- Guided business setup and adaptive workspaces
- Correct organization → business brand → exact location hierarchy
- Grocery/retail, restaurant/food, ticketing/events, appointments/services, accommodation/activities, and profile-only models
- Branch-scoped access, adaptive catalogue/activity/finance/insights, shared-device kiosk modes, admin migration, and customer directory synchronization
- Firebase Auth, Firestore, Storage, Analytics, Messaging preparation, route handlers, indexes, and rules
- Vercel configuration and Firebase Admin/Jose compatibility override

## Validation completed in the generation environment

- `node scripts/check-javascript.mjs` passed
- ESLint passed with zero errors and zero warnings
- JavaScript-only source check passed
- No TypeScript source files are included
- JSON configuration parsing passed
- No TODO/FIXME markers, dead `href="#"` links, or empty click handlers were found in application source
- No Firebase service-account JSON, PEM/P12 key, or internal OpenAI registry reference is included

## Build note

A full Linux `next build` could not complete in the generation container because its installed dependencies were produced for macOS and the restricted package registry could not supply the matching Linux SWC binary. The owner previously completed a successful build on macOS with the same dependency family. Run `npm install` followed by `npm run check` locally and in a Vercel Preview deployment.

## Required post-deployment action

1. Back up/export the current Firestore data.
2. Sign in as Super Administrator.
3. Open `/admin/businesses`.
4. Select **Upgrade / refresh directory**.
5. Wait for directory version 4 to complete.
6. Review brand counts, location counts, claims, memberships, and archived legacy records before onboarding businesses.

## Release exclusions

The archive intentionally excludes:

- `.git`
- `.next`
- `node_modules`
- `.env.local` and other private environment files
- service-account JSON and private keys
- macOS metadata

# Build and validation report

Generated: August 5, 2026
Release: 4.0.0

## Completed checks

- JavaScript and JSX parse validation passed across the application, route handlers, components, libraries, data, and scripts
- ESLint passed with zero errors and zero warnings
- JavaScript-only project check passed
- No `.ts`, `.tsx`, `.mts`, or `.cts` source files are included
- JSON configuration files parsed successfully
- Local `@/` imports resolve to matching source files
- Firebase route, rules, indexes, Storage, and Vercel configuration files are included
- Firebase Admin/Jose ESM compatibility override remains in `package.json` and `package-lock.json`
- No OpenAI internal npm-registry URLs are included
- Service account JSON, private environment files, `.next`, `.git`, `node_modules`, and macOS metadata are excluded from the release archive

## Production-build limitation in the generation environment

The source compilation command reached Next.js, but the Linux generation container did not contain the matching `@next/swc-linux-x64-gnu` package. Next.js attempted to download it through the restricted package gateway, which returned 404. The project itself previously built successfully on the owner’s Mac after a normal `npm install`.

Run the following after extracting the archive:

```bash
npm install
npm run check
```

Run the same commands in a Vercel Preview deployment before promoting Production.

## Required release tests

- Directory version 4 migration on a backup or non-production copy first
- Brand/location count and relationship verification
- Existing owner, membership, and claim migration
- New business guided setup from start to completion
- Save-and-leave and resume behavior
- Role and location-scoped team access
- Grocery, food, ticket, appointment, booking, and profile-only navigation
- Catalogue templates, imports, images, and branch assignment
- Activity state transitions and duplicate submission protection
- Kiosk arrival/check-in on a shared device
- Firebase Auth and linked-provider behavior
- Firestore and Storage rules in the Emulator Suite
- Paynow amount, callback, retry, and settlement behavior
- Public directory and private-beta controls
- Mobile, tablet, desktop, keyboard, screen-reader, reduced-motion, and browser coverage
- Network loss, retries, offline behavior, backups, restore, monitoring, and rollback

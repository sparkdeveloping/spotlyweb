# Build and validation report

Generated: August 5, 2026

## Completed checks

- JavaScript and JSX parse validation completed across 97 `.js` and `.mjs` source files
- JavaScript-only project check passed
- No `.ts`, `.tsx`, `.mts`, or `.cts` source files included
- JSON configuration files parsed successfully
- Local `@/` imports checked for matching source files
- Firebase route, rule, index, Storage, and Vercel configuration files included
- No OpenAI internal npm registry URLs included
- `.next`, `.git`, `node_modules`, macOS metadata, and stale build-verification files excluded from the final archive

## Build limitation in the generation environment

The generation container could not resolve the public npm registry, so it could not perform a fresh `npm install`, ESLint run, or production `next build` with the updated dependencies.

This archive therefore does not claim a verified production build. Run:

```bash
npm install
npm run check:js
npm run lint
npm run build
```

on the developer Mac and in Vercel Preview. Resolve any environment-specific dependency, lint, or Next.js diagnostics before production promotion.

## Important release tests

- Authentication and account-linking providers
- Anonymous-to-email account upgrade
- Role and custom-permission enforcement
- Firestore and Storage rules in emulator
- Business organization/branch isolation
- Claim evidence privacy
- Server order total calculation
- Paynow amount and callback verification
- Notification token ownership and invalidation
- Support internal-note visibility
- Admin support-view audit records
- Mobile, tablet, desktop, keyboard, screen reader, and browser coverage
- Network loss, retries, duplicate submissions, and offline behavior
- Backup, restore, monitoring, and rollback

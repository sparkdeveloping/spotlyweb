# Build and validation report

Generated: August 6, 2026  
Release: `5.0.0`

## Completed checks

- JavaScript and JSX parser-transpile validation across application pages, route handlers, components, libraries, data, and scripts
- Local relative and `@/` import resolution
- JavaScript-only project check through `node scripts/check-javascript.mjs`
- No `.ts`, `.tsx`, `.mts`, or `.cts` source files
- JSON configuration parsing
- Source scan for unresolved local modules

## Dependency-install limitation

The generation environment did not contain a usable dependency tree. A clean `npm install` attempted to use the restricted package gateway, which returned a 404 for the transitive package `zod-validation-error-4.0.2`. Because dependencies could not be installed, ESLint and the production Next.js build were not run here.

Run the complete release gate after extraction:

```bash
npm install
npm run check
```

Then test production rules and role boundaries in the Firebase Emulator Suite before deployment.

## Required functional validation

- `/staff` route access and portal switching
- Role-adaptive Today queue for each staff role
- Task, shift, leave, learning, performance, pay, asset, support, and profile flows
- Manager-only team and hiring controls
- People Operations employee, candidate, role-pack, and offboarding workflows
- Payroll and sensitive-field isolation
- Organization → brand → location governance
- Parent-company branch approval and inherited policy behavior
- Platform-map relationship and diagnostic links
- Existing business, driver, customer, admin, support, notification, payment, and directory regressions
- Mobile, tablet, desktop, keyboard, screen-reader, reduced-motion, offline, and low-bandwidth coverage

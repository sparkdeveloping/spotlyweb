# Spotly Platform v5 release manifest

Generated: August 6, 2026  
Project: `spotly-web-platform`  
Version: `5.0.0`  
Runtime: Next.js 16, JavaScript, React 19, Tailwind CSS 4, Framer Motion, Firebase

## Release contents

- Unified customer, business, driver, staff, and administrator applications
- Complete `/staff` workforce workspace
- Administrator People Operations centre
- Organization, brand, and location governance
- Interactive platform and workforce maps
- Role packs, scoped access, approval limits, and role-adaptive queues
- Recruitment, shifts, leave, learning, performance, payroll preparation, assets, support, and offboarding data models
- Updated Firestore and Storage security rules
- Updated production seed data and portal configuration
- Existing adaptive merchant operations, marketplace, support, notifications, payments, and driver foundations

## Validation completed in the generation environment

- JavaScript/JSX parser-transpile validation passed across source modules
- Local relative and `@/` import resolution passed
- JavaScript-only source check passed
- JSON configuration parsing passed
- No TypeScript source files are included

## Validation not completed in the generation environment

A clean dependency installation, ESLint run, production Next.js build, and Firebase Emulator rules test could not be completed because the restricted package gateway returned a 404 for a transitive package. These checks must be run after extraction:

```bash
npm install
npm run check
npm run firebase:emulators
```

## Required production checks

- Least-privilege testing for every staff role pack
- Employee self-service versus manager visibility
- People Operations access to sensitive profile sections
- Payroll and document isolation
- Recruitment and candidate consent workflows
- Attendance, leave, and approval chains
- Temporary support access and automatic expiry
- Organization/brand/location governance and parent approvals
- Business, driver, customer, payment, and support regression tests
- Mobile, keyboard, screen-reader, reduced-motion, offline, and low-bandwidth behavior

## Archive exclusions

- `.git`
- `.next`
- `node_modules`
- `.env.local` and private environment files
- Service-account JSON and private keys
- macOS metadata

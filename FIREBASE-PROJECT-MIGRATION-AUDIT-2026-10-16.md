# Spotly Africa Firebase Project Migration Audit

**Date:** 16 October 2026  
**New Firebase project:** `spotly-africa`  
**Web App ID:** `1:14197555543:web:189486e7d4a23114c3be12`  
**Storage bucket:** `spotly-africa.firebasestorage.app`  
**Analytics measurement ID:** `G-4FPTS9GNG9`

## Executive result

The Next.js source has been migrated to the new `spotly-africa` Firebase Web App identity. The old project was previously present in multiple independent integration points, which could have produced a split-brain system if only the browser config were changed. The source now has one canonical public project identity, a Firebase CLI default project, a new-project messaging service worker, Admin/client project mismatch guards, and a preflight command that runs before development/build.

The web configuration alone is **not enough to complete a production Firebase project migration**. Firebase Admin credentials, Auth providers/domains, Cloud Messaging Web Push, App Check, Firestore/Storage deployment, and any existing production data/users/files must be configured or migrated separately.

## Code changes completed

- Added `lib/firebase-project-config.js` as the canonical Spotly Firebase Web App identity.
- Updated `lib/firebase.js` to use the new Firebase Web App values and reject a different project ID.
- Updated `lib/firebase-admin.js` to reject client/Admin cross-project mismatches and default Storage to the new bucket.
- Updated `public/firebase-messaging-sw.js` to the new Firebase project and aligned the compat SDK version with the installed Firebase JS SDK.
- Updated the Firestore seed script fallback from the former project to `spotly-africa`.
- Added `.firebaserc` with `spotly-africa` as the Firebase CLI default project.
- Expanded `.env.example` with the new public Firebase values plus explicit new-project Admin, VAPID and App Check placeholders.
- Added `scripts/firebase-project-preflight.mjs` and wired it into `npm run dev`, `npm run build`, and the full `npm run check` pipeline.
- Added Firebase project regression tests.
- Updated Admin Launch Readiness to report Firebase project alignment and the expected Storage bucket.
- Removed stale `.next` output so compiled code from the previous project cannot be accidentally reused.
- Removed accidental TypeScript scaffolding that conflicts with this repository's JavaScript-only validation policy.

## Firebase Console actions still required

### 1. Create/configure Firestore in `spotly-africa`

The Web App config does not confirm that a Firestore database exists, which database location was selected, or whether it is empty. The current Spotly client/Admin code uses Firebase's **default Firestore database** (`(default)`), so the production database in `spotly-africa` must be the default database unless Spotly is deliberately changed to target a named database. Create/verify that database before switching production traffic.

Then deploy the repository's Firestore rules and indexes to the **new project**. The current source contains 59 composite index definitions and a large production ruleset. The new `.firebaserc` makes the CLI target `spotly-africa` by default, but deployment is intentionally not performed by this code update.

Recommended release commands after Firebase CLI authentication:

```bash
npm run firebase:deploy:indexes
npm run firebase:deploy:rules
```

Run the emulator security suite before/after the deployment verification process:

```bash
npm run test:rules
```

### 2. Configure Firebase Storage

Verify `spotly-africa.firebasestorage.app` exists and deploy `storage.rules`. Existing files in another Firebase project do not move when the Web App config changes.

Spotly uses Storage for operational/customer content including private evidence and proof uploads, so an empty new bucket can make existing database records point at files that no longer exist unless data is migrated coherently.

### 3. Create NEW Firebase Admin credentials

The supplied Web App config cannot initialize the server-side Firebase Admin SDK.

Create a service account for the **`spotly-africa` project** and configure the deployment with:

```text
FIREBASE_ADMIN_PROJECT_ID=spotly-africa
FIREBASE_ADMIN_CLIENT_EMAIL=<new spotly-africa service account email>
FIREBASE_ADMIN_PRIVATE_KEY=<new private key>
```

Do **not** reuse the former project's Admin email/private key. The application now rejects mismatched Admin/client project IDs, and the local old credential was removed from the working migration configuration.

### 4. Firebase Authentication

Enable the authentication methods Spotly actually uses in the new project. The source currently supports:

- email/password;
- Google account linking/sign-in;
- Apple account linking/sign-in;
- phone linking/verification.

Authorize these hostnames in Firebase Authentication:

```text
spotlyafrica.com
www.spotlyafrica.com
business.spotlyafrica.com
admin.spotlyafrica.com
driver.spotlyafrica.com
staff.spotlyafrica.com
careers.spotlyafrica.com
localhost
```

OAuth/Apple provider credentials and redirect configuration are project-specific and must be configured again for the new Firebase project.

### 5. Existing Auth users do not automatically move

If the former Firebase project contains real users, changing to `spotly-africa` makes those accounts unknown to the new Auth tenant unless they are migrated/imported.

This is especially important because Spotly's shared subdomain session bridge ultimately verifies Firebase ID tokens and mints Firebase custom tokens. Old-project ID tokens/custom tokens are not interchangeable with the new project.

Before production cutover choose one deliberate path:

1. **Migrate Firebase Auth users** using Firebase-supported export/import, preserving password hashes where supported; or
2. require a controlled account re-registration/reset process and reconcile identities deliberately.

Do not switch production Auth projects without deciding this first.

### 6. Firestore production data does not automatically move

The project contains broad platform state across roughly 100 collection names in application/server code: users, businesses, marketplace content, orders, bookings, Ride, Send, deliveries, Driver operations, staff/hiring, finance ledgers, notifications, platform settings, support, and more.

If `spotly-africa` is genuinely a new empty project, the application will start against an empty database even though the code is correct.

A production cutover therefore needs either:

- an explicit source → target Firestore migration; or
- confirmation that the new project is intentionally starting clean.

Migration must preserve document IDs/references and should be coordinated with Auth user migration because many documents are keyed by Firebase UID.

### 7. Firebase Storage objects do not automatically move

If Firestore records are migrated, any referenced Storage objects must also be copied to the new bucket with the corresponding paths/metadata required by Spotly.

This includes private Driver/Careers/Business evidence and operational proof files. Do not migrate public database references without their backing objects.

### 8. Cloud Messaging / Web Push

The new project has a different sender ID (`14197555543`). Existing browser FCM tokens from the former project must be treated as stale and should not be copied as valid push destinations.

In Firebase Console → Cloud Messaging, create/use the new project's Web Push certificate and configure:

```text
NEXT_PUBLIC_FIREBASE_VAPID_KEY=<new spotly-africa VAPID public key>
```

Users should re-enable/register push so Spotly stores fresh tokens issued by the new project.

### 9. Firebase App Check

If App Check is to be enforced, configure a reCAPTCHA Enterprise site key for the new project and production domains, then configure:

```text
NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY=<new site key>
SPOTLY_ENFORCE_APP_CHECK=true
```

Do not turn enforcement on until all production origins and supported clients can successfully obtain App Check tokens.

### 10. Analytics

The source now uses `G-4FPTS9GNG9` as the default measurement ID. Verify the Firebase/Google Analytics property linkage in the new project and confirm events appear from production after deployment.

### 11. Vercel environment must be updated before deployment

The existing production Vercel project may still contain old `NEXT_PUBLIC_FIREBASE_*` and `FIREBASE_ADMIN_*` environment variables. Environment variables override source fallbacks.

The new preflight deliberately fails if the public/Admin project IDs do not point to `spotly-africa`, preventing a silent cross-project release. Update Vercel variables before building/deploying.

At minimum production needs the new values from `.env.example`, plus the new Admin credentials. Push/App Check require their new-project keys as described above.

### 12. Do not migrate these values as if they were normal data

- old FCM browser tokens — regenerate;
- old App Check tokens — regenerate;
- Firebase ID/session tokens from the old project — expire/re-authenticate;
- old Admin private key — do not reuse;
- old Firebase Web Push VAPID configuration — replace with the new project's configuration;
- compiled `.next` output from before the migration — rebuild from clean source.

## Cutover order

1. Create/verify Firestore + Storage in `spotly-africa`.
2. Configure Auth providers and authorized domains.
3. Create new Firebase Admin service-account credentials.
4. Configure Web Push VAPID and App Check if required.
5. Decide whether existing Auth/Firestore/Storage production data is migrating or the new project is intentionally clean.
6. If migrating, migrate Auth identities first/planned together with UID-keyed data, Firestore records, then Storage objects; validate referential integrity.
7. Deploy Firestore indexes/rules and Storage rules to `spotly-africa`.
8. Update Vercel Firebase environment variables.
9. Run `npm run firebase:preflight` and the complete project validation/build.
10. Test email/password, Google, Apple and phone flows from every production hostname that uses Auth.
11. Test uploads/downloads, server APIs, session bridging, push registration, App Check, Driver evidence, Careers CVs, Business media and transaction flows.
12. Only then cut production traffic to the new Firebase project.

## Important migration principle

**Changing the Firebase Web App config changes where new browser operations go. It does not migrate Spotly's users, data, files, permissions or server credentials.** The code update is now safe for the new project identity; production continuity depends on the Console/deployment/data steps above.

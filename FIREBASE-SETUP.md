# Firebase setup

Project: `denzeltinashe-spotly`

## 1. Web application configuration

The public web identifiers are already represented in `.env.example`. Copy them to `.env.local` for local development and to the Vercel project environment.

## 2. Authentication providers

In Firebase Console → Authentication → Sign-in method, enable:

- Email/Password
- Google
- Apple
- Phone
- Anonymous

Email/password is the primary Spotly credential. The interface links Google, Apple, and phone to an existing signed-in account.

Add local and deployed domains under Authentication → Settings → Authorized domains:

- `localhost`
- Vercel preview domain
- Production Vercel domain
- Final custom domain

Apple additionally requires an Apple Developer Services ID, redirect URL, team ID, key ID, and private key configured according to Firebase's Apple provider instructions.

## 3. Firestore

Create the Firestore database in a region selected for Spotly's operational, latency, legal, and cost requirements.

Development-only open rules:

```bash
firebase deploy --only firestore:rules --config firebase.json
```

The repository's `firebase.json` points to production draft rules by default. To use test rules locally, configure the Emulator Suite rather than deploying them publicly.

Deploy indexes:

```bash
npm run firebase:deploy:indexes
```

## 4. Storage

Create the default Storage bucket and confirm the bucket name matches:

```env
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=denzeltinashe-spotly.firebasestorage.app
```

Production draft paths cover public business media, catalogues, verification evidence, user files, and support attachments. Test all roles and upload constraints before production deployment.

## 5. Firebase Admin SDK

Create a service account for the Vercel server environment. Add these variables to Vercel; never expose them with `NEXT_PUBLIC_`:

```env
FIREBASE_ADMIN_PROJECT_ID=denzeltinashe-spotly
FIREBASE_ADMIN_CLIENT_EMAIL=...
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

The private key must preserve escaped newline characters in Vercel.

The Admin SDK is used for protected server operations such as:

- First-admin bootstrap
- Platform seed import
- Server-validated order creation
- Paynow records and callbacks
- Push delivery
- Transactional email logging
- Audited administrator support view

## 6. First super administrator

Add the same founder email to:

```env
BOOTSTRAP_ADMIN_EMAILS=founder@example.com
```

Create the email/password account, open `/admin`, and use the one-time bootstrap action. Once a super administrator exists, the server refuses to bootstrap a different user. Remove the bootstrap values afterward.

## 7. Analytics

Analytics initializes only in supported browsers. The measurement ID is already represented in `.env.example`.

Meaningful events are logged for authentication, claims, support, business operations, and marketplace behavior where implemented. Final reporting definitions should be approved before pilot measurement.

## 8. Cloud Messaging

Create a Web Push certificate in Firebase Console → Project settings → Cloud Messaging. Add the public key:

```env
NEXT_PUBLIC_FIREBASE_VAPID_KEY=...
```

The project includes `/public/firebase-messaging-sw.js`. Verify notifications on supported HTTPS deployments and test token invalidation.

## 9. App Check

Register the web app with reCAPTCHA Enterprise and add:

```env
NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY=...
```

Enable enforcement only after Preview and pilot traffic confirms all expected clients receive valid tokens.

## 10. Emulator Suite

Install Firebase CLI or use `npx firebase-tools`:

```bash
npm run firebase:emulators
```

Use emulators to test:

- Anonymous support chat
- Customer data isolation
- Organization and branch access
- Business owners and staff permissions
- Claim applicant and reviewer access
- Admin roles and custom permissions
- Support internal-note visibility
- Order read/update boundaries
- Notification and push-token ownership
- Verification-document storage isolation
- Audit log immutability

## 11. Production rule deployment

Only after tests pass:

```bash
npm run firebase:deploy:rules
```

Keep backups and a rollback copy of the previous rules. Do not deploy `firestore.test.rules` or `storage.test.rules` to a public production project.

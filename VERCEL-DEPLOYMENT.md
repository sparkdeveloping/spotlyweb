# Vercel deployment

## 1. Prepare the repository

```bash
npm install
npm run check:js
npm run lint
npm run build
```

Commit the generated `package-lock.json` after a successful local install so Vercel receives a reproducible dependency graph.

## 2. Import into Vercel

- Framework preset: Next.js
- Node.js: 22.x
- Install command: `npm install`
- Build command: `npm run build`
- Output: automatic Next.js output

`vercel.json` is included with server-route duration settings.

## 3. Add environment variables

Add all public Firebase values and required server credentials from `.env.example`.

Configure values separately for Development, Preview, and Production. At minimum:

- `NEXT_PUBLIC_APP_URL`
- Firebase Web variables
- Firebase Admin variables
- `BOOTSTRAP_ADMIN_EMAILS` during first setup
- Paynow values when payments are tested
- Resend values when transactional email is tested
- VAPID and App Check values when notifications/security are tested

Never add private keys or payment secrets to any `NEXT_PUBLIC_` variable or Firestore platform settings.

## 4. Firebase domain authorization

After the first Preview deployment, add the Preview/Production domains to Firebase Authentication authorized domains. Configure provider-specific redirect URLs for Google and Apple.

## 5. Preview verification

Verify:

- `/`
- `/login`
- `/claim`
- `/support`
- `/marketplace`
- `/business`
- `/admin`
- `/devstatus`
- `/account`
- `/payment/return`

Then test:

- Email/password registration, verification, login, reset, and logout
- Anonymous support session upgraded to email/password
- Google, Apple, and phone linking
- First-admin bootstrap
- Seed import
- Business claim and evidence upload
- Branch/product/staff/finance saves
- Customer cart and server-created order
- Paynow sandbox initiation, return, result callback, and polling
- Push token registration and admin delivery
- Resend transactional email
- Support chat and audited support view
- Firestore/Storage permission-denied behavior for unauthorized roles

## 6. Production promotion

Before Production:

- Use tested production rules
- Remove bootstrap variables
- Confirm all credentials use Production scope
- Set the final `NEXT_PUBLIC_APP_URL`
- Confirm custom domain and HTTPS
- Set error monitoring and uptime checks
- Verify backups/export procedure
- Approve legal content and support details
- Complete controlled pilot sign-off

## 7. Rollback

Keep the prior successful Vercel deployment available. If a release affects authentication, rules, ordering, payments, or business access:

1. Pause the affected feature through admin settings where possible.
2. Promote the last known-good Vercel deployment.
3. Restore the previous Firestore/Storage rules when required.
4. Record the incident and affected records.
5. Reconcile payment/provider state before reopening commerce.

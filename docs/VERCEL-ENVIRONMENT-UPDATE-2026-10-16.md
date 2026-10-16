# Vercel Environment Update — 16 October 2026

Project: `spotlyweb`
Vercel project ID: `prj_IkyQCtt8uvZrMLALWqnsfK50rXqy`
Firebase project: `spotly-africa`

The following Vercel variables were updated for **Production + Preview**:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`
- `FIREBASE_ADMIN_PROJECT_ID`

Still required before a new production deployment:

- `FIREBASE_ADMIN_CLIENT_EMAIL` from a service account in `spotly-africa`
- `FIREBASE_ADMIN_PRIVATE_KEY` from that same service account
- `NEXT_PUBLIC_FIREBASE_VAPID_KEY` if Web Push is enabled
- `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY` before App Check enforcement is enabled

Do not reuse Admin credentials, VAPID keys, or App Check keys from the former Firebase project.

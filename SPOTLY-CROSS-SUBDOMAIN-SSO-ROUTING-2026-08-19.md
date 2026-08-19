# Spotly cross-subdomain routing + single sign-on hardening

**Date:** 19 August 2026  
**Target:** `spotlyafrica.com`, `business.spotlyafrica.com`, `admin.spotlyafrica.com`, `driver.spotlyafrica.com`, `staff.spotlyafrica.com`

## What this release fixes

1. Workspace switching now uses the dedicated product hostnames directly instead of links such as `/business`, `/admin`, `/driver`, or `/staff` on the current hostname.
2. Product subdomains expose clean routes:
   - `business.spotlyafrica.com/`
   - `business.spotlyafrica.com/orders`
   - `admin.spotlyafrica.com/`
   - `driver.spotlyafrica.com/`
   - `staff.spotlyafrica.com/`
3. Legacy portal-prefixed links are still accepted from **any** Spotly hostname and canonicalized to the right product domain. This is an intentional compatibility safety net for old notifications, bookmarked links, email links, and less-frequently-used modules.
4. Customer/global destinations such as Account and Marketplace canonicalize back to `spotlyafrica.com` from product subdomains.
5. Product-specific `/support` routes remain local to the product subdomain; global Help links explicitly target `spotlyafrica.com/support`.
6. Product login requests are canonicalized to the relevant product hostname.
7. The Account workspace gateway links directly to each product hostname.
8. The top workspace switcher, Account menu, Workspace settings link, Driver marketing entry points, and public Business sign-in paths use the new domain architecture.

## One Spotly sign-in across all subdomains

Firebase Web Auth persists client state per browser origin, so a normal Firebase local-storage session on `business.spotlyafrica.com` is not directly readable by `admin.spotlyafrica.com`.

This release adds a secure bridge:

1. After a normal Firebase sign-in, the browser sends its Firebase ID token to `POST /api/auth/session`.
2. The server verifies the token using Firebase Admin and creates a seven-day Firebase session cookie.
3. In production the cookie is:
   - `HttpOnly`
   - `Secure`
   - `SameSite=Lax`
   - `Path=/`
   - `Domain=.spotlyafrica.com`
4. When a sibling product subdomain opens and its local Firebase client has no session, it calls `POST /api/auth/session/bootstrap`.
5. The server verifies the shared session cookie, confirms that the Spotly account is still active, and creates a short-lived Firebase custom token for that UID.
6. The sibling Firebase client calls `signInWithCustomToken`, restoring its normal local Firebase session without asking the person to enter credentials again.
7. Sign out clears the shared parent-domain cookie before signing out the local Firebase client.

The shared cookie is never used directly to access Firestore or Storage. Each product origin restores a normal Firebase client session first, so existing Firestore/Storage security rules and client code continue operating normally.

## Security hardening

- Session creation requires a valid Firebase ID token.
- Session bootstrap requires the HttpOnly session cookie.
- Session endpoints validate that requests originate from the Spotly domain family in production.
- Session responses use `Cache-Control: no-store`.
- Bootstrap validates Firebase session revocation and rejects suspended/disabled Spotly profiles.
- Invalid shared cookies are expired immediately.
- Login `next` destinations are restricted to safe relative URLs or the known Spotly domains, closing open-redirect behavior.
- No Firebase Admin secrets or tokens are exposed to the browser.

## Vercel status checked during this pass

The connected `spotlyweb` Vercel project currently lists all required production domains:

- `spotlyafrica.com`
- `www.spotlyafrica.com`
- `business.spotlyafrica.com`
- `admin.spotlyafrica.com`
- `driver.spotlyafrica.com`
- `staff.spotlyafrica.com`

The application intentionally does **not** decide whether apex or `www` is canonical. Keep that direction configured only once in Vercel Domains to avoid redirect loops.

## Firebase Console requirement

Add these domains to Firebase Authentication → Settings → Authorized domains if they are not already present:

- `spotlyafrica.com`
- `business.spotlyafrica.com`
- `admin.spotlyafrica.com`
- `driver.spotlyafrica.com`
- `staff.spotlyafrica.com`

This is especially important for provider popups, phone auth, email-action flows, and other browser authentication operations.

## Existing-session rollout behavior

People who are already signed in before this release do **not** need to deliberately sign out and back in. The first time an already-authenticated origin loads this release, it creates the shared Spotly session cookie. After that, switching to the sibling product domains should restore the account automatically.

If no Spotly origin has a valid existing Firebase session and no shared cookie exists, the normal sign-in screen is shown.

## Validation

- `npm test`: **160 / 160 passed**
- `npm run check:js`: **PASS**
- `npm run check:theme`: **PASS** — 155 source files / 24 route patterns
- JS/JSX TypeScript parser sweep: **228 / 228 passed**
- `node --check` passed for the proxy, domain utilities, shared-session server utility, and both new authentication route handlers.
- New regression coverage verifies domain routing, direct workspace URLs, shared session creation/bootstrap/logout, origin checks, secure cookie attributes, and safe login return targets.

## Files added

- `app/api/auth/session/route.js`
- `app/api/auth/session/bootstrap/route.js`
- `lib/shared-auth-session.js`
- `tests/cross-subdomain-auth-integrity.test.mjs`

## Important files updated

- `proxy.js`
- `lib/spotly-domains.js`
- `components/firebase-provider.js`
- `components/portal-shell.js`
- `components/account-app.js`
- `components/auth-gate.js`
- `components/login-app.js`
- `data/portals.js`
- `app/drive/page.js`
- `components/coming-soon-app.js`
- `tests/subdomain-routing-integrity.test.mjs`

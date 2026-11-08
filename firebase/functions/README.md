# Spotly Firebase Functions

Second-generation Cloud Functions for the canonical `spotly-africa` Firebase project.

- Runtime: Node.js 22
- `firebase-functions`: 7.4.0
- `firebase-admin`: 14.5.0
- Firebase CLI used by root deployment scripts: 15.35.0
- Region: `europe-west1`
- Contract: `contracts/spotly-contracts.v1.json` snapshot generated from the web root
- Entry point: `src/index.js`

## Local verification

From the Spotly Web repository root:

```bash
npm install --prefix firebase/functions --no-package-lock
npm --prefix firebase/functions run check
npm run test:emulator:platform
```

The emulator test uses a `demo-*` project only. It does not contact the production Firebase project.

## Deployment

```bash
npm run firebase:deploy:functions
```

or deploy the complete platform foundation:

```bash
npm run firebase:deploy:platform
```

Do not add payment, mail, API, or service-account secrets to `.env` files. Use Firebase/Google Secret Manager or parameterized configuration when a future function needs privileged provider credentials.

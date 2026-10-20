# Spotly: Vercel Firebase preflight build fix

**Failure:** `Firebase project preflight failed (1): .firebaserc is not pinned to the spotly-africa Firebase project.`

**Confirmed cause:** The `.firebaserc` file is absent from `sparkdeveloping/spotlyweb` commit `17fdef3` on `main`. This is a configuration file, not a Firebase Admin credential.

## Apply to the failing Vercel branch (`main`)

1. Unzip the archive and copy the **hidden** `.firebaserc` file into your `spotlyweb` repository's root, alongside `firebase.json` and `package.json`. On macOS Finder use **Command–Shift–.** to show hidden files. Do not place it inside a subfolder.
2. Run this in Terminal from the repository folder:

   ```bash
   npm run firebase:preflight
   git status --short
   git add .firebaserc
   git commit -m "fix: restore Firebase project pin for Vercel build"
   git push origin main
   ```

3. Inspect the next Vercel build: Firebase preflight should pass for `spotly-africa`. If another build error appears, address it separately; this patch targets only the reported preflight failure.

### Alternative: directly in GitHub

On `main`, click **Add file → Create new file**, name it `.firebaserc`, and paste exactly the contents from the included file. Commit to `main`. Vercel should then redeploy.

### Safety notes

- The project name `spotly-africa` is read from `scripts/firebase-project-preflight.mjs` in commit `17fdef3`. Do not change this ID or suppress the preflight merely to make a build pass.
- The `npm audit` messages and the Node 22 vs 24 warning are separate from this failure.
- This ZIP does **not** include application code, Firebase Admin private keys, passwords, or live data.
- No production changes occur until **you** commit/push the file.

# Spotly — Firebase Preflight Fix (20 October 2026)

Based on your uploaded repository at commit `6a84b74` (main).

## What changed

1. Added `spotlyweb/.firebaserc` with `projects.default` = `spotly-africa`.
2. Restored the original `spotlyweb/README.md` from the parent commit `17fdef3` (the uploaded README had been replaced with installation instructions).

## Apply to GitHub

**You must commit `.firebaserc` to `main`; uploading a ZIP to Vercel or changing README alone will not fix the build.**

If your working folder is already a Git checkout:

```bash
cp /path/to/unzipped/spotlyweb/.firebaserc /path/to/your/repo/.firebaserc
cp /path/to/unzipped/spotlyweb/README.md /path/to/your/repo/README.md
cd /path/to/your/repo
npm run firebase:preflight
git add .firebaserc README.md
git commit -m "fix: restore Firebase project pin and original README"
git push origin main
```

Alternatively, create `.firebaserc` in GitHub on `main`, pasting the following exact JSON:

```json
{
  "projects": {
    "default": "spotly-africa"
  }
}
```

Verify that https://github.com/sparkdeveloping/spotlyweb/blob/main/.firebaserc renders the file. The next Vercel build should then pass the previously failing check.

## What was excluded from the corrected full-source ZIP

Excluded `.env.local` (may hold private keys or passwords), `.git/` history, `.next/` build caches, `__MACOSX/` metadata, and `.DS_Store`.

The package does NOT include or change Firebase credentials and does NOT merge the unfinished V9 feature branch. Running the preflight locally verifies the reported error is fixed; a full Vercel/Next.js build may still reveal unrelated errors.

The uploaded repo also has a broad `*.json` ignore rule in `.gitignore`, which may affect other new JSON files. `.firebaserc` itself does **not** end with `.json` and is not blocked by that rule.

# Give Spotly distinct service worlds and a coherent customer experience

Home and service entrances relied on sparse tiles, small logo badges and repeated generic photography. This change adds a coherent illustration family, task-first entrances, useful search/availability states, floating navigation, accessible appearance controls and shared presentation primitives. Discovery/detail grids stay constrained on narrow screens, and headings are clear of fallback-cover text.

Use the owner-supplied dark SVGs on dark surfaces, shorten names only on Home's six service cards, and remove Careers' white wash/pill and placeholder logo. Preserve transaction, authentication, dispatch, permission, data and launch behavior. No commercial font files are added.

- Preview: https://spotlyweb-mlmpr1r7d-sparkdevelopings-projects.vercel.app/marketplace
- Careers: https://spotlyweb-mlmpr1r7d-sparkdevelopings-projects.vercel.app/careers
- Tested runtime: `0f99f56430ac54fe0c71fe147144f414a3e4f39e`
- Vercel build READY; 113 prebuild checks and JavaScript checks pass.
- Full suite: 523/540 pass; all 17 failures exist on baseline. Lint: 43 errors/31 warnings, down from 69/32. Theme/launch findings remain in the verification report.
- Final screenshots: Home desktop light/dark, Bite mobile light/dark, Careers desktop dark. Public discovery, search/empty states and guest gates were also checked across branch previews.

Keep this PR as a draft. Final 360px/768px browser checks were interrupted by loss of connectivity; authenticated roles, transactions and measured performance remain unverified. Production is unchanged. Do not merge/promote without the remaining checks and separate production approval.

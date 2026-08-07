# Spotly Fixed-Color Exception Inventory

Adaptive source has no `bg-white` use and no fixed gray/slate palette utilities. Remaining `text-white` or hardcoded dark colors are restricted to reviewed inverse surfaces.

| File | Exception | Reason | Safety rule |
|---|---|---|---|
| `components/login-app.js` | `#17152a` desktop identity panel and white/muted-white text | Deliberate fixed inverse marketing panel inside an adaptive login page | Panel owns its dark background and all white foregrounds; interactive form remains semantic |
| `components/coming-soon-app.js` | `#171329` business-owner band and white/muted-white text | Deliberate fixed inverse public marketing band | All text is contained by the dark band; adaptive forms inside use semantic surfaces |
| `components/business/no-business.js` | Emerald dark gradient and white/muted-white text | Deliberate Business onboarding hero | Foreground is contained by the gradient; actions use reviewed inverse/semantic button classes |
| `components/business/shared.js` | `#071b13` full-screen success/processing operation | Deliberate full-screen inverse operational state | Entire overlay owns a dark background and white foreground |
| `components/business/kiosk.js` | Fixed emerald dark gradient, `#0d6a42`, white/muted-white text | `/business/kiosk/live` is intentionally fixed dark for a shared customer-facing device | Route is classified fixed dark; light/dark preference does not create hybrid surfaces |

## Enforcement

`scripts/theme-safety.mjs` fails if `text-white` is introduced outside these reviewed files. It also fails for any `bg-white`, fixed gray/slate palette, inline route accent override, or malformed semantic utility.

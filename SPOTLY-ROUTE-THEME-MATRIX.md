# Spotly Route Theme Matrix

All normal routes are light/dark adaptive. The shared-device kiosk is the only fixed-dark route.

| Route pattern | Policy | Theme boundary | Accent source | Purpose | QA state |
|---|---|---|---|---|---|
| `/` | Adaptive | Root semantic tokens | Root purple | Public launch page | Static source QA passed; browser visual QA pending |
| `/login` | Adaptive | Root semantic tokens; inverse desktop panel | Root purple | Authentication | Static source QA passed; browser visual QA pending |
| `/support` | Adaptive | Root semantic tokens | Root purple | Public/account support | Static source QA passed; browser visual QA pending |
| `/privacy` | Adaptive | Root semantic tokens | Root purple | Privacy notice | Static source QA passed; browser visual QA pending |
| `/terms` | Adaptive | Root semantic tokens | Root purple | Terms | Static source QA passed; browser visual QA pending |
| `/marketplace` | Adaptive | Root semantic tokens | Root purple | Customer marketplace and checkout | Static source QA passed; browser visual QA pending |
| `/account` | Adaptive | Root semantic tokens | Root purple | Profile and preferences | Static source QA passed; browser visual QA pending |
| `/claim` | Adaptive | Root semantic tokens | Root purple | Business claim flow | Static source QA passed; browser visual QA pending |
| `/claim/drafts` | Adaptive | Root semantic tokens | Root purple | Claim drafts | Static source QA passed; browser visual QA pending |
| `/claim/status/[claimId]` | Adaptive | Root semantic tokens | Root purple | Claim tracking | Static source QA passed; browser visual QA pending |
| `/payment/return` | Adaptive | Root semantic tokens | Root purple | Payment return | Static source QA passed; browser visual QA pending |
| `/business` | Adaptive | Business workspace scope | Business semantic pair | Merchant Today | Static source QA passed; browser visual QA pending |
| `/business/[section]` | Adaptive | Business workspace scope | Business semantic pair | Merchant modules | Static source QA passed; browser visual QA pending |
| `/business/kiosk/live` | Fixed dark | Dedicated inverse shared-device screen | Business/inverse | Customer kiosk/check-in | Static source QA passed; browser visual QA pending |
| `/driver` | Adaptive | Driver workspace scope | Driver semantic pair | Training home | Static source QA passed; browser visual QA pending |
| `/driver/[section]` | Adaptive | Driver workspace scope | Driver semantic pair | Training modules | Static source QA passed; browser visual QA pending |
| `/staff` | Adaptive | Root purple workspace | Root purple | Staff Today | Static source QA passed; browser visual QA pending |
| `/staff/[section]` | Adaptive | Root purple workspace | Root purple | Staff modules | Static source QA passed; browser visual QA pending |
| `/admin` | Adaptive | Admin workspace scope | Admin semantic pair | Admin home | Static source QA passed; browser visual QA pending |
| `/admin/[section]` | Adaptive | Admin workspace scope | Admin semantic pair | Admin modules | Static source QA passed; browser visual QA pending |
| `/admin/queues/[queue]` | Adaptive | Admin workspace scope | Admin semantic pair | Operational queues | Static source QA passed; browser visual QA pending |
| `/admin/support-view/[businessId]` | Adaptive | Root semantic fallback / admin context | Root/Admin | Support business context | Static source QA passed; browser visual QA pending |
| `/devstatus` | Adaptive | Root semantic tokens; internal route | Root purple | Internal readiness | Static source QA passed; browser visual QA pending |

## Policy enforcement

`config/theme-policy.json` is checked by `scripts/theme-safety.mjs`. A new page route fails the theme safety check until it is classified.

## Overlay behavior

The shared Overlay/Modal system uses semantic surface, text, border, and overlay tokens. Deliberate inverse sections do not change the document theme; their fixed foreground/background pairing is listed in the exception inventory.

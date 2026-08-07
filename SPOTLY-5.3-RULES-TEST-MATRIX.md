# Spotly 5.3 Rules Test Matrix

The emulator test suite is prepared in `tests/emulator/rules-emulator.mjs`. It was not executable in the current environment because the internal npm registry returns 404 for `firebase-tools`.

| Persona | Resource/action | Expected | Local static evidence | Emulator actual |
|---|---|---|---|---|
| Anonymous | Read public business | Allow | Query/rule aligned | Not executed |
| Anonymous | Read private business | Deny | Rule | Not executed |
| Anonymous | Read public branch | Allow | Rule/query | Not executed |
| Anonymous | Read private branch | Deny | Rule | Not executed |
| Anonymous | Read published active product under public business | Allow | Rule/query | Not executed |
| Anonymous | Read draft product | Deny | Rule | Not executed |
| Customer | Read own order | Allow | Rule | Not executed |
| Customer | Write order directly | Deny | Rule | Not executed |
| Branch manager | Read assigned branch order | Allow | Rule | Not executed |
| Branch manager | Read other branch order | Deny | Rule | Not executed |
| Suspended account | Business order access | Deny | Rule | Not executed |
| Support agent | Become platform admin through `support.*` | Deny | Static test passes | Not executed |
| Member | Mutate own membership grant | Deny | Static test passes | Not executed |
| Invitee | Change invitation role/permissions | Deny | Static test passes | Not executed |
| Ordinary user | Create audit log | Deny | Static test passes | Not executed |
| Ordinary user | Create trusted order event | Deny | Static test passes | Not executed |
| Business owner | Upload catalogue image | Allow | Storage rule | Not executed |
| Branch manager without catalogue-edit | Upload catalogue image | Deny | Storage rule | Not executed |
| Support requester | Upload own support attachment | Allow | Storage rule | Not executed |
| Support requester | Upload under another user path | Deny | Storage rule | Not executed |

Run externally:
```bash
npm ci
npm run test:rules
```

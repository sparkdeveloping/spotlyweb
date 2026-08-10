# Spotly Business 5.5 — Setup and Resume Report

## Setup purpose

The guided wizard is now Stage 2 only: **Business basics**. It no longer pretends that finishing the short wizard means the business is customer-live.

## Completion model

`evaluateSetupSteps()` derives completion from persisted business/location/operations data. Stored onboarding metadata supports history and navigation but is not trusted as the only source of truth.

Required-step progress is:

```text
completed required basics / total required basics
```

An empty setup therefore begins at 0%. Current wizard location is shown separately as `Step X of Y`.

## Validators

The lifecycle engine validates actual data for:

- identity;
- operating model;
- first location/operating base;
- customer capability/offering selection;
- optional starter-content visitation;
- final basics review.

Optional starter content does not inflate required-progress percentage.

## Deterministic resume

`resolveSetupStep()`:

1. evaluates all current foundational data;
2. finds the first incomplete required prerequisite;
3. honors a requested `step=` only when it does not skip an incomplete prerequisite;
4. redirects to Launch Checklist when all foundational steps are complete.

Supported form:

`/business/setup?business=<id>&step=<stepId>`

Refresh, browser history and support deep links therefore have a stable setup destination.

## Persistence hardening

Each setup step saves only the data that step owns. Earlier-step saves no longer persist default values belonging to future steps, and the final review step no longer rewrites every prior step merely because it is last.

Examples:

- Identity saves identity/type/category/description.
- Operation saves operating model.
- Location saves the location through the trusted branch API.
- Offering saves capabilities/operational settings.
- Starter imports selected optional starter content only on the starter step.
- Review finalizes onboarding metadata.

This prevents false completion caused by default values that a merchant never actually confirmed.

## Listener-lag protection

After a confirmed server write, the setup component keeps a short-lived optimistic snapshot of confirmed Business/Location/Operations state until Firestore subscriptions catch up. This prevents `Save and continue` from briefly routing back to an earlier step because the listener is one round-trip behind the save.

## Save and leave

Before launch, `Save and leave` returns to the Launch Checklist, not operational Today.

Normal saves use lightweight status feedback (`Saving…`, `Saved`, saved time). Full-screen processing is reserved for genuinely heavier workflows elsewhere.

## Unsaved changes

The wizard tracks dirty state, warns on browser unload/internal navigation, and does not count unsaved local input as persisted completion.

## Business-type changes

Changing business type warns that launch requirements can change. Once saved, the lifecycle engine recalculates basics, capabilities and launch requirements rather than preserving an obsolete 100% state.

## Launch-critical edits

Post-review changes to launch-critical basics can mark the current launch decision for re-review. Routine operational edits remain separate from foundational onboarding.

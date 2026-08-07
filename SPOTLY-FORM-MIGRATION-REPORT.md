# Spotly Form Migration Report

## Result

- Legacy undefined `.input` class occurrences: **0**
- Current `.field-control` references: **56**
- Shared form-component references (`Input`, `NativeSelect`, `Textarea`, `Field`): **168**

## Shared primitives

Implemented in `components/ui.js`:

- `Field`
- `ErrorSummary`
- `Input`
- `Textarea`
- `NativeSelect`
- Existing custom `Select`
- `Checkbox`
- `RadioGroup`
- `SearchField`

## Global control behavior

`.field-control` provides:

- Semantic light/dark background and foreground
- 48px default touch height
- Visible 3:1 control border
- Hover and focus border treatment
- Strong focus outline and soft halo
- Placeholder contrast
- Disabled/read-only treatment
- Autofill normalization
- Native select color scheme
- Forced-colors support

## Migrated areas

- Public waitlist and launch location selection
- Public business finder
- Login, signup, and password recovery
- Customer marketplace location controls and checkout
- Business claim, parent organization, scope, public details, evidence, and review
- Account profile, contact, language, and verification
- Merchant forms and settings
- Staff forms and learning
- Admin queue filters, assignment, decisions, configuration, and directory operations
- Support composer and structured context
- Payment return/recovery controls where applicable

## Remaining validation

Source and contrast validation passed. Browser-native select menus, mobile keyboard behavior, autofill, password-manager behavior, zoom, and screen-reader form announcements still require the exact built staging artifact.

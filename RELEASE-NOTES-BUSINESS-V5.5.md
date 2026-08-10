# Spotly Business 5.5 — Lifecycle Orchestration

## Release theme

**One business lifecycle instead of overlapping setup/review concepts.**

Spotly Business 5.5 preserves the multi-business Business OS introduced in 5.4 and adds the orchestration layer required to make that depth understandable to merchants.

## Highlights

- Five-stage lifecycle: Access → Basics → Prepare → Final Spotly review → Live.
- New Launch Checklist as the pre-live home.
- Merchant setup percentage separated from Spotly-owned reviews.
- Exact next actions rather than generic “Continue setup.”
- Setup progress starts at 0% and resumes from actual persisted prerequisites.
- URL-addressable setup steps.
- Persistent Business provider/sidebar architecture.
- Lifecycle-gated pre-live versus live navigation.
- Clear locked operational pages before launch.
- Specific access, settlement and final-review language.
- Server-authoritative final launch review and Admin decision workflow.
- Requested changes and re-submission support.
- Live re-review without reopening foundational onboarding.
- Trusted suspend/resume behavior.
- Trusted branch structural API and stricter customer-live publication gates.
- Customer marketplace/order creation now require an actually live parent business.
- Existing 5.4 catalogue, Master Product Library, AI media, Staff capture and Business Money retained.

## Compatibility

Legacy active/public merchants continue to derive as live. Ambiguous older records default safely to preparing rather than being falsely customer-live.

## Validation

See `SPOTLY-BUSINESS-LIFECYCLE-VALIDATION-REPORT.md` for exact local pass/blocked results and the required external build/emulator/staging gate.

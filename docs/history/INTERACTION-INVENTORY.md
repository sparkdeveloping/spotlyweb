# Spotly Interaction Inventory

## Repaired interactions

- Customer Search, Orders and Saved destinations are controlled by the URL and survive refresh, browser back and forward.
- `?order=<id>` opens the correct customer order, focuses it and provides a recovery path when unavailable.
- Customer basket state and checkout draft persist locally between navigation and refresh.
- Changing a customer pickup location now requires explicit confirmation before clearing incompatible basket state.
- Mobile customers receive a persistent basket bar and a dedicated basket sheet.
- Checkout is divided into review, pickup, contact/substitutions, payment and confirmation stages.
- Business claim progress persists before and after sign-in and includes Save and exit.
- Claim evidence validates supported types and size and provides remove/retry behavior.
- Merchant Today prioritizes operating state, urgent work, active transaction stages and closing tasks.
- Catalogue availability can be edited from mobile cards; quick add no longer requires a wide desktop grid.
- Driver job acceptance persists instead of being lost during navigation or refresh.
- Driver navigation opens a real map deep link; job support links carry issue context.
- Staff shift actions work from the compact Today header.
- Staff learning opens a content/acknowledgement flow and saves completion through the existing workforce service.
- Support links accept contextual topic/subject query parameters and prefill a conversation.
- Workspace search is now a current-workspace command menu instead of promising cross-record search it does not provide.
- Mobile navigation contains four priority destinations and an explicit More sheet.
- Desktop sidebar can collapse and remembers the user’s preference.
- Static list rows no longer render as keyboard-focusable buttons.
- Dialogs now include focus management, Escape handling, focus restoration and dialog semantics.
- Tabs include tab semantics and keyboard navigation.
- Disabled link-style buttons no longer remain accidentally actionable.
- Support contact channels are hidden unless configured.
- Account pages no longer expose Firebase, VAPID, raw record identifiers or deployment instructions.

## Removed interactions and surfaces

- Removed the unused legacy customer prototype that contained static profile, booking and share controls.
- Removed the public development-status application and redirected its legacy route to protected configuration.
- Removed public navigation to admin, staff, driver and development workspaces.
- Removed oversized gradient PNG role logos after replacing them with flat SVG/PWA assets.
- Removed driver demand-map, profile, support and communication rows that looked actionable but had no implementation; remaining actions now open a real route, map link or support context.
- Removed customer empty-state actions that sent shoppers into business claiming.
- Removed merchant and staff copy that exposed permission codes or role-template identifiers.

## Automated static interaction result

The repository was scanned for JSX `<button>` and shared `<Button>` elements lacking an action, destination, disabled state or submit behavior.

**Result: 0 potential inert buttons.**

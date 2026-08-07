# Spotly Semantic Token Inventory

Values are defined in `app/globals.css`. Contrast is tested automatically for required foreground/background and non-text boundary pairs.

| Token | Light | Dark | Intended use | Verification |
|---|---|---|---|---|
| `--background` | `#fbfbfc` | `#0b0d12` | Page background | N/A or paired through component use |
| `--grouped` | `#f3f5f8` | `#10141b` | Grouped workspace background | N/A or paired through component use |
| `--surface` | `#ffffff` | `#171b24` | Primary surface | N/A or paired through component use |
| `--surface-2` | `#eef1f5` | `#202632` | Secondary surface | N/A or paired through component use |
| `--surface-raised` | `#ffffff` | `#1d222d` | Raised surface | N/A or paired through component use |
| `--surface-hover` | `#f7f8fa` | `#222936` | Hover surface | N/A or paired through component use |
| `--surface-selected` | `#f0eeff` | `#292448` | Selected surface | N/A or paired through component use |
| `--overlay` | `rgba(15, 23, 42, 0.52)` | `rgba(0, 0, 0, 0.70)` | Backdrop | N/A or paired through component use |
| `--text` | `#111827` | `#f4f6f8` | Primary text | 17.15:1 light; 17.94:1 dark |
| `--text-2` | `#4b5563` | `#c1c7d0` | Secondary text | 7.56:1 light; 10.13:1 dark |
| `--text-3` | `#667085` | `#a0a9b8` | Tertiary text | 4.97:1 light; 7.27:1 dark |
| `--text-disabled` | `#7d8796` | `#8791a1` | Disabled text | N/A or paired through component use |
| `--text-inverse` | `#ffffff` | `#111827` | Text on inverse surfaces | N/A or paired through component use |
| `--border` | `#cbd2dc` | `#465063` | Standard boundary | N/A or paired through component use |
| `--border-subtle` | `#e2e7ee` | `#303848` | Subtle divider | N/A or paired through component use |
| `--border-strong` | `#9aa6b5` | `#647087` | Strong boundary | N/A or paired through component use |
| `--divider` | `#d8dee7` | `#353e4e` | Section divider | N/A or paired through component use |
| `--accent` | `#5a4bcf` | `#9b91ff` | Primary action | N/A or paired through component use |
| `--accent-hover` | `#4e3fc0` | `#aaa1ff` | Primary hover | N/A or paired through component use |
| `--accent-active` | `#4335ad` | `#b8b1ff` | Primary active | N/A or paired through component use |
| `--accent-strong` | `#4638b5` | `#b2aaff` | Strong accent text/icon | N/A or paired through component use |
| `--accent-soft` | `#eeebff` | `#292448` | Soft accent surface | N/A or paired through component use |
| `--on-accent` | `#ffffff` | `#12101f` | Foreground on accent | 6.28:1 light; 7.05:1 dark |
| `--on-accent-soft` | `#30266f` | `#dcd8ff` | Foreground on soft accent | N/A or paired through component use |
| `--control-bg` | `#ffffff` | `#151923` | Control background | N/A or paired through component use |
| `--control-bg-hover` | `#fbfcfd` | `#1b202b` | Control hover | N/A or paired through component use |
| `--control-bg-disabled` | `#edf0f4` | `#202632` | Disabled control | N/A or paired through component use |
| `--control-text` | `#111827` | `#f4f6f8` | Control text | 17.74:1 light; 16.22:1 dark |
| `--control-text-disabled` | `#667085` | `#909aaa` | Disabled control text | N/A or paired through component use |
| `--control-placeholder` | `#667085` | `#a0a9b8` | Placeholder | 4.97:1 light; 7.41:1 dark |
| `--control-border` | `#7d899a` | `#5d687d` | Control boundary | 3.55:1 light; 3.13:1 dark |
| `--control-border-hover` | `#7d899a` | `#78859b` | Control hover boundary | N/A or paired through component use |
| `--control-border-error` | `#b42318` | `#f97066` | Error boundary | N/A or paired through component use |
| `--focus` | `#4e3fbf` | `#b2aaff` | Focus indicator | 7.29:1 light; 9.34:1 dark |
| `--focus-soft` | `rgba(78, 63, 191, 0.24)` | `rgba(178, 170, 255, 0.28)` | Focus halo | N/A or paired through component use |
| `--success` | `#087a38` | `#5fd68a` | Success action/state | N/A or paired through component use |
| `--success-soft` | `#e3f6ea` | `#173725` | Success surface | N/A or paired through component use |
| `--on-success` | `#ffffff` | `#092113` | Foreground on success | 5.45:1 light; 9.26:1 dark |
| `--on-success-soft` | `#075d2d` | `#b7f4ca` | Foreground on success soft | N/A or paired through component use |
| `--warning` | `#8a4300` | `#f5b041` | Warning action/state | N/A or paired through component use |
| `--warning-soft` | `#fff0d6` | `#3d2b12` | Warning surface | N/A or paired through component use |
| `--on-warning` | `#ffffff` | `#281a06` | Foreground on warning | 7.28:1 light; 9.00:1 dark |
| `--on-warning-soft` | `#713500` | `#ffe4ad` | Foreground on warning soft | N/A or paired through component use |
| `--danger` | `#b42318` | `#ff7a70` | Danger action/state | N/A or paired through component use |
| `--danger-soft` | `#feeceb` | `#421d20` | Danger surface | N/A or paired through component use |
| `--on-danger` | `#ffffff` | `#2b090b` | Foreground on danger | 6.57:1 light; 7.21:1 dark |
| `--on-danger-soft` | `#8b1a12` | `#ffd1cd` | Foreground on danger soft | N/A or paired through component use |
| `--info` | `#175cd3` | `#84adff` | Information action/state | N/A or paired through component use |
| `--info-soft` | `#eaf2ff` | `#172f59` | Information surface | N/A or paired through component use |
| `--on-info` | `#ffffff` | `#071a38` | Foreground on info | 5.99:1 light; 7.75:1 dark |
| `--on-info-soft` | `#1849a9` | `#ccddff` | Foreground on info soft | N/A or paired through component use |
| `--inverse-surface` | `#111827` | `#f4f6f8` | Inverse surface | N/A or paired through component use |
| `--inverse-text` | `#ffffff` | `#111827` | Inverse foreground | N/A or paired through component use |
| `--business` | `#147a4a` | `#65d99c` | Business accent | N/A or paired through component use |
| `--on-business` | `#ffffff` | `#082218` | Business accent foreground | 5.37:1 light; 9.55:1 dark |
| `--driver` | `#2563eb` | `#8bb4ff` | Driver accent | N/A or paired through component use |
| `--on-driver` | `#ffffff` | `#07162e` | Driver accent foreground | 5.17:1 light; 8.66:1 dark |
| `--admin` | `#28466f` | `#a9c7ec` | Admin accent | N/A or paired through component use |
| `--on-admin` | `#ffffff` | `#0b1b2e` | Admin accent foreground | 9.56:1 light; 9.97:1 dark |

## Automated thresholds

- Normal text pairs: 4.5:1 minimum.
- Control borders and focus indicators: 3:1 minimum.
- Workspace accent pairs: included for Business, Driver, and Admin.

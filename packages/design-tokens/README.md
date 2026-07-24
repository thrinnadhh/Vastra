# `@vastra/design-tokens`

Platform-neutral design contracts for Vastra customer, merchant, captain, and admin
frontends.

## What this package owns

- primitive cosmic navy, royal blue, plum, peacock teal, magenta, warm-gold, neutral,
  warning, and danger palettes;
- backward-compatible flat semantic colour keys;
- nested Brand, action, information, success, warning, danger, premium, surface, text,
  border, and application-accent roles;
- light and dark theme composition;
- typography, spacing, shape, elevation, motion, breakpoints, layout, iconography, and
  component dimensions;
- the exact `brand`, `commerce`, and `hybrid` presentation modes;
- ornament density/accessibility contracts;
- required-but-not-supplied asset slots;
- Brand, Commerce, and Hybrid shell contracts.

The package has no React, React Native, DOM, storage, network, or asset-binary
dependency. Platform adapters consume these values and remain responsible for mapping
them to framework-specific styles.

## Usage

```ts
import {
  designTokens,
  presentationModes,
  themes,
  type PresentationModeName,
} from '@vastra/design-tokens';

const mode: PresentationModeName = 'commerce';
const primaryAction = themes.light.colorRoles.action.primary;
const maximumBrandMoments = presentationModes.hybrid.maxBrandMoments;
```

## Authority and boundaries

The implementation reconciles:

- `docs/design/design-system.md`;
- `docs/design/frontend-visual-contract.md`;
- `design-system/vastra/MASTER.md`.

Gold is restricted to premium/trust accents and is not approved for normal small body
text on ivory. Ornaments are decorative, hidden from accessibility traversal, bounded
by presentation mode, and may never obscure product media, copy, prices, status, or
controls.

No production logo or illustration binaries are included. The asset contract reserves
the required slots until approved files are supplied.

## Validation

```bash
pnpm --filter @vastra/design-tokens test
pnpm --filter @vastra/design-tokens typecheck
pnpm --filter @vastra/design-tokens lint
pnpm --filter @vastra/design-tokens build
```

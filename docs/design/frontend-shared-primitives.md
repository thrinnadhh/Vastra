# FE-S02-04 shared primitive contract

Status: implemented platform foundation
Ticket: `FE-S02-04`

## Classification

`READY` as a framework-neutral, dependency-free primitive and adapter package. This ticket does not require an HTTP contract and does not own feature screens, root shells, navigation, or server state.

`@vastra/design-tokens` is still the future source of resolved colour, typography, spacing, radius, elevation, and motion values. To avoid claiming that the unimplemented token package is complete, `@vastra/ui-primitives` exports semantic style slots rather than raw visual values. Platform renderers must resolve those slots through the approved design-token adapter before feature migration.

## Package boundary

`@vastra/ui-primitives` owns deterministic, presentational contracts for:

- buttons and duplicate-submit-safe busy/disabled state;
- labelled fields with retained values, descriptions, and announced errors;
- semantic icons without emoji or platform glyph coupling;
- status badges with text and icons so colour is never the only signal;
- integer-paise INR price formatting and truthful sale-price announcements;
- interactive/non-interactive cards and minimum mobile touch-target metadata;
- reduced-motion-aware, accessibility-hidden skeleton geometry;
- recoverable, fatal, offline, permission, and session-expiry error states;
- modal sheets and confirmation/urgent/destructive dialogs;
- bounded, deduplicated toast models and a framework-neutral store;
- web and React Native property adapters for accessibility and interaction state.

The package intentionally has no React, React Native, DOM, icon-library, animation-library, network, query, or storage dependency. Applications provide renderers and token resolution. This prevents web primitives from entering mobile bundles and React Native primitives from entering the admin bundle.

## Accessibility invariants

- Android target contract is at least 48 dp; iOS is at least 44 pt; adjacent mobile controls reserve 8 dp.
- Busy buttons are disabled so the same user intent cannot be submitted twice.
- Meaningful icons require labels; decorative icons are removed from accessibility traversal.
- Fields expose stable label/description/error relationships and preserve the supplied value after recoverable errors.
- Status badges always include text plus a semantic icon.
- Web adapters expose keyboard/focus, `aria-*`, dialog, status, alert, and live-region semantics.
- Native adapters expose role, label, hint, state, live-region, and minimum-target metadata.
- Reduced motion disables skeleton animation.
- Modal overlays require explicit accessible close/cancel paths and restore focus after dismissal.

## Migration impact

No existing customer, merchant, captain, or admin screen is migrated in this ticket. Existing checkout/orders, merchant ringing/fulfilment, and captain delivery behavior remains unchanged. Feature tickets may adopt these primitives only through platform renderers and after the semantic token boundary is implemented.

## Deferred ownership

- `FE-S1R-*`: resolved design tokens, modes, ornament rules, and shell visual values.
- `FE-S02-05`: application shell composition.
- `FE-S02-06`: shared component fixtures, E2E entry points, and visual-regression infrastructure.
- Feature tickets: actual customer, merchant, captain, and admin component migration.

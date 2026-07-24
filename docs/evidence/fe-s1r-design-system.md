# FE-S1R design-system closure

## Scope

This closure implements the approved Sprint 1R contract without replaying the obsolete
page-planning content from closed PR #72.

## Acceptance mapping

### FE-S1R-01 — semantic colour roles

- cosmic navy, royal blue, plum, peacock teal, magenta, warm-gold, neutral, warning, and
  danger primitive ramps;
- compatible flat semantic keys for light and dark themes;
- nested Brand, action, information, success, warning, danger, premium, surface, text,
  border, and app-accent roles;
- automated normal-text WCAG AA checks for canonical foreground/background pairs;
- explicit prohibition on warm gold as normal small body text.

### FE-S1R-02 — presentation modes

- exact typed modes: `brand`, `commerce`, and `hybrid`;
- bounded decoration, background, heading, motion, ornament-family, and Brand-moment
  contracts;
- no arbitrary fourth mode accepted by the exported type.

### FE-S1R-03 — ornament contracts

- arch, flute, peacock, textile, cosmic, editorial, and trust-strip contracts;
- decorative accessibility semantics;
- density limits;
- static reduced-motion behavior;
- product/content non-obscuring rules.

### FE-S1R-04 — asset contract

- six required asset slots;
- source-format, usage, prohibited-use, accessibility, and optimization requirements;
- status remains `required-not-supplied`;
- no production artwork is fabricated or committed.

### FE-S1R-05 — shell contracts and validation

- Brand, Commerce, and Hybrid shell contracts;
- safe-area, keyboard, scrolling, recovery-state, dominant-action, and reduced-motion
  requirements;
- platform-neutral typography, spacing, shape, elevation, motion, layout, icon, and
  component tokens;
- unit tests for completeness, contrast, density, asset slots, and shell invariants.

## Boundaries

- no customer, merchant, captain, or admin feature screen changes;
- no backend, OpenAPI, database, RLS, navigation, or product-scope changes;
- no framework runtime dependency;
- dark-theme compatibility is retained, while light theme remains the MVP release gate;
- physical-device and screenshot evidence remains owned by consuming feature and release
  tickets.

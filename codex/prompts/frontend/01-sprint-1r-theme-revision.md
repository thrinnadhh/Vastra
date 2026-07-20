# Codex prompt — Sprint 1R approved theme revision

## Objective

Update the existing Sprint 1 design system to encode the approved two-layer Vastra visual architecture before any page-level implementation begins.

## Work area

- `packages/design-tokens`
- `design-system/vastra`
- `docs/design`
- shared UI package only if it already exists and the ticket explicitly includes it

## Read first

- `codex/prompts/frontend/00-master-frontend-contract.md`
- `docs/design/frontend-ui-ux-sprint-roadmap.md`
- `design-system/vastra/MASTER.md`
- all existing design-token files and tests

## Execute one ticket at a time

### S1R-01 — cosmic colour system

Implement:

- cosmic navy ramp;
- royal blue ramp;
- peacock teal ramp;
- magenta ramp;
- warm-gold ramp;
- decorative sparkle values;
- accessible semantic roles for Brand and Commerce use.

Acceptance:

1. Existing semantic keys remain backward compatible unless the task explicitly migrates all consumers.
2. Canonical foreground/background pairs meet WCAG contrast.
3. Gold is not chosen as normal small body text on ivory.
4. Colour tests cover light, dark and brand surfaces.
5. No application screen is modified in this ticket.

### S1R-02 — presentation modes

Add typed platform-neutral definitions for:

- `brand`;
- `commerce`;
- `hybrid`.

Each mode defines decoration intensity, background treatment, heading treatment, motion treatment and allowed ornament count.

Acceptance:

1. Modes compose with existing light/dark themes.
2. A consumer can select a mode without importing framework code.
3. No uncontrolled arbitrary mode is accepted by the type system.
4. Tests cover mode completeness.

### S1R-03 — ornament contracts

Document and, where appropriate, type contracts for:

- `ArchFrame`;
- `FluteDivider`;
- `PeacockAccent`;
- `CosmicSprinkle`;
- `EditorialHero`;
- `TrustStrip`.

Acceptance:

1. Decorative semantics are excluded from accessibility traversal.
2. Density limits are explicit for Brand, Hybrid and Commerce.
3. Reduced-motion/static variants are specified.
4. Product images and text may never be obscured.

### S1R-04 — logo and asset contract

Document required asset variants and size/usage constraints. Do not fabricate production logo binaries. Add an asset manifest/schema if the repository has an established asset-management pattern.

Acceptance:

- full illustration restricted to launch/editorial use;
- compact mark specified for app chrome;
- monochrome mark specified for system contexts;
- alt text and decorative-use rules documented;
- image format, dimensions and optimization rules specified.

### S1R-05 — shell contracts and validation

Define contracts for:

- `BrandExperienceShell`;
- `CommerceScreenShell`;
- `HybridScreenShell`.

Acceptance:

- safe-area, keyboard and scrolling behaviour specified;
- one dominant CTA rule preserved;
- reduced-motion behaviour specified;
- screenshot/a11y test expectations added;
- design-token tests, lint, typecheck and build pass.

## Out of scope

- implementing customer Home;
- adding navigation libraries;
- committing generated concept images as production assets;
- changing backend APIs;
- implementing Couple or Groups business logic.

## Required validation

```bash
pnpm --filter @vastra/design-tokens test
pnpm --filter @vastra/design-tokens typecheck
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Use the exact scripts available in the repository; report any command substitutions.

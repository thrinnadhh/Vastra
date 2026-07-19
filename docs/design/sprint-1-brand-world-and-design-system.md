---
sprint: frontend-design-1
status: implemented
source_skill: nextlevelbuilder/ui-ux-pro-max-skill
---

# Sprint 1 — Vastra brand world and design system

## Goal

Establish the shared visual and interaction foundation for customer, merchant, captain, admin, Wardrobe, Couple, Group, mobile-web, and desktop-web experiences.

Sprint 1 does not redesign product workflows. It creates the source of truth that future screen sprints must use.

## Parallel workstreams

### Workstream A — Brand world

- Define the warm shopping-complex experience.
- Freeze the product personality, editorial zone language, photography direction, and visual anti-patterns.
- Preserve clarity, local-store trust, and fashion desire.

### Workstream B — Colour and typography

- Define accessible brand ramps and semantic light/dark themes.
- Define editorial and functional font roles.
- Require tabular numerals for prices, timers, and operational counts.

### Workstream C — Layout, shape, and responsive behaviour

- Freeze spacing, breakpoints, gutters, radii, elevation, safe-area, and z-index rules.
- Support compact Android phones, large phones, tablets, desktop, and wide desktop.

### Workstream D — Interaction, motion, and iconography

- Freeze touch-target sizes, press feedback, motion durations, easing, reduced-motion behaviour, and vector icon discipline.
- Prohibit emoji as structural icons.

### Workstream E — Component and state contracts

- Define button, input, card, status, sheet, modal, navigation, feedback, product, shop, and operational component contracts.
- Require loading, empty, error, offline, permission-denied, and session-expired states.

### Workstream F — Quality and governance

- Add typed design tokens and invariant tests.
- Persist the master design system.
- Define accessibility and pre-delivery gates.
- Define how page-specific overrides are approved.

## Implemented artifacts

- `design-system/vastra/MASTER.md`
- `docs/design/sprint-1-component-contracts.md`
- `docs/design/sprint-1-pre-delivery-checklist.md`
- `packages/design-tokens/src/*`
- design-token invariant tests

## UI/UX Pro Max rules applied

The sprint follows the skill's required priority order:

1. accessibility;
2. touch and interaction;
3. performance;
4. style consistency;
5. layout and responsive behaviour;
6. typography and colour;
7. animation;
8. forms and feedback;
9. navigation;
10. charts where relevant.

Key non-negotiable gates:

- normal text contrast at least 4.5:1;
- touch targets at least 48 x 48 dp on Android and 44 x 44 pt on iOS;
- minimum 8 dp between adjacent touch targets;
- visible field labels and local errors;
- safe-area compliance;
- reduced-motion support;
- semantic tokens instead of raw per-screen values;
- one vector icon family per visual layer;
- no emoji used as structural icons;
- one dominant primary action per screen;
- bottom navigation limited to five labelled destinations;
- motion generally between 150 and 300 ms and never blocks input.

## Product-specific decisions

### Customer experience

The customer app is editorial and immersive, but product availability, price, shop, delivery estimate, and trust remain easy to scan.

### Merchant and captain experience

Operational speed and status clarity take priority over editorial styling. These apps use the same semantic tokens with flatter surfaces, larger targets, and fewer decorative treatments.

### Admin experience

The admin dashboard uses compact but accessible data density, visible focus, keyboard navigation, flatter elevation, strong audit context, and confirmation for privileged actions.

### Wardrobe

Wardrobe feels like a private dressing room. New items are private by default.

### Couple

Couple remains a private, accepted, exactly-two-person styling space. It is not a dating or discovery feature.

### Groups

Groups remain separate from Couple, support invitation-based multi-person events, and use group/event-specific wardrobe visibility.

## Definition of done

Sprint 1 is complete when:

- the persisted master system exists;
- platform-neutral TypeScript tokens export without external runtime dependencies;
- light and dark semantic themes are defined;
- typography, spacing, layout, radii, elevation, motion, icon, and z-index scales are typed;
- component contracts cover all essential states;
- accessibility and pre-delivery checklists are documented;
- invariant tests reject unsafe touch targets, invalid motion hierarchy, unsorted breakpoints, and missing semantic theme values;
- all future screen work can reference named tokens rather than inventing raw values.

## Deferred to later design sprints

- high-fidelity page compositions;
- final production photography;
- full navigation implementation;
- React Native and web component implementation;
- Couple and Group business logic;
- virtual try-on and body scanning;
- advanced recommendation UI;
- decorative 3D environments.

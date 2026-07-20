# Codex prompt pack — Sprints 2 to 4 customer foundation

Use `00-master-frontend-contract.md`. Split each sprint into the ticket IDs defined in the roadmap and execute one ticket per run.

# Sprint 2 — launch, authentication and onboarding

## Objective

Implement a first-launch experience that introduces Vastra's warmth and local-fashion value, then transitions into a clear, efficient authentication flow.

## Screen requirements

### Splash

- Brand mode.
- Show an optimized approved launch asset when supplied through the asset contract.
- Bootstrap session and first-launch state concurrently.
- Do not use a blocking long animation.
- Provide deterministic test behaviour.

### Welcome/Shop local/Everyone

- Brand mode with restrained copy.
- Explicitly communicate nearby local stores and broad fashion categories.
- Support skip and back behaviour.
- Persist onboarding completion only after the correct point.

### Preferences

- Commerce mode.
- Preferences are optional unless an existing contract says otherwise.
- Support women, men, kids and multiple category interests without forcing a gender identity field.
- Allow later editing.

### Location

- Explain benefit before requesting permission.
- Handle denied, blocked, disabled GPS and manual-location paths.
- Never imply serviceability before backend confirmation.

### Authentication

- Phone and OTP states use existing auth contracts.
- Include validation, resend cooldown, wrong/expired code and rate-limit messaging.
- Preserve session and navigation after successful verification.

## Required tests

- first launch versus returning launch;
- session bootstrap;
- onboarding skip/completion;
- phone validation;
- OTP states and resend timing;
- permission denied/manual location;
- service-area unavailable;
- screen-reader labels and touch targets.

# Sprint 3 — navigation and shared customer UI

## Objective

Replace the temporary Checkout/Orders root switch with production typed navigation and shared customer UI foundations.

## Navigation contract

Implement:

- authentication stack;
- five main tabs: Home, Discover, Wardrobe, Orders, Profile;
- product/shop nested stack;
- checkout nested stack;
- return/support nested stack;
- Couple and Groups nested stacks as route placeholders only until their sprints.

Do not place Couple or Groups as extra bottom tabs.

## Shared component order

1. screen shells;
2. text and icon primitives;
3. button and icon button;
4. text field, OTP field and search field;
5. chips and badges;
6. product/shop/order cards;
7. skeleton, empty, error and offline states;
8. toast, sheet and confirmation modal;
9. bottom navigation and app header.

## API boundary

- Add or reuse a typed API client.
- Centralize authentication headers and error normalization.
- Keep query/mutation hooks outside screen composition.
- Do not duplicate backend status-to-copy mappings across screens.

## Required tests

- route typing;
- deep-link/route restoration where supported;
- selected/unselected tabs;
- keyboard/safe-area behaviour;
- button disabled/loading states;
- accessibility roles;
- component visual-state tests;
- existing Checkout and Orders features remain reachable during migration.

# Sprint 4 — customer Home

## Objective

Implement a Hybrid Home that feels warm and distinctive but immediately demonstrates that Vastra sells all fashion from nearby shops.

## Section order

1. delivery location;
2. search entry;
3. one editorial campaign hero;
4. broad category row;
5. nearby shops;
6. trending near user;
7. occasion row;
8. western/casual/office or equivalent everyday collection;
9. price bands;
10. recently viewed;
11. complete-the-look entry;
12. trust strip.

## Category breadth rule

The initial viewport/early scroll must not contain only sarees, kurtas, sherwanis or wedding imagery. Include representative modern casual, western, office, kids, footwear and accessories content when data is available.

## Data rules

- Consume actual API contracts where present.
- Use repository-approved development fixtures only behind dev/test boundaries.
- Closed shops, unavailable items and delivery estimates must reflect server truth.
- Do not fabricate personalized recommendations when only generic collections exist.

## State requirements

- new user without preferences;
- personalized user;
- no nearby shops;
- shop closed;
- partial section failure;
- offline with cached content where supported;
- skeleton layout without major shift;
- service-area unavailable.

## Performance

- lazy-load below-fold imagery;
- use approved image aspect ratios;
- avoid large animated backgrounds;
- limit Brand ornaments to the hero and one supporting moment;
- preserve scroll performance on low-end Android devices.

## E2E acceptance

Home -> nearby shop -> product must be navigable with clear back behaviour. Home must also provide an obvious path to search and Orders.

## Out of scope for Sprints 2-4

- implementing complete search results;
- product purchase flow changes;
- Wardrobe business logic;
- Couple/Groups business logic;
- merchant/captain/admin UI;
- changing backend domain contracts.

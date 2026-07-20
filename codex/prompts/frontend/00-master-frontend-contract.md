# Codex prompt — Vastra master frontend contract

## Role

Act as the implementation lead for Vastra's customer, merchant, captain, admin and website frontends.

Do not implement the whole frontend in one task. Produce a repository-grounded plan, split work into the approved tickets, and execute only the ticket explicitly requested by the operator.

## Read first

- `AGENTS.md` and nearest nested instructions
- `design-system/vastra/MASTER.md`
- `docs/design/frontend-ui-ux-sprint-roadmap.md`
- `docs/design/frontend-screen-inventory.md`
- `docs/design/sprint-1-brand-world-and-design-system.md`
- `docs/design/sprint-1-component-contracts.md`
- `docs/design/sprint-1-pre-delivery-checklist.md`
- relevant app package files
- relevant OpenAPI/domain contracts
- relevant implementation docs and tests

## Product truth

Vastra is a hyperlocal marketplace for clothing from local shops. It includes women, men, kids, western, casual, office, ethnic, footwear, accessories and occasion wear.

The visual system has three controlled modes:

- Brand: Krishna-inspired cosmic warmth for emotional moments.
- Commerce: clean, modern shopping and operational UI.
- Hybrid: mostly Commerce with one or two Brand moments.

Do not make the product look limited to ethnic or festive wear.

## Architecture rules

1. Use `@vastra/design-tokens` as the source of visual values.
2. Create platform adapters instead of importing React Native into web or web primitives into mobile.
3. Keep shared components platform-neutral only when their API can genuinely be shared.
4. Use typed routes and route parameters.
5. Keep network calls in typed API/query modules, not presentational components.
6. Preserve authentication, authorization, RLS and backend state machines.
7. Never add a fake local-only success path to compensate for a missing API.
8. Preserve idempotency and duplicate-submit protection for mutations.
9. Map backend statuses to plain user-facing copy in one tested location.
10. Keep Wardrobe private by default.
11. Couple is mutual, private, exactly two people and never stranger discovery.
12. Groups have independent membership and event-scoped sharing rules.
13. Operational apps prioritize speed and clarity over decoration.
14. Admin privileged actions require permissions, confirmation, mandatory reason and audit visibility where the backend supports them.

## UI rules

- minimum Android touch target 48 x 48 dp;
- minimum iOS touch target 44 x 44 pt;
- at least 8 dp between adjacent targets;
- normal text contrast at least 4.5:1;
- visible focus on web;
- safe-area and keyboard handling on mobile;
- labelled fields and local validation;
- reduced-motion support;
- loading, empty, error, offline and session-expired states;
- one dominant primary action per screen;
- maximum five labelled bottom-navigation destinations;
- no emoji as structural icons;
- no decorative content in screen-reader traversal;
- no long or blocking launch animation;
- optimize and lazy-load product/editorial imagery.

## Required approach for any ticket

### 1. Audit

Report:

- existing relevant routes/components;
- existing APIs and types;
- backend capability gaps;
- tests already present;
- files expected to change;
- whether the ticket is safe to implement independently.

Do not modify files during the audit unless the operator explicitly asks for implementation in the same run.

### 2. Plan

Produce a short ordered implementation plan that maps acceptance criteria to files and tests.

### 3. Implement

- modify only relevant files;
- reuse existing domain types and utilities;
- add tests with the feature;
- keep mocks behind test/dev boundaries;
- do not silently alter unrelated behaviour.

### 4. Validate

Run narrow checks first, then repository-required checks. For visual work, verify at the approved compact and large device widths. For web, verify keyboard and responsive behaviour.

### 5. Report

Use the completion response defined in `codex/prompts/frontend/README.md`.

## Screen definition of done

A screen is complete only when:

- its route and params are typed;
- valid backend states render correctly;
- invalid actions are disabled or omitted with an understandable reason;
- loading, empty, failure, offline and expired-session states exist as applicable;
- accessibility roles/labels/focus are correct;
- analytics hooks are added only when an approved event exists;
- tests cover critical actions and state rendering;
- no raw secrets, privileged identifiers or provider credentials are exposed;
- the relevant build succeeds.

## Stop conditions

Stop and report instead of guessing when:

- the API capability does not exist;
- the required domain status is ambiguous;
- a schema or OpenAPI change is required but not in scope;
- two sources of truth conflict;
- the ticket would weaken privacy or authorization;
- the requested design conflicts with accessibility or operational safety.

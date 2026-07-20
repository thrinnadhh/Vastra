# Vastra frontend Codex run order

These prompts implement the approved frontend program. They do not grant permission to change backend contracts, RLS, state machines or product scope.

## Read before every frontend task

- root `AGENTS.md` and nearest nested `AGENTS.md`;
- `design-system/vastra/MASTER.md`;
- `docs/design/frontend-ui-ux-sprint-roadmap.md`;
- `docs/design/frontend-screen-inventory.md`;
- `docs/design/sprint-1-component-contracts.md`;
- `docs/design/sprint-1-pre-delivery-checklist.md`;
- relevant OpenAPI and implementation contracts;
- relevant existing feature tests.

## Mandatory execution rules

1. Run one ticket at a time.
2. Start by auditing the relevant application and API capability.
3. Do not implement a visual screen whose required backend capability does not exist; record the dependency instead.
4. Use a dedicated branch and worktree for each ticket.
5. Do not let parallel agents edit shared tokens, route types, navigation roots or shared API clients simultaneously.
6. Review the diff and run narrow tests before broader checks.
7. Do not claim physical-device, payment-provider or visual evidence without actually producing it.
8. Keep generated binaries and screenshots out of commits unless the repository explicitly defines their evidence path.
9. Use semantic design tokens, not copied hex values.
10. Do not add production dependencies without approval.

## Prompt order

```text
00-master-frontend-contract.md
01-sprint-1r-theme-revision.md
02-sprints-2-4-customer-foundation.md
03-sprints-5-8-commerce.md
04-sprints-9-11-style-together.md
05-sprints-12-14-operations.md
06-sprints-15-16-web-and-closure.md
```

The grouped prompts are planning packs. Codex must split each named sprint into the tickets already defined in `docs/design/frontend-ui-ux-sprint-roadmap.md` and execute exactly one ticket per task.

## Branch convention

```text
feat/ui-s1r-01-cosmic-colours
feat/ui-s2-01-splash
feat/ui-s3-01-navigation-contracts
feat/ui-s4-01-home-data-model
```

Use the same pattern for later tickets.

## Commit convention

```text
S1R-01 feat(design): add cosmic colour roles
S2-01 feat(customer): add launch splash state
S12-03 feat(merchant): add urgent order alert
```

## Required ticket response

Report:

- ticket and objective;
- implementation summary;
- screens/routes changed;
- API contracts consumed;
- files changed;
- tests added;
- commands and results;
- accessibility and performance decisions;
- screenshots/device evidence when actually generated;
- risks, dependencies or follow-up.

## Integration gates

Before merging any ticket:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
```

Also run the relevant application build, feature tests, E2E suite and database/OpenAPI checks when the change touches those boundaries.

## Parallelization

Safe after shared contracts are frozen:

- customer discovery versus merchant operational UI;
- captain UI versus admin dashboard;
- Wardrobe UI versus website shell;
- documentation/test fixtures versus independent feature screens.

Unsafe:

- two agents changing customer navigation;
- two agents changing design token semantics;
- Couple and Groups independently changing wardrobe visibility types;
- UI changing API types while backend changes the same contract;
- multiple agents changing the same root app shell.

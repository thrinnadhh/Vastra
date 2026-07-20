# Codex Run Order

## Rule

Run one prompt at a time. Review its diff and tests before starting the next.

## Stage 0 — Verify context

1. Extract this pack into the repository.
2. Extract the Vastra documentation pack into `docs/`.
3. Create a Git checkpoint.
4. Verify loaded instructions.

Read-only verification:

```bash
codex --ask-for-approval never \
  "List active instruction files and summarize the Vastra MVP boundary. Do not modify files."
```

Nested verification:

```bash
codex --cd apps/backend --ask-for-approval never \
  "List the instruction files active in this directory. Do not modify files."
```

## Stage 1 — Audit

Run:

```text
codex/prompts/00-repository-audit.md
```

Expected result:

- Repository status
- Missing prerequisites
- Conflicts
- Proposed exact Sprint 0 plan
- No code changes

## Stage 2 — Foundation

Run:

```text
codex/prompts/01-sprint-0-foundation.md
```

Commit after checks pass.

## Stage 3 — Database

Run:

```text
codex/prompts/02-supabase-foundation.md
```

Use a local Supabase instance first.

## Stage 4 — Core implementation

Run in order:

```text
03-authentication-and-roles.md
04-catalogue-and-inventory.md
05-customer-discovery-and-cart.md
05a-wardrobe-mvp.md
05b-group-style-mvp.md
06-order-vertical-slice.md
07-merchant-ringing-alerts.md
08-captain-delivery.md
09-admin-operations.md
10-payments-returns-settlements.md
11-hardening-and-pilot.md
```

Each sprint prompt is still too large for a single final implementation task. Ask Codex to split it into ordered tickets, then execute one ticket at a time.

## Stage 5 — Frontend UI/UX program

The backend/domain sprints above are the capability source of truth. The frontend program surfaces those capabilities through the approved Vastra design system.

Read:

```text
docs/design/frontend-implementation-guide.md
docs/design/frontend-ui-ux-sprint-roadmap.md
docs/design/frontend-screen-inventory.md
docs/design/frontend-visual-contract.md
codex/prompts/frontend/README.md
```

Run the frontend prompts in order:

```text
codex/prompts/frontend/00-master-frontend-contract.md
codex/prompts/frontend/01-gates-visual-and-platform.md
codex/prompts/frontend/02-customer-access-discovery-and-cod.md
codex/prompts/frontend/03-operational-cod-slice.md
codex/prompts/frontend/04-trust-payments-and-returns.md
codex/prompts/frontend/05-operations-completion.md
codex/prompts/frontend/06-style-and-closure.md
```

Rules:

- The grouped frontend prompts are planning packs, not single implementation tasks.
- Start with Gate 0 and split grouped packs into the exact ticket IDs defined in the
  frontend roadmap.
- Execute one ticket per branch/worktree and commit.
- Freeze Gate 0 decisions, Sprint 1R tokens/presentation modes, Sprint 02 platform
  boundaries, and Sprint 03 routes before parallel screen work.
- Do not implement a screen when the required backend/API capability is absent; record the dependency.
- Do not let parallel agents edit shared tokens, root navigation, route types or API clients simultaneously.
- Prove the customer → merchant → captain → admin COD slice before Wardrobe or Group
  Style is treated as a pilot priority.
- Do not add Couple, event-based Groups, a separate customer website, or AI/virtual
  try-on features to the frozen MVP.
- Run physical-device, accessibility, visual-regression and E2E evidence before completing Sprint 16.

## Per-ticket loop

1. Copy `codex/TASK_TEMPLATE.md`.
2. Fill in one ticket.
3. Start Codex in the nearest relevant directory.
4. Ask for plan only first when the task is risky.
5. Approve the plan.
6. Let Codex implement.
7. Run `/review`.
8. Inspect `git diff`.
9. Run tests.
10. Commit.
11. Move to the next ticket.

## Example

Bad:

```text
Build the complete merchant app.
```

Good:

```text
Implement POST /v1/merchant/inventory/adjustments.

Read:
- docs/product/business-rules.md
- docs/architecture/database-schema.md
- docs/api/openapi.yaml
- docs/testing/acceptance-tests.md

Acceptance:
- Requires merchant authentication.
- Merchant can adjust only own shop variant.
- Uses Idempotency-Key.
- Locks inventory row.
- Rejects negative stock.
- Creates immutable movement.
- Adds authorization, transaction, concurrency, and duplicate-request tests.
- Runs relevant checks.
- Does not modify unrelated modules.
```

Frontend example:

```text
Implement ticket FE-S04-04: customer product detail and available variant state.

Read:
- codex/prompts/frontend/00-master-frontend-contract.md
- docs/design/frontend-ui-ux-sprint-roadmap.md
- docs/design/frontend-screen-inventory.md
- docs/design/design-system.md
- docs/design/frontend-visual-contract.md
- relevant catalogue and inventory contracts

Acceptance:
- Uses typed product and variant identities.
- Renders only server-backed colours and sizes.
- Prevents add-to-cart until an available variant is selected.
- Handles stale stock and price changes explicitly.
- Uses semantic design tokens and Commerce presentation mode.
- Adds unit/component tests for initial selection, unavailable variants and stock refresh.
- Runs relevant checks and does not modify unrelated flows.
```

## Parallel Codex tasks

Parallelize only independent work.

Safe examples:

- Design tokens vs database migration
- Customer read-only product card vs backend migration
- Documentation validation vs unrelated test fixtures
- Customer discovery after route contracts freeze vs merchant operational UI
- Captain UI vs admin dashboard

Unsafe examples:

- Two agents modifying the order service
- Two agents editing the same migration
- API contract and implementation changing independently
- Multiple agents changing shared domain enums
- Two agents changing customer root navigation
- Two agents changing semantic colour or presentation-mode tokens
- Group Style and Wardrobe changing sharing/privacy contracts independently

Use separate Git worktrees or branches for parallel tasks.

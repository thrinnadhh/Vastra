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

## Parallel Codex tasks

Parallelize only independent work.

Safe examples:

- Design tokens vs database migration
- Customer read-only product card vs backend migration
- Documentation validation vs unrelated test fixtures

Unsafe examples:

- Two agents modifying the order service
- Two agents editing the same migration
- API contract and implementation changing independently
- Multiple agents changing shared domain enums

Use separate Git worktrees or branches for parallel tasks.

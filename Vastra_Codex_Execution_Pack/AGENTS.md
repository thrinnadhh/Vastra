# Vastra Repository Instructions

## Mission

Build the frozen Vastra MVP as a reliable hyperlocal fashion-commerce platform.

The core transaction is:

```text
Customer discovers and orders
→ inventory is reserved
→ merchant receives a loud ringing alert
→ merchant accepts and packs
→ captain picks up and delivers
→ customer confirms with OTP
→ admin can monitor and recover failures
```

Do not expand the MVP. Do not implement Group Style, body scanning, AI size prediction, virtual try-on, multi-shop carts, multiple merchant staff accounts, or advanced recommendations unless a later approved scope document explicitly enables them.

## Canonical documentation

Before changing code, read the smallest relevant set of documents.

Always authoritative:

1. `docs/product/mvp-scope.md`
2. `docs/product/business-rules.md`
3. `docs/workflows/order-state-machine.md`
4. `docs/architecture/security-model.md`
5. `docs/api/openapi.yaml`
6. `docs/testing/acceptance-tests.md`

Use additional app-specific workflow and design documents when relevant.

When documentation conflicts:

1. Security rules win.
2. Frozen MVP scope wins over wireframes.
3. Business rules win over UI assumptions.
4. OpenAPI is the API contract.
5. Stop and report unresolved conflicts instead of guessing.

## Required working method

For every task:

1. Inspect relevant files and documentation.
2. Restate the task boundary and acceptance criteria.
3. Identify files expected to change.
4. Make the smallest coherent change.
5. Add or update tests.
6. Run required checks.
7. Review the diff.
8. Update documentation or OpenAPI when behavior changes.
9. Report what changed, commands run, results, and remaining risk.

Do not modify unrelated files.

## Architecture

- Use a TypeScript modular monolith for the backend.
- Keep controllers thin.
- Business rules belong in services/domain modules.
- Database operations belong in repositories or transaction helpers.
- Critical writes must use transactions.
- Use Supabase PostgreSQL, Auth, Storage, and Realtime.
- Use Firebase Cloud Messaging for background merchant and captain alerts.
- Use generated/shared API types instead of duplicating contracts.
- Store money as integer paise.
- Store timestamps in UTC.
- Store inventory at variant level.
- Use UUID primary keys.
- Use immutable order, inventory, payment-event, and audit histories.

## Critical safety rules

Never:

- Put a Supabase secret/service-role key in a client app.
- Put payment, SMS, Firebase service-account, or database secrets in source control.
- Let clients directly update inventory balances.
- Trust payment success reported only by the client.
- Skip RLS on an exposed table.
- Change production data manually.
- weaken authorization to make a test pass.
- bypass order-state validation.
- delete audit/history records.
- use floating-point values for money.
- claim a test passed when it was not run.

Destructive commands require explicit user approval:

- Dropping or truncating tables
- Deleting migrations
- Resetting non-local databases
- Force-pushing
- Deleting branches
- Rotating secrets
- Removing production data
- Rewriting released migration history

## Quality requirements

Every feature must include:

- Loading state
- Empty state where applicable
- Recoverable error state
- Authorization
- Input validation
- Structured logging
- Tests
- Accessibility labels for interactive UI
- Documentation updates when behavior changes

Critical commands should be idempotent:

- Order placement
- Inventory adjustment
- Offline sale
- Merchant acceptance/rejection
- Captain offer acceptance
- Pickup confirmation
- Delivery completion
- Payment/refund webhook handling

## Standard verification commands

After Sprint 0 creates the scripts, use:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm db:test
pnpm openapi:check
pnpm build
```

Run the narrowest relevant tests during development, then the full applicable suite before declaring completion.

If a command does not yet exist:

- Do not fabricate its result.
- State that it is unavailable.
- During Sprint 0, create the standardized script.
- Outside Sprint 0, ask before changing repository tooling.

## Git discipline

- Check `git status` before editing.
- Do not overwrite uncommitted user work.
- Prefer focused commits.
- Do not commit generated secrets, `.env` files, build output, or local database data.
- Summarize the final diff.
- Recommend a checkpoint before risky migrations.

## Completion report

End every implementation task with:

```text
Summary
Files changed
Behavior implemented
Tests added
Commands run and results
Documentation updated
Known limitations or follow-up
```

A task is not complete merely because code compiles.

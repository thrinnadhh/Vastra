# Vastra frontend Codex run order

These prompt packs execute the frozen-MVP frontend roadmap. They do not authorize
changes to product scope, backend contracts, RLS, or state machines.

## Operator entry point

Read `docs/design/frontend-implementation-guide.md` first. Select exactly one ticket
from `docs/design/frontend-ui-ux-sprint-roadmap.md` and provide that ID in the request.
A grouped prompt pack is context, not permission to implement all tickets in it.

## Read before every frontend ticket

- root `AGENTS.md` and the nearest nested `AGENTS.md`;
- `codex/prompts/frontend/00-master-frontend-contract.md`;
- the relevant grouped prompt pack below;
- `docs/design/frontend-ui-ux-sprint-roadmap.md`;
- `docs/design/frontend-screen-inventory.md` and `docs/design/navigation-map.md`;
- `docs/design/design-system.md` and `docs/design/frontend-visual-contract.md`;
- `docs/design/sprint-1-pre-delivery-checklist.md`;
- the smallest relevant canonical product/security/workflow/OpenAPI documents;
- the current implementation and feature tests that must be preserved.

## Prompt order

```text
00-master-frontend-contract.md
01-gates-visual-and-platform.md
02-customer-access-discovery-and-cod.md
03-operational-cod-slice.md
04-trust-payments-and-returns.md
05-operations-completion.md
06-style-and-closure.md
```

| Prompt | Ticket range |
|---|---|
| `01-gates-visual-and-platform.md` | `FE-G0-*`, `FE-S1R-*`, `FE-S02-*` |
| `02-customer-access-discovery-and-cod.md` | `FE-S03-*`, `FE-S04-*`, `FE-S05-*` |
| `03-operational-cod-slice.md` | `FE-S06-*`, `FE-S07-*`, `FE-S08-*` |
| `04-trust-payments-and-returns.md` | `FE-S09-*`, `FE-S10-*` |
| `05-operations-completion.md` | `FE-S11-*`, `FE-S12-*`, `FE-S13-*` |
| `06-style-and-closure.md` | `FE-S14-*`, `FE-S15-*`, `FE-S16-*` |

## Mandatory execution rules

1. Audit the selected capability and classify it `READY`, `CONTRACT-GAP`, or
   `PLATFORM-GAP` before implementation.
2. Run one ticket per branch/worktree and commit.
3. Preserve tested checkout/orders, merchant ringing/fulfilment, and captain delivery
   behavior while replacing temporary shells.
4. Do not build a visual mutation flow when its public API capability is missing.
5. Use one active owner for shared tokens, root navigation, route types, shared API
   types, and query/cache infrastructure.
6. Review the diff and run focused tests before broader applicable checks.
7. Do not claim device, provider, accessibility, E2E, or visual evidence unless it was
   actually produced.
8. Keep generated binaries/screenshots out of commits unless an approved evidence path
   requires them.
9. Use semantic design tokens; do not copy raw colours into screens.
10. Do not add production dependencies without approval.

## Branch and commit convention

```text
feat/ui-fe-s1r-01-semantic-colours
feat/ui-fe-s03-01-customer-routes
feat/ui-fe-s06-02-merchant-alert
```

```text
FE-S1R-01 feat(design): add semantic cosmic roles
FE-S03-01 feat(customer): add typed customer routes
FE-S06-02 feat(merchant): preserve urgent alert workflow
```

## Required ticket response

```text
Summary
Files changed
Behavior implemented
Routes/screens changed
API contracts consumed
Tests added
Commands run and results
Accessibility/performance evidence
Documentation updated
Known limitations or follow-up
```

## Applicable validation

Run the narrowest relevant tests during development, then the full applicable set
before completion:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm db:test
pnpm openapi:check
pnpm build
```

Use the exact scripts that exist. Never fabricate a result or silently rename a
missing command. Mobile/admin E2E, accessibility, visual regression, and physical
device checks are required only after their harnesses exist, but missing release
evidence remains explicit.

## First recommended run

Ask Codex to complete `FE-G0-01` as a documentation-only scope reconciliation. Then
continue Gate 0 in order. Do not start screen composition until Gate 0, S1R, S02, and
the relevant S03 foundation ticket are complete.

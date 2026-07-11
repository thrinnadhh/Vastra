# Vastra Codex Execution Pack

This pack tells Codex how to build Vastra safely and in the correct order.

## Where to place these files

Copy the contents of this pack into the root of the Vastra Git repository.

Expected result:

```text
vastra/
├── AGENTS.md
├── apps/
│   ├── backend/AGENTS.md
│   ├── customer-app/AGENTS.md
│   ├── merchant-app/AGENTS.md
│   ├── captain-app/AGENTS.md
│   └── admin-dashboard/AGENTS.md
├── packages/AGENTS.md
├── supabase/AGENTS.md
├── docs/AGENTS.md
├── .github/AGENTS.md
├── codex/
├── scripts/
└── docs/                  # From Vastra_Docs_Codex_Ready.zip
```

The earlier `Vastra_Docs_Codex_Ready.zip` must be extracted into the same repository so that these paths exist:

```text
docs/product/product-requirements.md
docs/product/mvp-scope.md
docs/product/business-rules.md
docs/workflows/order-state-machine.md
docs/architecture/system-architecture.md
docs/architecture/database-schema.md
docs/architecture/security-model.md
docs/api/openapi.yaml
docs/testing/acceptance-tests.md
docs/testing/release-checklist.md
```

## First execution

From the repository root:

```bash
git init
git add .
git commit -m "chore: add Vastra product and Codex instructions"
```

Verify that Codex reads the instructions:

```bash
codex --ask-for-approval never \
  "List the instruction files you loaded and summarize the five most important Vastra rules. Do not modify files."
```

Use `--ask-for-approval never` only for this read-only verification command. For implementation, use normal interactive permissions.

Then run the audit prompt:

```bash
codex
```

Paste the contents of:

```text
codex/prompts/00-repository-audit.md
```

Do not begin Sprint 1 until the repository audit and Sprint 0 both pass.

## Best-results rule

Never ask Codex to “build the whole Vastra app.” Give it one task, one module, one workflow, or one acceptance-test group at a time.

Use this sequence:

1. Repository audit
2. Sprint 0 foundation
3. Supabase foundation
4. Authentication and roles
5. Catalogue and inventory
6. Customer discovery and cart
7. Wardrobe MVP
8. Group Style MVP
9. Order vertical slice
10. Merchant ringing alerts
11. Captain delivery
12. Admin operations
13. Payments, returns, and settlements
14. Hardening and pilot release

Read `codex/RUN_ORDER.md` before starting.

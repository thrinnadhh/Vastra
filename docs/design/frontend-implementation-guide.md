# Vastra frontend implementation guide

Status: operator runbook
Last reviewed: 2026-07-20

## Start here

Use this order every time:

1. Open `docs/design/frontend-ui-ux-sprint-roadmap.md` and select the first unblocked
   ticket.
2. Check the ticket's screen/actions in `docs/design/frontend-screen-inventory.md` and
   `docs/design/navigation-map.md`.
3. Read `codex/prompts/frontend/00-master-frontend-contract.md` plus the prompt pack
   containing that ticket.
4. Verify the required API in `docs/api/openapi.yaml` and the implementation/tests.
5. Mark the ticket `READY`, `CONTRACT-GAP`, or `PLATFORM-GAP` before asking for code.
6. Create one branch/worktree, implement one ticket, run checks, review, and commit.
7. Merge only after the ticket evidence and documentation are complete.

Do not begin with “build the frontend.” Begin with `FE-G0-01` and move through the
gates. The shortest safe route to a pilot is the customer COD vertical slice, then
merchant, captain, and admin—not Wardrobe or social/style features first.

## Best execution sequence

### Phase A — remove ambiguity

Run Gate 0 in order:

```text
FE-G0-01 scope reconciliation
FE-G0-02 API coverage ledger
FE-G0-03 navigation decision
FE-G0-04 query/cache decision
FE-G0-05 visual contract approval
FE-G0-06 test-platform plan
```

Gate 0 outputs are decisions and backend/platform tickets, not production screens.

### Phase B — freeze shared foundations

```text
FE-S1R-01 → FE-S1R-05
FE-S02-01 → FE-S02-06
FE-S03-01 → FE-S03-07
```

Keep a single owner for tokens, route types, root navigation, shared API types, and the
query/cache layer. Preserve existing customer checkout/orders, merchant alert, and
captain delivery tests while replacing temporary shells.

### Phase C — prove the MVP transaction

```text
FE-S04 discovery/product
→ FE-S05 customer COD
→ FE-S06 merchant fulfilment
→ FE-S07 captain delivery
→ FE-S08 admin recovery
```

This is the first pilot checkpoint. Do not describe the frontend as MVP-ready before
this chain passes with real device/browser evidence.

### Phase D — complete frozen scope

After the COD checkpoint, schedule independent ready tickets from:

- `FE-S09-*` customer trust/account;
- `FE-S10-*` online payment, returns, refunds, and finance;
- `FE-S11-*` merchant catalogue/inventory/operations;
- `FE-S12-*` captain onboarding/earnings/support;
- `FE-S13-*` admin completion;
- `FE-S14-*` Wardrobe and saved looks;
- `FE-S15-*` private Group Style rooms after its backend gate;
- `FE-S16-*` closure and release evidence.

## Prompt navigation

| Ticket range | Prompt pack |
|---|---|
| All frontend tickets | `codex/prompts/frontend/00-master-frontend-contract.md` |
| `FE-G0-*`, `FE-S1R-*`, `FE-S02-*` | `codex/prompts/frontend/01-gates-visual-and-platform.md` |
| `FE-S03-*`, `FE-S04-*`, `FE-S05-*` | `codex/prompts/frontend/02-customer-access-discovery-and-cod.md` |
| `FE-S06-*`, `FE-S07-*`, `FE-S08-*` | `codex/prompts/frontend/03-operational-cod-slice.md` |
| `FE-S09-*`, `FE-S10-*` | `codex/prompts/frontend/04-trust-payments-and-returns.md` |
| `FE-S11-*`, `FE-S12-*`, `FE-S13-*` | `codex/prompts/frontend/05-operations-completion.md` |
| `FE-S14-*`, `FE-S15-*`, `FE-S16-*` | `codex/prompts/frontend/06-style-and-closure.md` |

Always give Codex one explicit ticket ID. A prompt pack is context, not a request to
implement every ticket in the file.

## Example ticket request

```text
Implement FE-S05-04, COD placement, only.

First audit the existing customer checkout/session implementation and the OpenAPI
contract. Preserve existing behavior and tests. Restate the task boundary, acceptance
criteria, and expected files before editing.

Acceptance:
- server quote and payable amount remain authoritative;
- placement uses the approved idempotency contract;
- duplicate taps cannot create duplicate orders;
- success navigates with the server-returned order ID;
- timeout/unknown and retry states are truthful;
- loading, recoverable error, offline/session, and accessibility states exist;
- focused tests and applicable repository checks pass;
- no address, payment, or state-machine contract is invented.
```

## Branch and commit convention

Use a dedicated worktree when another ticket is active.

```text
Branch: feat/ui-fe-s05-04-cod-placement
Commit: FE-S05-04 feat(customer): harden COD placement
```

For a gate or documentation ticket:

```text
Branch: docs/ui-fe-g0-02-api-ledger
Commit: FE-G0-02 docs(frontend): map API readiness
```

Do not mix multiple sprint tickets in one commit merely because they touch the same
application. Shared-foundation tickets should land before their consumers.

## Per-ticket operating loop

1. `git status -sb`; stop if unrelated changes overlap.
2. Copy `codex/TASK_TEMPLATE.md` into the task request and fill one ticket.
3. Ask for a read-only audit when the capability or contract status is uncertain.
4. Record sources read, acceptance criteria, and files expected to change.
5. Implement the smallest coherent change and add/update tests.
6. Run narrow tests, then all applicable repository checks.
7. Review `git diff`, `git diff --check`, generated files, and package changes.
8. Update OpenAPI/docs when behavior changed; never hide a contract gap in the UI.
9. Commit the ticket and attach real evidence only.
10. Update the tracking issue/board with `DONE`, `BLOCKED`, or the next ticket.

## How to handle a blocked ticket

| Finding | Correct next action |
|---|---|
| OpenAPI action missing | Create/complete a backend contract ticket; do not build the mutation UI |
| Controller exists but OpenAPI is absent | Reconcile OpenAPI, generated types, auth, errors, and tests first |
| OpenAPI exists but backend/migration/RLS is absent | Complete the backend vertical slice first |
| UI requires a new domain status | Stop and resolve business rules/state machine before UI work |
| Visual asset is missing | Use the manifest/placeholder boundary; do not fabricate production art |
| Shared route/token/API file has another owner | Wait or re-scope to an independent feature |
| External device/provider evidence unavailable | Complete automatable work, report the missing evidence, and do not claim passage |

## Safe parallel work

Parallelize only after `FE-S03` freezes shared contracts.

Safe examples:

- customer read-only discovery and independent merchant catalogue components;
- captain feature screens and admin read-only pages;
- Wardrobe feature UI and unrelated operational tests;
- documentation/API ledger work and an independent, already-contracted screen.

Unsafe examples:

- two tickets changing customer root navigation;
- two tickets changing semantic token names;
- UI and backend independently editing the same API contract;
- multiple tickets changing order statuses or shared API types;
- Group Style UI before its backend/RLS contract is complete.

## Navigation by question

| Question | Open this file first |
|---|---|
| Is this in MVP? | `docs/product/mvp-scope.md` |
| Is this action allowed? | `docs/product/business-rules.md` |
| Is this order transition valid? | `docs/workflows/order-state-machine.md` |
| Can this role see/do it? | `docs/architecture/security-model.md` |
| What request/response exists? | `docs/api/openapi.yaml` |
| Which screen owns it? | `docs/design/frontend-screen-inventory.md` |
| Where does the route live? | `docs/design/navigation-map.md` |
| How should it look/behave? | `docs/design/frontend-visual-contract.md` |
| Which ticket comes next? | `docs/design/frontend-ui-ux-sprint-roadmap.md` |
| Which prompt should I run? | this guide and `codex/prompts/frontend/README.md` |

## Checkpoint definitions

### Foundation checkpoint

Gate 0, S1R, S02, and S03 pass; shared contracts are frozen; current flows remain green.

### COD pilot checkpoint

S04–S08 pass as a connected customer/merchant/captain/admin journey with real evidence.

### MVP capability checkpoint

All unblocked frozen-scope tickets in S09–S15 pass; every blocked/deferred item has an
approved disposition.

### Release checkpoint

S16 evidence, applicable CI/builds, accessibility, privacy, error recovery, device
coverage, and defect review support an honest go/no-go decision.

## Avoid these shortcuts

- Do not add Couple or event-based Group flows to the MVP.
- Do not add a sixth customer bottom tab.
- Do not call private database tables directly to compensate for a missing public API.
- Do not replace server totals, inventory, delivery, payment, or status truth locally.
- Do not rewrite working merchant/captain safety behavior for visual consistency.
- Do not start the customer website until an approved scope change funds it.

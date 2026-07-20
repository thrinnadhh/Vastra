# Codex Task

## Task title

[One focused feature, endpoint, migration, screen, test group, or bug]

## Ticket and readiness

- Ticket ID: [for example `FE-S05-04`]
- Classification: [READY / CONTRACT-GAP / PLATFORM-GAP]
- Blocking dependency: [none or exact ticket/contract]

## Work directory

[Example: apps/backend]

## Read before work

- `docs/...`
- `AGENTS.md`
- nearest nested `AGENTS.md`

## Objective

[One measurable outcome]

## In scope

- ...
- ...

## Out of scope

- ...
- ...

## Acceptance criteria

1. ...
2. ...
3. ...

## Required tests

- Unit:
- Integration:
- Authorization/RLS:
- Concurrency:
- UI/device:
- Contract:

## Contracts consumed or changed

- OpenAPI operation(s):
- Shared/generated type(s):
- State-machine/business-rule impact:

## Constraints

- Do not modify unrelated files.
- Do not add production dependencies without approval.
- Do not change API contract unless explicitly included.
- Do not expose secrets.
- Preserve backward compatibility unless approved.

## Required commands

```bash
[relevant narrow tests]
pnpm lint
pnpm typecheck
[relevant broader checks]
```

## Completion response

Report:

- Summary
- Files changed
- Tests added
- Commands and results
- Documentation updated
- Contracts consumed or changed
- Risks or follow-up

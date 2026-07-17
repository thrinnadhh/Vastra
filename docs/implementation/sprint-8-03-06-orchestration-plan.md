---
sprint: 8
scope: S8-03..S8-06
status: in-progress
orchestrator: S8-03
---

# Sprint 8 S8-03 through S8-06 Orchestration Plan

## Orchestrator decision

S8-03 is the orchestrator ticket because it owns the authoritative forward-delivery task,
verification-secret lifecycle, dispatch-start idempotency, and the transactional event consumed
by later dispatch work.

Dependency order:

```text
S8-03 task + secret hardening
  -> S8-04 offer waves + expiry
  -> S8-05 exclusive acceptance + manual fallback
  -> S8-06 active delivery read + pickup arrival journey
```

## Parallel workstreams

### Workstream A — S8-03 orchestration foundation

- harden forward task creation and safe replay
- create hashed pickup and delivery secrets without exposing raw values to captains
- preserve canonical order/task history and outbox events
- expose merchant/customer secret reads only to their authorised owners
- provide the internal search-start contract consumed by S8-04

### Workstream B — S8-04 offer engine

- select captains from the S8-02 dispatch-readiness projection
- generate bounded nearby offer waves
- expire offers safely and return exhausted tasks to searching
- expand radius using configuration rather than contract constants
- enqueue offer-created, rejected, and expired events

### Workstream C — S8-05 ownership transaction

- accept one unexpired offer under canonical lock order
- cancel competing offers atomically
- prevent a captain from owning two active forward tasks
- support audited operations-only manual assignment fallback
- preserve idempotent replay and stable conflict codes

### Workstream D — S8-06 pickup journey

- read the captain's active delivery and visible offered task
- provide safe shop/order/navigation facts without verification secrets
- declare merchant arrival under idempotency and proximity checks
- move order, task, assignment, captain, histories, and events atomically
- add captain-app offer/active-delivery/pickup navigation surfaces

## Integration rules

- S8-03 owns lifecycle orchestration and shared database lock order.
- S8-04 may create offers but never assign ownership.
- S8-05 is the only offer-to-accepted ownership transition.
- S8-06 consumes an accepted assignment and never bypasses S8-05.
- Raw pickup codes and delivery OTPs never appear in captain APIs, logs, histories, or outbox payloads.
- Pricing, payout, COD completion, pickup-code verification, and customer tracking remain outside this scope.

## Merge gate

The integrated branch must pass formatting, environment validation, lint, typecheck, unit tests,
integration tests, Supabase migrations and pgTAP, database concurrency checks and advisors,
OpenAPI validation, and production build before any ticket is called complete.

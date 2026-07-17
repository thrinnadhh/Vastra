---
project: Vastra
sprint: 6
ticket: S6-10
status: Implemented; database execution pending local infrastructure
last_updated: 2026-07-17
---

# Sprint 6 COD Order Acceptance Evidence

## Delivered boundary

Sprint 6 now provides the mobile integration for the backend-owned COD order lifecycle:

```text
customer checkout quote
→ idempotent COD placement
→ authoritative confirmation
→ customer order list and history
→ merchant queue and decision
→ packing-list verification
→ READY_FOR_PICKUP
```

The implementation stops at `READY_FOR_PICKUP`. Merchant ringing, captain assignment, pickup,
delivery, online payments, returns, and Group Style remain outside Sprint 6.

## Ticket evidence

| Ticket | Commit subject | Evidence |
|---|---|---|
| S6-03 | `feat(customer): place idempotent COD orders` | Stable placement key, duplicate-submit guard, same-key retry, stale-quote recovery, strict response parsing |
| S6-04 | `feat(customer): add order confirmation` | Immutable backend snapshots, COD total, real order number/status/time, view-order and continue-shopping actions |
| S6-05 | `feat(customer): add orders list` | Authenticated opaque-cursor pagination, active/past grouping, deduplication, refresh, stale/offline states |
| S6-06 | `feat(customer): add order details timeline` | Owned order detail, immutable snapshots, backend-provided history only, cross-customer denial handling |
| S6-07 | `feat(merchant): add incoming order queue` | Merchant-only session restoration, queue/detail reads, polling/manual refresh, grouping and recovery states |
| S6-08 | `feat(merchant): handle order decisions` | Accept 1–240 minutes, `reasonCode` rejection, `OTHER` note requirement, duplicate-submit guard and safe replay handling |
| S6-09 | `feat(merchant): complete order packing flow` | Start packing, durable checklist, manual/barcode verification, mismatch handling, verified-only ready action and stable ready key |
| S6-10 | `test(orders): validate COD vertical slice` | Cross-screen customer and merchant journeys, contract corrections, `/v1` bootstrap alignment and repository-wide verification |

## Authoritative status history

Clients render the history returned by the backend. They do not synthesize missing states or mark
future steps complete. The customer journey proof renders this real sequence through the Sprint 6
boundary:

```text
null → PAYMENT_PENDING
PAYMENT_PENDING → WAITING_FOR_MERCHANT
WAITING_FOR_MERCHANT → MERCHANT_ACCEPTED
MERCHANT_ACCEPTED → PACKING
PACKING → READY_FOR_PICKUP
```

Item verification creates durable verification evidence but does not invent an order-status
transition.

## Replay and concurrency evidence

- Placement generates one UUID for an attempt and reuses it after an unknown-result transport or
  retryable server failure.
- Duplicate placement taps are blocked while the request is in flight.
- Quote refresh is blocked while placement is unresolved; an expired quote can still replay the
  same attempt key before any new placement attempt is created.
- Merchant decisions use the backend's state-and-identical-payload replay contract.
- Merchant queue polling is serialized after each response and pauses while an order detail is
  open, preventing overlapping slow-network requests.
- Ready-for-pickup keeps one UUID across retryable failures and is disabled until all lines are
  verified.
- `supabase/tests/0029_customer_cod_order_placement.test.sql` proves order placement history,
  reservations, idempotency and transactional outbox behavior.
- `supabase/tests/0033_merchant_order_packing.test.sql` proves packing and verification history,
  replay and mismatch behavior.
- `supabase/tests/0034_merchant_ready_for_pickup.test.sql` proves verified-only readiness and
  non-duplicated history/outbox behavior.
- `scripts/run-db-concurrency-tests.sh` races two last-unit COD placements and asserts exactly one
  successful order, reservation, reserved unit and `order.placed` event.

## Contract corrections

The S6-10 audit aligned OpenAPI with the already-shipped backend behavior:

- merchant rejection uses `reasonCode`, not `issueType`;
- merchant preparation time is 1–240 minutes;
- accept/reject do not advertise an unused `Idempotency-Key` header;
- accept/reject success responses now document the authoritative decision result; and
- the backend bootstrap serves the documented and mobile-configured `/v1` prefix.

## Verification record

| Check | Result |
|---|---|
| Formatting, lint and repository hygiene | Passed |
| TypeScript | 11/11 workspaces passed |
| Unit tests | Passed, including 373 backend, 76 customer and 34 merchant tests |
| Backend integration tests | 41 files, 154 tests passed |
| OpenAPI | Valid |
| Production build | 11/11 workspaces passed |
| React/React Native review | Critical/high findings corrected; no hook-rule blocker |

The runner uses Node 24 with the repository's exact pnpm 8.15.0 and a local engine-check override;
the repository remains pinned to Node 20.20.2 for the user's machine. The same gates should be
rerun under the pinned Node version before merging.

`pnpm db:test` must be rerun locally because this runner has no Docker, Supabase CLI or `psql`.
That command resets the local Supabase database, runs migrations and pgTAP, executes the real
last-unit concurrency race, and runs database advisors.

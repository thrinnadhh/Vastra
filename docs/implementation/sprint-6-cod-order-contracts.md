---
project: Vastra
sprint: 6
ticket: S6-01
status: Frozen
last_updated: 2026-07-16
---

# Sprint 6 COD Order Contract Freeze

## Decision

Sprint 5C Group Style and automatic garment recognition are deferred. Sprint 6 is the
next active delivery sprint.

The goal is not to rebuild order services. The backend already exposes the main COD
order lifecycle. The remaining work is primarily customer-app and merchant-app
integration plus end-to-end hardening.

## Endpoint matrix

| Actor | Method | Path | Sprint 6 purpose |
|---|---|---|---|
| Customer | POST | `/checkout/quote` | Refresh authoritative checkout totals and availability |
| Customer | POST | `/orders` | Place COD order with `Idempotency-Key` |
| Customer | GET | `/orders` | List only the authenticated customer's orders |
| Customer | GET | `/orders/:orderId` | Read one owned order and real history |
| Merchant | GET | `/merchant/orders` | List only the authenticated merchant shop's orders |
| Merchant | GET | `/merchant/orders/:orderId` | Read one shop-owned order |
| Merchant | POST | `/merchant/orders/:orderId/accept` | Accept with preparation information |
| Merchant | POST | `/merchant/orders/:orderId/reject` | Reject with reason |
| Merchant | POST | `/merchant/orders/:orderId/start-packing` | Enter packing when allowed |
| Merchant | GET | `/merchant/orders/:orderId/packing-list` | Read immutable ordered-item checklist |
| Merchant | POST | `/merchant/orders/:orderId/items/:orderItemId/verify` | Verify an ordered item |
| Merchant | POST | `/merchant/orders/:orderId/ready-for-pickup` | Idempotently mark fully packed order ready |

Existing endpoint reserved for Sprint 7 mobile behaviour:

| Actor | Method | Path | Boundary |
|---|---|---|---|
| Merchant | POST | `/merchant/order-alerts/:alertId/acknowledge` | Backend acknowledgement exists; repeating ringtone/push escalation remains Sprint 7 |

## Backend ownership

The backend remains authoritative for:

- cart/shop consistency
- live product and variant availability
- checkout quote and totals
- inventory locking and reservation
- immutable order, item, shop, address, and price snapshots
- order state transitions
- status history
- outbox records
- merchant ownership
- customer ownership
- idempotency and concurrency

Mobile applications own only presentation, authenticated API calls, input collection,
navigation, and resilient user states.

## Status and history rule

Clients render the status and history returned by the backend. They must not infer a
complete timeline from the current status or show future steps as completed.

Every backend mutation ticket must preserve:

- allowed transition validation
- ownership validation
- transactional history
- transactional outbox where required
- duplicate-request safety

## Sprint boundaries

Sprint 6 ends at merchant `READY_FOR_PICKUP` and customer visibility of that state.

Deferred:

- Sprint 7: merchant ringing, push escalation, and alert UX
- Sprint 8: captain assignment, pickup, COD collection, delivery, and tracking
- Sprint 9: admin operational controls
- Sprint 10: online payments, returns, refunds, and settlements
- Later: Group Style and automatic garment recognition

## Ticket order

1. S6-01 — Contract audit and sprint setup
2. S6-02 — Customer checkout quote integration
3. S6-03 — Idempotent COD order placement
4. S6-04 — Customer order confirmation
5. S6-05 — Customer orders list
6. S6-06 — Customer order details and history
7. S6-07 — Merchant incoming-order queue
8. S6-08 — Merchant accept or reject
9. S6-09 — Merchant packing and ready-for-pickup
10. S6-10 — End-to-end hardening

## S6-01 exit criteria

- All endpoint signatures in the matrix exist.
- The Sprint 6 prompt contains the frozen scope, invariants, and ten ordered tickets.
- Group Style and image recognition are explicitly deferred.
- Sprint 7 and Sprint 8 responsibilities are not pulled into Sprint 6.
- Documentation formatting and OpenAPI checks pass.
- No runtime code changes are included.

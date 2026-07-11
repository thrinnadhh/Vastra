---
project: Vastra
version: 1.0
status: Frozen MVP
last_updated: 2026-07-11
---

# Order State Machine

## 1. Primary states

```text
PAYMENT_PENDING
WAITING_FOR_MERCHANT
MERCHANT_ACCEPTED
PACKING
READY_FOR_PICKUP
CAPTAIN_SEARCHING
CAPTAIN_ASSIGNED
CAPTAIN_AT_STORE
PICKED_UP
OUT_FOR_DELIVERY
CAPTAIN_AT_CUSTOMER
DELIVERED
COMPLETED
PROBLEM_REPORTED
CANCELLED
```

## 2. Allowed transitions

| Current state | Allowed next states |
|---|---|
| PAYMENT_PENDING | WAITING_FOR_MERCHANT, CANCELLED |
| WAITING_FOR_MERCHANT | MERCHANT_ACCEPTED, CANCELLED, PROBLEM_REPORTED |
| MERCHANT_ACCEPTED | PACKING, PROBLEM_REPORTED, CANCELLED |
| PACKING | READY_FOR_PICKUP, PROBLEM_REPORTED, CANCELLED |
| READY_FOR_PICKUP | CAPTAIN_SEARCHING, CAPTAIN_ASSIGNED, CANCELLED |
| CAPTAIN_SEARCHING | CAPTAIN_ASSIGNED, PROBLEM_REPORTED, CANCELLED |
| CAPTAIN_ASSIGNED | CAPTAIN_AT_STORE, CAPTAIN_SEARCHING, PROBLEM_REPORTED, CANCELLED |
| CAPTAIN_AT_STORE | PICKED_UP, CAPTAIN_SEARCHING, PROBLEM_REPORTED, CANCELLED |
| PICKED_UP | OUT_FOR_DELIVERY, PROBLEM_REPORTED |
| OUT_FOR_DELIVERY | CAPTAIN_AT_CUSTOMER, PROBLEM_REPORTED |
| CAPTAIN_AT_CUSTOMER | DELIVERED, PROBLEM_REPORTED |
| DELIVERED | COMPLETED, PROBLEM_REPORTED |
| PROBLEM_REPORTED | Any approved recovery state, CANCELLED |
| COMPLETED | Terminal |
| CANCELLED | Terminal |

## 3. Transition requirements

Every transition must:

1. Lock the order.
2. Validate current state.
3. Validate actor and permission.
4. Validate required side effects.
5. Update state atomically.
6. Insert status-history row.
7. Insert domain event/outbox row.
8. Commit.
9. Deliver notifications asynchronously.
10. Audit admin overrides.

## 4. Key actor permissions

| Transition | Actor |
|---|---|
| PAYMENT_PENDING → WAITING_FOR_MERCHANT | Payment/order service |
| WAITING_FOR_MERCHANT → MERCHANT_ACCEPTED | Merchant |
| MERCHANT_ACCEPTED → PACKING | Merchant |
| PACKING → READY_FOR_PICKUP | Merchant |
| READY_FOR_PICKUP → CAPTAIN_SEARCHING | Dispatch service |
| CAPTAIN_SEARCHING → CAPTAIN_ASSIGNED | Captain/Operations |
| CAPTAIN_ASSIGNED → CAPTAIN_AT_STORE | Captain |
| CAPTAIN_AT_STORE → PICKED_UP | Captain after pickup code |
| PICKED_UP → OUT_FOR_DELIVERY | Captain/service |
| OUT_FOR_DELIVERY → CAPTAIN_AT_CUSTOMER | Captain |
| CAPTAIN_AT_CUSTOMER → DELIVERED | Captain after OTP |
| DELIVERED → COMPLETED | Completion service |
| Any → CANCELLED | Policy service or authorized admin |

## 5. Idempotency

A repeated valid command must return the original result or current state without duplicating side effects.

Examples:

- Repeated order placement
- Repeated merchant acceptance
- Repeated pickup confirmation
- Repeated delivery completion
- Repeated webhook
- Repeated refund creation

## 6. Recovery

`PROBLEM_REPORTED` requires a problem record with:

- Problem type
- Actor
- Timestamp
- Current location when relevant
- Note
- Evidence
- Resolution status
- Resolution actor

The order may leave `PROBLEM_REPORTED` only through a documented recovery command.

---
ticket: S8-01
sprint: 8
status: frozen
scope: forward-cod-delivery
---

# Sprint 8 Captain Delivery Contract Freeze

## Decision

Sprint 8 completes the MVP forward-delivery journey after a merchant marks an order
`READY_FOR_PICKUP`.

Sprint 8 owns:

- captain availability and current location,
- forward-delivery task creation and search,
- expiring captain offers,
- exclusive acceptance and manual assignment fallback,
- shop arrival and pickup-code verification,
- customer tracking,
- customer arrival,
- exact COD collection,
- delivery-OTP verification,
- idempotent delivery completion,
- delivery failure reporting,
- per-task captain earnings.

Sprint 8 does not own:

- product pricing, merchant margin, commission, or discount strategy,
- online-payment capture,
- merchant bank settlement execution,
- captain bank payout execution,
- returns, exchanges, or reverse logistics,
- route optimisation across multiple orders,
- batched deliveries,
- customer pickup,
- automatic post-pickup reassignment.

The authoritative COD amount is always `orders.total_paise`. A captain, merchant,
customer, or client application cannot recalculate or modify it during delivery.

## Existing foundation

The repository already provides:

- `delivery_tasks`, `delivery_assignments`, `captain_current_locations`,
  `captain_location_history`, `delivery_events`, and `cod_collections`,
- one active forward-delivery task per order,
- one accepted assignment per delivery task,
- a concurrency-safe assignment acceptance function,
- a service-role dispatch-start function that moves an eligible order from
  `READY_FOR_PICKUP` to `CAPTAIN_SEARCHING`,
- append-only order and delivery histories,
- service-role-only delivery writes.

Sprint 8 extends these foundations. It does not replace them with a second dispatch
or tracking model.

## Frozen lifecycle

### Order lifecycle

The forward COD delivery path is:

```text
READY_FOR_PICKUP
  -> CAPTAIN_SEARCHING
  -> CAPTAIN_ASSIGNED
  -> CAPTAIN_AT_STORE
  -> PICKED_UP
  -> OUT_FOR_DELIVERY
  -> CAPTAIN_AT_CUSTOMER
  -> DELIVERED
```

`DELIVERED` is the terminal successful order state for Sprint 8.

`COMPLETED` is not entered by Sprint 8. It remains reserved for a later financial,
returns-window, or operational close policy.

Allowed recovery transitions are:

```text
CAPTAIN_ASSIGNED -> CAPTAIN_SEARCHING
CAPTAIN_AT_STORE -> CAPTAIN_SEARCHING

CAPTAIN_SEARCHING -> PROBLEM_REPORTED
CAPTAIN_ASSIGNED -> PROBLEM_REPORTED
CAPTAIN_AT_STORE -> PROBLEM_REPORTED
PICKED_UP -> PROBLEM_REPORTED
OUT_FOR_DELIVERY -> PROBLEM_REPORTED
CAPTAIN_AT_CUSTOMER -> PROBLEM_REPORTED
```

A captain release before verified pickup does not cancel the order. It releases the
accepted assignment and returns the order to `CAPTAIN_SEARCHING`.

After verified pickup, captain self-release and automatic reassignment are forbidden.
A post-pickup problem creates an immutable problem event and moves the order to
`PROBLEM_REPORTED`; operations must resolve custody explicitly.

### Delivery-task lifecycle

The forward task path is:

```text
CREATED
  -> SEARCHING
  -> OFFERED
  -> ASSIGNED
  -> AT_PICKUP
  -> PICKED_UP
  -> IN_TRANSIT
  -> AT_DROP
  -> COMPLETED
```

Rules:

- `CREATED` is an internal transient state.
- `SEARCHING` means no captain owns the task.
- `OFFERED` means one or more unexpired offers exist, but no captain owns the task.
- `ASSIGNED` means exactly one captain owns the task.
- `AT_PICKUP` requires the assigned captain to be at the merchant location.
- `PICKED_UP` requires successful pickup-code verification.
- `IN_TRANSIT` means the verified package has left the shop.
- `AT_DROP` means the captain has declared arrival at the customer location.
- `COMPLETED` requires successful COD and delivery-OTP verification.
- `FAILED` and `CANCELLED` are terminal task states.

A task may return from `OFFERED` to `SEARCHING` when all current offers expire,
are rejected, or are cancelled.

A task may return from `ASSIGNED` or `AT_PICKUP` to `SEARCHING` only through an
audited pre-pickup release or reassignment transaction.

### Assignment lifecycle

```text
OFFERED -> ACCEPTED -> COMPLETED
OFFERED -> REJECTED
OFFERED -> TIMED_OUT
OFFERED -> CANCELLED
ACCEPTED -> RELEASED
```

Rules:

- One task may have many historical assignments.
- One task may have only one `ACCEPTED` assignment.
- One captain may have only one active accepted forward-delivery assignment in the MVP.
- Accepting one offer cancels every competing open offer in the same transaction.
- An expired offer cannot be accepted.
- Repeating the same accepted request safely returns the original result.

### Captain availability lifecycle

The client may request only:

```text
OFFLINE
AVAILABLE
ON_BREAK
```

The backend owns these operational states:

```text
OFFERED
ASSIGNED
AT_PICKUP
DELIVERING
SUSPENDED
```

Mapping:

| Delivery condition | Captain status |
| --- | --- |
| Signed out, permission unavailable, or manually offline | `OFFLINE` |
| Dispatch eligible and no active task | `AVAILABLE` |
| At least one active offer and no accepted task | `OFFERED` |
| Accepted task before store arrival | `ASSIGNED` |
| Assigned task at merchant | `AT_PICKUP` |
| Pickup verified through successful completion | `DELIVERING` |
| Explicit break with no active task | `ON_BREAK` |
| Operations suspension | `SUSPENDED` |

A client request cannot overwrite a backend-owned state while an active assignment
or package custody exists.

## Order-to-task state mapping

| Order state | Delivery-task state | Required assignment state |
| --- | --- | --- |
| `READY_FOR_PICKUP` | none | none |
| `CAPTAIN_SEARCHING` | `SEARCHING` or `OFFERED` | no accepted assignment |
| `CAPTAIN_ASSIGNED` | `ASSIGNED` | exactly one `ACCEPTED` |
| `CAPTAIN_AT_STORE` | `AT_PICKUP` | exactly one `ACCEPTED` |
| `PICKED_UP` | `PICKED_UP` | exactly one `ACCEPTED` |
| `OUT_FOR_DELIVERY` | `IN_TRANSIT` | exactly one `ACCEPTED` |
| `CAPTAIN_AT_CUSTOMER` | `AT_DROP` | exactly one `ACCEPTED` |
| `DELIVERED` | `COMPLETED` | accepted assignment marked `COMPLETED` |

A successful transaction must never commit one side of this mapping without the
other side.

## Dispatch eligibility

A captain is eligible for a new offer only when all are true:

- the account type is `CAPTAIN`,
- the profile is active,
- captain KYC is verified and approval exists,
- availability is `AVAILABLE`,
- no active accepted delivery assignment exists,
- a current Android device registration is available for push,
- current location is not older than 120 seconds,
- reported accuracy is no worse than 100 metres,
- no active delivery task is attached to the current-location row,
- the captain is not suspended or on break.

MVP dispatch defaults are configuration, not hard-coded business constants:

- initial pickup radius: 2 kilometres,
- radius expansion: 2 kilometres per wave,
- maximum pickup radius: 8 kilometres,
- captains per offer wave: 3,
- offer lifetime: 30 seconds,
- wave interval: 30 seconds.

Changing these values does not change API contracts or lifecycle semantics.

## Location contract

During an active assignment, the captain app should attempt a location update every
10 seconds. The backend may rate-limit accepted writes to one update per 5 seconds.

Rules:

- latitude must be between -90 and 90,
- longitude must be between -180 and 180,
- accuracy must be non-negative,
- timestamps more than 30 seconds in the future are rejected,
- stale client timestamps do not replace a newer current-location row,
- durable history is sampled at most once per 30 seconds unless movement exceeds
  100 metres or a lifecycle event requires an exact location,
- customer tracking reports `stale: true` after 30 seconds without an accepted update,
- location access ends immediately after terminal task completion, cancellation, or
  an authorised operations resolution,
- no unrelated customer, merchant, or captain can read a captain location.

Location updates are not emitted as one transactional outbox event per GPS sample.
Lifecycle events carry the exact location when operationally required.

## Pickup and delivery secrets

The pickup code and delivery OTP are short-lived bearer secrets.

Rules:

- only a one-way hash is stored,
- raw codes are never written to logs, analytics, histories, or outbox payloads,
- the pickup code is visible only to authorised merchant users for the owning shop,
- the delivery OTP is visible only to the owning customer,
- the captain never receives either secret through a read API,
- verification uses constant-time comparison,
- each secret allows at most five failed attempts per task,
- the sixth attempt is blocked and requires an operations review,
- a successful verification cannot be repeated to create duplicate side effects,
- pickup verification is invalid after task completion, cancellation, or failure,
- delivery OTP verification is valid only in `AT_DROP` with the expected COD amount.

## COD and successful completion transaction

A successful completion request contains:

- delivery task ID from the route,
- `collectedAmountPaise`,
- delivery OTP,
- optional final location,
- an `Idempotency-Key` header.

The backend must atomically:

1. Authorise the assigned captain.
2. Lock the order, delivery task, accepted assignment, captain profile,
   COD collection, and captain earning in the canonical order.
3. Confirm task state is `AT_DROP` and order state is `CAPTAIN_AT_CUSTOMER`.
4. Confirm `collectedAmountPaise = orders.total_paise`.
5. Confirm the order payment state is `COD_PENDING` or an exact safe replay of
   `COD_COLLECTED`.
6. Verify the delivery OTP.
7. Create or safely replay exactly one `cod_collections` row for the order.
8. Mark COD as `COLLECTED` and the order payment state as `COD_COLLECTED`.
9. Mark the delivery task `COMPLETED`.
10. Mark the accepted assignment `COMPLETED`.
11. Move the order to `DELIVERED`.
12. Create exactly one captain-earning row for the delivery task.
13. Increment the captain completed-delivery counter exactly once.
14. Add collected COD to the captain cash-liability balance exactly once.
15. Clear the active delivery task from the current-location row.
16. Return the captain to `AVAILABLE` unless an operations-controlled state applies.
17. Append delivery and order history.
18. Enqueue the frozen completion outbox events.

Any failure rolls back the entire transaction.

The captain earning is separate from collected cash. A captain does not deduct their
earning from COD at the doorstep.

## Canonical lock order

Lifecycle transactions lock only the rows they need, but always in this relative order:

1. `orders`,
2. `delivery_tasks`,
3. `delivery_assignments` ordered by ID,
4. `captain_profiles` ordered by user ID,
5. `cod_collections`,
6. `captain_earnings`.

Order items may be locked immediately after the order and before the delivery task when
package integrity must be checked.

This lock order is mandatory for acceptance, release, pickup, COD, and completion
implementations to avoid cross-flow deadlocks.

## HTTP endpoint matrix

All endpoints are under `/v1` and require bearer authentication unless explicitly
marked internal.

### Captain

| Method | Path | Purpose | Idempotency |
| --- | --- | --- | --- |
| `PUT` | `/captain/me/availability` | Request `AVAILABLE`, `OFFLINE`, or `ON_BREAK` | Set-state replay safe |
| `PUT` | `/captain/me/location` | Upsert current location and optional active-task sample | Client `sampleId` dedupe |
| `GET` | `/captain/delivery-offers` | List unexpired offers owned by the captain | Read |
| `POST` | `/captain/delivery-offers/{assignmentId}/accept` | Exclusively accept an offer | Required |
| `POST` | `/captain/delivery-offers/{assignmentId}/reject` | Reject an open offer with an allowed reason | Required |
| `GET` | `/captain/deliveries/active` | Read the captain's active task | Read |
| `GET` | `/captain/deliveries/{taskId}` | Read an offered or assigned task visible to the captain | Read |
| `POST` | `/captain/deliveries/{taskId}/arrive-pickup` | Declare arrival at merchant | Required |
| `POST` | `/captain/deliveries/{taskId}/verify-pickup` | Verify merchant pickup code | Required |
| `POST` | `/captain/deliveries/{taskId}/depart-pickup` | Start customer delivery | Required |
| `POST` | `/captain/deliveries/{taskId}/arrive-drop` | Declare arrival at customer | Required |
| `POST` | `/captain/deliveries/{taskId}/complete` | Atomically verify COD, OTP, and complete | Required |
| `POST` | `/captain/deliveries/{taskId}/report-problem` | Append an operational problem report | Required |
| `POST` | `/captain/deliveries/{taskId}/release` | Request pre-pickup release | Required |

### Customer

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/customer/orders/{orderId}/tracking` | Read authorised delivery state, ETA, and latest safe captain location |
| `GET` | `/customer/orders/{orderId}/delivery-otp` | Read or rotate the active delivery OTP after pickup |

### Merchant

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/merchant/orders/{orderId}/pickup-code` | Read or rotate the active pickup code for the owning shop |
| `GET` | `/merchant/orders/{orderId}/delivery` | Read delivery status without exposing unnecessary captain data |

### Admin operations

| Method | Path | Purpose | Permission |
| --- | --- | --- | --- |
| `POST` | `/admin/delivery-tasks/{taskId}/assign` | Manual assignment fallback | `operations.manage` |
| `POST` | `/admin/delivery-tasks/{taskId}/release` | Audited pre-pickup release/reassignment | `operations.manage` |
| `POST` | `/admin/delivery-tasks/{taskId}/delivery-override` | Approved OTP override with reason and audit | `operations.manage` + MFA |
| `GET` | `/admin/delivery-tasks/{taskId}` | Read operational task timeline | `operations.read` |

The existing trusted `start_order_dispatch(orderId, idempotencyKey)` service-role
operation remains the only dispatch-start write. Merchant and captain clients do not
create delivery tasks directly.

## Authorisation matrix

| Resource or action | Customer | Merchant | Captain | Admin |
| --- | --- | --- | --- | --- |
| Customer tracking | Owning order only | No | Assigned task only | Permission controlled |
| Pickup code | No | Owning shop only | Verify only; never read | Permission controlled |
| Delivery OTP | Owning order only | No | Verify only; never read | Override only with audit |
| Delivery offer | No | No | Owning offer only | Permission controlled |
| Active task | Safe order status only | Owning shop summary | Assigned captain only | Permission controlled |
| Exact captain location | Owning active order, reduced payload | No | Self | Permission controlled |
| COD collection record | Owning order summary | Owning shop summary | Assigned task summary | Finance/operations only |
| Manual assignment | No | No | No | `operations.manage` |

All protected writes are backend-mediated. Mobile clients receive no direct table grants.

## Idempotency contract

Every lifecycle `POST` endpoint in the matrix requires a UUID `Idempotency-Key`.

The receipt identity is:

```text
actor ID + HTTP method + route template + resource ID + idempotency key
```

Rules:

- same identity and same canonical payload returns the stored result with
  `replayed: true`,
- same identity and different payload returns `409 IDEMPOTENCY_KEY_REUSED`,
- an incomplete receipt is an internal consistency failure and is never treated as a
  successful replay,
- receipts are backend-private,
- a replay never duplicates history, events, OTP attempts, COD liability, earnings,
  counters, or notifications.

Location uses a client-generated `sampleId` rather than the HTTP lifecycle receipt.
Availability is a set-state operation and safely returns the current authoritative state.

## Error contract

| HTTP | Code | Meaning |
| --- | --- | --- |
| `400` | `DELIVERY_REQUEST_INVALID` | Body, location, reason, or identifier is invalid |
| `401` | `AUTHENTICATION_REQUIRED` | No valid session |
| `403` | `CAPTAIN_NOT_ELIGIBLE` | Captain is not operationally eligible |
| `403` | `DELIVERY_ACCESS_DENIED` | Actor cannot access this task or order |
| `404` | `DELIVERY_TASK_NOT_FOUND` | Task is absent or intentionally hidden |
| `404` | `DELIVERY_OFFER_NOT_FOUND` | Offer is absent or intentionally hidden |
| `409` | `DELIVERY_STATE_CONFLICT` | Current order/task state rejects the action |
| `409` | `DELIVERY_TASK_ALREADY_ASSIGNED` | Another captain owns the task |
| `409` | `CAPTAIN_ALREADY_ASSIGNED` | Captain already owns another active task |
| `409` | `CAPTAIN_LOCATION_STALE` | Captain location is not dispatch eligible |
| `409` | `COD_AMOUNT_MISMATCH` | Collected amount differs from `order.total_paise` |
| `409` | `IDEMPOTENCY_KEY_REUSED` | Same key was used with another canonical payload |
| `410` | `DELIVERY_OFFER_EXPIRED` | Offer can no longer be accepted or rejected |
| `422` | `PICKUP_CODE_INVALID` | Pickup code is wrong |
| `422` | `DELIVERY_OTP_INVALID` | Delivery OTP is wrong |
| `423` | `DELIVERY_SECRET_LOCKED` | Verification attempt limit was reached |
| `429` | `LOCATION_UPDATE_RATE_LIMITED` | Location writes are too frequent |
| `503` | `DELIVERY_SERVICE_UNAVAILABLE` | Trusted delivery dependency is unavailable |

Responses use the repository `ApiError` envelope and include `retryable` accurately.

## Frozen event names

Transactional outbox events:

```text
delivery.task.search_started
delivery.offer.created
delivery.offer.accepted
delivery.offer.rejected
delivery.offer.expired
delivery.task.assigned
delivery.task.released
delivery.task.arrived_pickup
delivery.task.picked_up
delivery.task.in_transit
delivery.task.arrived_drop
delivery.cod.collected
delivery.task.completed
delivery.task.problem_reported
captain.availability.changed
```

Rules:

- events are enqueued in the same transaction as durable state,
- event payloads contain IDs, state snapshots, UTC timestamps, and safe public facts,
- pickup codes, delivery OTPs, full addresses, and unrestricted location history are
  forbidden in outbox payloads,
- consumers deduplicate by outbox event ID,
- realtime and push are delivery channels, not sources of truth.

## Failure and release rules

Allowed pre-pickup release reasons:

```text
VEHICLE_ISSUE
PERSONAL_EMERGENCY
CANNOT_REACH_STORE
MERCHANT_UNAVAILABLE
APP_OR_NAVIGATION_FAILURE
OTHER
```

Allowed delivery problem reasons:

```text
CUSTOMER_UNAVAILABLE
INVALID_ADDRESS
CUSTOMER_REFUSED
PACKAGE_DAMAGED
PAYMENT_NOT_AVAILABLE
SAFETY_CONCERN
VEHICLE_ISSUE
OTHER
```

Rules:

- a captain release requires a non-empty reason,
- a post-pickup problem does not silently release package custody,
- a failure does not automatically cancel the customer order,
- evidence object keys are private,
- admin intervention and reassignment are audited,
- repeated reports with the same idempotency key do not duplicate events.

## Observability contract

Minimum metrics:

- search-started tasks,
- offer waves and offers created,
- offer acceptance, rejection, expiry, and conflict counts,
- time to first offer and time to accepted captain,
- stale-location exclusions,
- pickup-code failures and lockouts,
- delivery-OTP failures and lockouts,
- COD mismatches,
- task completion and problem counts,
- idempotent replays,
- active searches, active assignments, and stale active locations.

Logs and traces include request ID, actor ID, order ID, task ID, assignment ID, and
idempotency key hash. They never contain raw verification secrets.

## Ordered Sprint 8 tickets

1. **S8-01 — Contract and lifecycle freeze**
2. **S8-02 — Captain availability and current location**
3. **S8-03 — Forward-delivery task and verification-secret hardening**
4. **S8-04 — Nearby captain offers, expiry, and search expansion**
5. **S8-05 — Exclusive acceptance and manual assignment fallback**
6. **S8-06 — Captain active-delivery and pickup journey**
7. **S8-07 — Pickup-code verification and package handover**
8. **S8-08 — Customer tracking and location privacy**
9. **S8-09 — Customer arrival, exact COD, and delivery OTP**
10. **S8-10 — Idempotent completion, problems, earnings, and end-to-end hardening**

## S8-01 exit criteria

- The order, task, assignment, and captain state machines are frozen.
- `DELIVERED` is explicitly the Sprint 8 successful terminal order state.
- Pricing, settlements, returns, and reverse logistics are explicitly excluded.
- The exact COD rule uses `orders.total_paise`.
- The endpoint, authorisation, error, idempotency, lock-order, and outbox contracts are frozen.
- The ten Sprint 8 tickets have a dependency-safe order.
- Existing delivery foundations are reused rather than duplicated.
- No runtime, database, or mobile implementation is included in S8-01.
- Repository formatting and documentation checks pass.

# Sprint 6 — COD Order Vertical Slice

Status: active.

## Product outcome

Deliver the first usable customer-to-merchant Cash-on-Delivery transaction:

```text
Customer reviews one-shop cart
→ backend creates a fresh checkout quote
→ customer chooses an address and places a COD order
→ backend locks and reserves inventory
→ order, immutable snapshots, history, and outbox records are created
→ merchant reads and accepts or rejects the order
→ accepted order is packed and verified
→ merchant marks it ready for pickup
→ customer sees the order and its real status history
```

The backend order capabilities already exist. Sprint 6 must integrate and prove them
rather than reimplementing them.

## Frozen scope

Included:

- checkout quote integration
- COD order placement
- customer confirmation, list, details, and status timeline
- merchant incoming-order list and details
- merchant accept/reject
- merchant packing list and item verification
- merchant ready-for-pickup
- authorization, idempotency, state-transition, history, outbox, and concurrency tests
- customer and merchant loading, empty, offline, error, and retry states

Excluded:

- online payment
- returns and refunds
- settlement calculation
- loud/repeating merchant ringtone and push escalation
- captain assignment, navigation, pickup, COD collection, and delivery
- admin order-control UI
- Group Style
- automatic image recognition
- fake tracking or fake delivery estimates

## Existing backend contract inventory

Customer:

- `POST /checkout/quote`
- `POST /orders` with `Idempotency-Key`
- `GET /orders`
- `GET /orders/:orderId`

Merchant:

- `GET /merchant/orders`
- `GET /merchant/orders/:orderId`
- `POST /merchant/orders/:orderId/accept`
- `POST /merchant/orders/:orderId/reject`
- `POST /merchant/orders/:orderId/start-packing`
- `GET /merchant/orders/:orderId/packing-list`
- `POST /merchant/orders/:orderId/items/:orderItemId/verify`
- `POST /merchant/orders/:orderId/ready-for-pickup` with `Idempotency-Key`

Already present but reserved for Sprint 7 mobile behaviour:

- `POST /merchant/order-alerts/:alertId/acknowledge`

## Global invariants

- The backend is authoritative for price, fees, stock, totals, status, and history.
- The customer app must never manufacture an order or timeline entry.
- The merchant app must never manufacture an allowed transition.
- One cart contains products from one shop.
- A fresh quote is required before placement.
- COD is the only payment method in Sprint 6.
- Order placement requires an `Idempotency-Key`.
- Retrying the same placement must not create a second order.
- The last available unit cannot be sold twice.
- Item, price, shop, address, and totals are immutable order snapshots.
- Every accepted state transition creates history.
- Required outbox records are created in the same transaction.
- Customers can read only their orders.
- Merchants can read and mutate only their shop's orders.
- Logs and client errors must not expose secrets or unrelated customer data.

## Ordered tickets

Execute exactly one ticket at a time.

### S6-01 — Audit and freeze order contracts

Deliver:

- verify every endpoint listed in this prompt
- document existing backend ownership and Sprint boundaries
- identify mobile integration as the primary remaining work
- freeze the ten-ticket order
- run documentation/OpenAPI checks
- commit `docs(orders): freeze Sprint 6 contracts`

Do not modify order runtime behaviour unless the audit finds a proven defect.

### S6-02 — Customer checkout quote integration

Deliver:

- customer checkout API adapter
- address selection input
- fresh quote request
- authoritative subtotal, discount, fee, tax, and total rendering
- changed-price, unavailable-item, expired-state, offline, loading, and retry handling
- tests for mapping and failure states

Commit `feat(customer): integrate checkout quote`.

### S6-03 — Idempotent COD order placement

Deliver:

- COD-only placement request
- one stable idempotency key per placement attempt
- duplicate-tap prevention
- safe retry with the same key
- expired/invalid quote handling
- successful navigation to order confirmation
- tests proving client retry behaviour

Commit `feat(customer): place idempotent COD orders`.

### S6-04 — Customer order confirmation

Deliver:

- real order number
- immutable shop, item, variant, address, totals, COD, and placed-time snapshots
- current backend status
- view-order and continue-shopping actions
- no invented delivery promises

Commit `feat(customer): add order confirmation`.

### S6-05 — Customer orders list

Deliver:

- authenticated paginated order list
- active and past presentation derived from backend statuses
- order number, shop, item summary, total, status, and placed time
- empty, loading, stale, offline, error, and retry states

Commit `feat(customer): add orders list`.

### S6-06 — Customer order details and history

Deliver:

- authenticated order details
- immutable snapshots
- real status-history timeline
- refresh/retry
- cross-customer denial coverage
- no timeline reconstruction from current status alone

Commit `feat(customer): add order details timeline`.

### S6-07 — Merchant incoming-order queue

Deliver:

- merchant order API adapter
- authenticated order list and details
- New, Accepted, Packing, Ready, Completed, and Rejected groupings derived from status
- polling/manual refresh only
- no Sprint 7 repeating ringtone implementation
- loading, empty, offline, error, and retry states

Commit `feat(merchant): add incoming order queue`.

### S6-08 — Merchant accept or reject

Deliver:

- order review
- accept with validated preparation time
- reject with validated reason
- duplicate-action safety
- invalid-transition handling
- cross-shop denial coverage
- customer-visible history update

Commit `feat(merchant): handle order decisions`.

### S6-09 — Merchant packing and ready-for-pickup

Deliver:

- start packing
- read packing list
- verify each ordered item/variant
- show incomplete verification clearly
- idempotently mark ready only when allowed
- no captain UI or simulated pickup

Commit `feat(merchant): complete order packing flow`.

### S6-10 — End-to-end hardening

Prove:

```text
one-shop cart
→ checkout quote
→ COD placement
→ duplicate placement retry
→ exactly one order
→ merchant reads order
→ merchant accepts
→ merchant starts packing
→ merchant verifies all items
→ merchant marks ready
→ customer reads complete real history
```

Required coverage:

- duplicate placement
- last-unit concurrency
- stale/invalid quote
- customer cross-account denial
- merchant cross-shop denial
- invalid transitions
- complete status history
- transactional outbox
- mobile loading/error/offline/retry states
- OpenAPI validation
- database tests
- unit and integration tests
- all app and package builds

Commit `test(orders): validate COD vertical slice`.

## Per-ticket execution rule

For every ticket:

1. Read this prompt, relevant product rules, OpenAPI, database schema, and tests.
2. Inspect the existing implementation before changing code.
3. Keep the diff limited to the ticket.
4. Add or update tests with the implementation.
5. Run targeted checks first, then the required repository gates.
6. Review `git diff` and `git diff --check`.
7. Commit once with the ticket's exact commit message.
8. Do not push or open a PR unless explicitly authorized.

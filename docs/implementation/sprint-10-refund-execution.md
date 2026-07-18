---
sprint: 10
ticket: S10-09
status: implemented
provider: cashfree
---

# S10-09 refund execution

Approved returns can be converted into idempotent Cashfree refunds and reconciled to terminal provider state.

## API surface

- `GET /v1/admin/refunds`
- `GET /v1/admin/refunds/:refundId`
- `POST /v1/admin/returns/:returnId/refunds`
- `POST /v1/admin/refunds/:refundId/retry`
- `POST /v1/admin/refunds/:refundId/reconcile`

## Execution model

1. The database locks order, payment, return, return items and refund rows in the frozen finance order.
2. It derives the refund from immutable requested amounts or a frozen S10-08 line decision.
3. It creates an `INITIATED` refund and moves the return to `REFUND_PENDING`.
4. The Cashfree call runs outside database locks using the same UUID command identity.
5. Provider results are applied idempotently.
6. Completed refunds update payment and order payment states to `PARTIALLY_REFUNDED` or `REFUNDED`, then mark the return `REFUNDED`.

## Safety

- Finance admins require AAL2 and `admin.refunds.manage`.
- Cumulative active and completed refunds cannot exceed the captured payment.
- Provider IDs cannot be replaced after attachment.
- Provider timeouts leave a recoverable initiated record; retry reuses the original provider idempotency identity.
- Refund initiation and provider outcomes are audited and emitted through the durable outbox.

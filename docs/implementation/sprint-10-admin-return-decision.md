---
sprint: 10
ticket: S10-08
status: implemented
---

# S10-08 admin return decision

Finance admins can now list and inspect return requests and make an idempotent, audited decision.

## API surface

- `GET /v1/admin/returns`
- `GET /v1/admin/returns/:returnId`
- `POST /v1/admin/returns/:returnId/decision`

The decision command accepts `APPROVE`, `REJECT`, or `VERIFY`.

- `APPROVE` moves a new customer request through review to `APPROVED`.
- `REJECT` records the review outcome without deleting the request or its history.
- `VERIFY` resolves a disputed merchant inspection with one immutable approved quantity and approved refund amount per returned line.

## Safety

- ADMIN account, AAL2 and `admin.returns.manage` are required for writes.
- UUID idempotency keys and canonical request fingerprints prevent duplicate or conflicting decisions.
- Decision and line records are append-only.
- Approved refund values are derived from immutable order-item refund values; clients cannot submit money.
- Every command creates an immutable admin audit entry and durable outbox event.

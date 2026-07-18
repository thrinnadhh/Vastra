---
sprint: 10
ticket: S10-01
status: implemented
provider: cashfree
api_version: 2025-01-01
---

# Sprint 10 finance contract freeze

## Decision

Vastra MVP uses **Cashfree Payments** as its only online payment provider. Provider-specific HTTP details remain behind `PaymentProviderGateway`; payment, return, refund, settlement, payout and COD services depend only on canonical Vastra contracts.

Cashfree order creation is server-side and returns a `payment_session_id`. Webhook verification must use the exact raw request body together with the provider signature and timestamp. Parsed or re-serialized JSON is never accepted as signature input.

## Existing schema reused

Sprint 10 builds workflows on the existing tables:

- `payments` and `payment_events`
- `return_requests`, `return_items`, `return_evidence`, `return_status_history`
- `refunds`
- `merchant_settlements` and `merchant_settlement_items`
- `captain_earnings`, `captain_payouts` and `captain_payout_items`

S10 agents must extend these structures only when a ticket proves a missing invariant. They must not create parallel payment, refund or ledger tables.

## Money contract

- Currency is `INR` for the MVP.
- Internal amounts are positive integer paise.
- Business logic never uses floating-point rupees.
- Provider decimal amounts are formatted and parsed at the adapter boundary with exactly two decimal places.
- Client-supplied totals, refund amounts, commissions and payout totals are never authoritative.

## Provider boundary

The Cashfree adapter owns:

- authenticated create-order requests
- provider order and payment identifiers
- payment-session identifiers
- fetch-order reconciliation
- raw-body webhook signature verification
- provider event mapping
- refund creation and refund-status reconciliation

Provider credentials are backend-only:

- `PAYMENT_PROVIDER=cashfree`
- `PAYMENT_API_VERSION=2025-01-01`
- `PAYMENT_CLIENT_ID`
- `PAYMENT_SECRET_KEY`

Cashfree webhook verification uses `PAYMENT_SECRET_KEY`; there is no separate invented webhook secret in the Sprint 10 contract.

## Authoritative state rules

- A customer success screen never marks a payment captured.
- Only a verified provider event or explicit provider reconciliation can confirm capture or refund completion.
- Duplicate events return the previously recorded result.
- Out-of-order events may be stored, but stale transitions are ignored.
- Captured, completed-refund, paid-settlement and paid-payout states never regress.
- Cumulative completed and in-flight refunds cannot exceed the captured payment amount.
- Return quantities cannot exceed the delivered quantity minus quantities already active or completed in other returns.
- Merchant and captain transfers are driven by frozen ledger entries, never mutable balance fields.

## Idempotency

Every financial mutation requires a UUID `Idempotency-Key`. The database stores a fingerprint of the actor, resource, command and canonical payload. Reusing a key with the same fingerprint returns the original result; reusing it with different input raises `FINANCE_IDEMPOTENCY_CONFLICT`.

Provider requests use the same internal command identity when the provider supports idempotency. A provider timeout is reconciled before another provider order, refund or transfer is created.

## Lock order

All multi-domain transactions acquire rows in this order:

1. order
2. payment
3. payment event
4. return request
5. return item
6. refund
7. merchant settlement
8. captain earning
9. captain payout

Agents must not introduce a different lock order. Provider HTTP calls must not execute while database row locks are held.

## Finance authorization

Finance access is separate from operations access.

- `FINANCE_ANALYST` receives finance read permissions and audit read access.
- `FINANCE_MANAGER` receives paired finance read/manage permissions and audit read access.
- Existing operations and trust-and-safety roles receive no finance permissions by default.
- `SUPER_ADMIN` receives the canonical permission catalogue.
- All finance mutations require an active admin account, AAL2 and the narrow manage permission.

Finance permission domains:

- payments
- returns
- refunds
- merchant settlements
- captain payouts
- COD reconciliation

## Shared ownership

Only the Sprint 10 integrator may modify:

- `docs/api/openapi.yaml`
- `docs/api/error-codes.md`
- finance permission and role catalogues
- `PaymentProviderGateway`
- canonical finance status contracts
- shared webhook bootstrap/raw-body configuration
- finance module registration

Workstream branches must consume these contracts rather than redefine them.

## Ticket dependency order

1. S10-01 contract freeze
2. S10-02 online checkout initialization
3. S10-03 webhook ingestion
4. S10-04 payment processing and recovery
5. S10-05 return eligibility/request
6. S10-06 private evidence and reverse pickup
7. S10-07 merchant receipt/inspection
8. S10-08 admin decision
9. S10-09 refund execution
10. S10-10 merchant settlement eligibility
11. S10-11 captain earnings, COD and payouts
12. S10-12 integration hardening and closure

## S10-01 acceptance

- Cashfree is the only accepted server payment provider.
- The provider API version and credential names are validated.
- Canonical statuses match the existing database enums.
- State-transition maps reject terminal-state regressions.
- Integer-paise conversion is tested.
- Finance roles and permissions are explicit and isolated from operations roles.
- Lock order, error codes, idempotency and shared-file ownership are frozen.
- Normal repository CI is the mandatory merge gate before workstream integration.

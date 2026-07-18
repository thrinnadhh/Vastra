---
sprint: 10
ticket: S10-12
status: implemented
---

# Sprint 10 finance integration hardening and closure

Sprint 10 is closed with the complete MVP finance lifecycle:

1. Cashfree online order initialization
2. Signed durable webhook ingestion
3. Verified payment-event processing and recovery
4. Customer return eligibility and requests
5. Private evidence and reverse pickup
6. Merchant receipt and immutable inspection
7. Finance-admin return decisions
8. Cashfree refund execution and reconciliation
9. Merchant settlement eligibility and frozen ledger
10. Captain earnings, COD reconciliation and payout eligibility

## Cross-workstream invariants

- Money remains positive integer paise.
- Client callbacks never confirm payment or refund success.
- Provider HTTP calls execute outside database row locks.
- Multi-domain writes follow the canonical order → payment → event → return → item → refund → settlement → earning → payout lock order.
- Financial commands use UUID idempotency keys and immutable audit records.
- Return evidence remains private.
- One return line cannot be approved above its returned quantity.
- Cumulative refunds cannot exceed the captured payment.
- Completed refunds feed merchant settlement deductions exactly once.
- Unreconciled or disputed captain COD blocks payout eligibility.

## Verification

The closure test matrix checks both the application transition contracts and the service-role-only database command surface.

The repository CI remains the merge gate for formatting, environment validation, lint, typecheck, unit and integration tests, Supabase migrations and pgTAP, OpenAPI validation, and production build.

# Codex prompt pack — customer trust, payments, returns, refunds, and finance

Use `00-master-frontend-contract.md`. Execute exactly one named `FE-S09-*` or
`FE-S10-*` ticket. These sprints contain known contract gaps; audit before editing.

## Sprint 09 — trust, account, and support

Current blockers include address HTTP CRUD, cancellation, customer support tickets and
conversation, ratings, and account deletion. A ticket may implement a screen only after
its OpenAPI operation, authorization, errors, idempotency where relevant, backend tests,
and generated types exist.

Requirements when ready:

- cancellation displays eligibility, confirms intent, and handles acceptance races;
- support protects private order/customer data and preserves conversation state;
- ratings enforce eligibility and duplicate rules;
- profile/preferences/notifications reflect supported fields only;
- account deletion is a confirmed server action, not local logout/data hiding;
- address data is stored/logged only as allowed by security and privacy rules;
- all destructive or duplicate-prone actions have truthful progress/recovery.

## Sprint 10 — online payment, returns, refunds, and finance

Before UI implementation:

1. reconcile implemented payment and return/refund controllers with OpenAPI;
2. regenerate shared types;
3. close prepaid delivery completion in the order/payment state machine;
4. verify webhook/provider authority and idempotency;
5. verify customer, merchant, admin, and finance authorization.

### Online payment

- client never holds provider secrets or marks payment successful from callback alone;
- distinguish processing, verified success, declined, cancelled, timeout, unknown, and
  reconciliation states;
- retries do not create duplicate orders or payments;
- provider sandbox evidence is required for E2E claims.

### Returns/refunds

- show line-level eligibility/quantity/reason from backend rules;
- validate evidence type/size before private upload;
- represent receipt, inspection, merchant decision, admin review, refund provider,
  completed, failed, and unknown states truthfully;
- privileged decisions/refunds require authorization, confirmation/reason, and audit;
- money is displayed from integer paise and server-authoritative totals.

### Finance

- payments, settlements, payouts, refunds, and COD reconciliation use contracted data;
- no client-derived authoritative balance;
- failure/unknown states provide safe operational recovery without replaying a settled
  action.

## Required E2E

- cancellation eligibility race;
- support/rating authorization and duplicate behavior;
- provider sandbox payment success/failure/unknown/reconciliation;
- return request/evidence/inspection/admin review/refund lifecycle;
- finance permission and audit coverage.

Do not claim these journeys until the missing contracts and prepaid completion path are
closed.

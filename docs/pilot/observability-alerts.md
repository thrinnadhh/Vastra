# Sprint 11 observability dashboards and alerts

## Correlation fields

Structured logs and operational views must make the following identifiers searchable without exposing secrets or private payloads:

- `requestId`
- `userId` where authorized and necessary
- `shopId`
- `orderId`
- `deliveryTaskId`
- `assignmentId`
- `paymentId`
- `providerEventId`
- `returnRequestId`
- `refundId`
- `settlementId`
- `captainPayoutId`
- `outboxEventId`

Never log access tokens, refresh tokens, OTPs, payment signatures, service-role keys, private Storage object contents, KYC, or return evidence.

## Required dashboards

### API and application health

- request rate, error rate, and p50/p95/p99 latency by route and status;
- authentication/authorization denials;
- process restarts, memory, CPU, event-loop lag, and dependency failures;
- client release/build adoption and crash-free sessions where available.

### Orders and inventory

- order creation success/failure;
- orders by state and age;
- reservations by state and expiry;
- negative/invalid inventory invariant count;
- merchant-decision latency;
- orders waiting for merchant beyond threshold.

### Alerts and delivery

- merchant alert created, claimed, sent, failed, retried, dead-lettered, and acknowledged;
- time from order commit to provider send and acknowledgement;
- active alerts without acknowledgement;
- unassigned delivery tasks and assignment age;
- captain offer acceptance conflicts and delivery failures.

### Finance

- payment events received, invalid-signature, failed, retried, ignored, and processed;
- captured payments without activated orders;
- refunds pending/processing/failed/completed and age;
- reconciliation attempts and provider uncertainty;
- merchant settlements pending/review/completed;
- COD expected, deposited, shortage, excess, and disputed;
- captain payout eligibility and blocked reasons.

### Platform dependencies

- PostgreSQL connections, CPU, storage, locks, deadlocks, long transactions, and slow queries;
- Supabase Auth/Storage/Realtime errors;
- outbox backlog and oldest pending age;
- FCM, Cashfree, SMS/OTP, and mapping dependency latency/failure.

## Blocking pilot alerts

At minimum configure actionable alerts for:

1. order creation or checkout critical-error spike;
2. any negative inventory/invariant violation;
3. merchant alerts not sent within the pilot threshold;
4. unacknowledged merchant alerts beyond the response threshold;
5. unassigned accepted order beyond the dispatch threshold;
6. invalid payment signature spike;
7. payment event failure/backlog;
8. captured payment without order activation;
9. refund failure or processing timeout;
10. duplicate/refund-over-capture invariant violation;
11. unresolved COD shortage/dispute;
12. outbox dead-letter growth;
13. database saturation, deadlocks, or prolonged lock waits;
14. backup failure or stale backup;
15. elevated 5xx rate or p95 latency threshold breach.

## Alert quality requirements

Each alert must state severity, owner, source dashboard/query, affected identifiers, first diagnostic action, escalation route, and recovery runbook. Alerts must be tested with synthetic signals before the pilot.

An alert that cannot be routed to a named operator, cannot identify the affected workflow, or exposes private data does not pass S11-09.

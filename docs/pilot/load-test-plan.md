# Sprint 11 critical-path load and concurrency plan

Run against local or staging only. Use synthetic accounts, shops, products, inventory, orders, payment events, returns, and captains. Never point the harness at production without a separate approved change and traffic plan.

## Required reporting

For every scenario record:

- release commit and environment;
- dataset size and seed identifiers;
- virtual users/concurrency, duration, and ramp pattern;
- request count, success rate, throughput, p50, p95, p99, and maximum latency;
- HTTP/API error codes;
- database CPU/connections/locks and slow queries;
- queue/outbox/alert lag;
- invariant verification before and after;
- defects and rerun result.

## Scenarios

### Read traffic

1. Nearby/open-shop discovery by serviceable coordinates.
2. Product search, catalogue reads, product detail, and current price/stock refresh.
3. Customer order list/detail and tracking.
4. Merchant incoming-order queue and order detail.
5. Captain offer/assignment reads.
6. Admin operational search and finance queues.

### Write traffic

1. Checkout quote creation for prepared one-shop carts.
2. COD order creation with unique idempotency keys.
3. Repeated order creation with the same idempotency key.
4. Online payment initialization and durable webhook ingestion.
5. Merchant alert acknowledgement and order decision.
6. Captain assignment acceptance under contention.
7. Pickup/delivery confirmation retries.
8. Return request, inspection, admin decision, and refund execution.
9. COD reconciliation and payout eligibility reads.

### Concurrency invariants

Run targeted races for:

- two customers attempting the final inventory unit;
- multiple merchant decisions for the same order;
- multiple captains accepting the same delivery offer;
- duplicate payment events and out-of-order terminal events;
- duplicate refund execution and reconciliation;
- duplicate COD reconciliation;
- repeated outbox claims by multiple workers.

## Initial pilot thresholds

These are pilot thresholds, not long-term capacity claims:

- critical command success rate: at least 99.5% excluding intentional validation/conflict responses;
- critical read success rate: at least 99.9%;
- p95 critical read latency: at most 750 ms in staging;
- p95 critical command latency: at most 1,500 ms excluding external-provider completion;
- no sustained database connection exhaustion;
- no unbounded outbox/alert backlog after traffic stops;
- zero invariant violations.

External provider latency must be reported separately from Vastra processing latency.

## Blocking failures

Any negative inventory, duplicate order, duplicate provider refund, double captain assignment, lost authoritative payment event, payment/refund state regression, duplicate delivery completion, or missing immutable audit/history entry is `CRITICAL` and forces `NO_GO`, regardless of aggregate latency.

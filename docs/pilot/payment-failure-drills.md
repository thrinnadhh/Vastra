# Sprint 11 payment, refund, and COD failure drills

Run only against local or staging provider credentials and synthetic pilot data. Capture redacted request IDs, provider event IDs, payment IDs, refund IDs, order IDs, timestamps, worker logs, and final authoritative database states.

## Payment drills

1. **Invalid webhook signature**
   - Send a syntactically valid event with an invalid signature.
   - Expect durable rejection or failed processing without changing payment/order state.
2. **Duplicate webhook**
   - Replay the same provider event ID and payload.
   - Expect one effective state transition and one durable event identity.
3. **Out-of-order events**
   - Deliver terminal/captured events before earlier pending events, then replay the stale events.
   - Expect no regression from a terminal authoritative state.
4. **Captured payment with delayed worker**
   - Pause event processing after durable ingestion.
   - Resume it and verify the order activates once, inventory remains reserved once, and the merchant alert is created once.
5. **Failed/user-dropped payment**
   - Verify unpaid order cancellation, owned reservation release, and no refund creation.
6. **Provider/client timeout after initialization**
   - Interrupt the client after provider order creation.
   - Retry with the same idempotency key and verify one payment attempt/provider order.

## Refund drills

1. **Create-refund timeout with provider success**
   - Simulate a lost response after provider acceptance.
   - Reconcile using the same merchant refund identity; do not create a second provider refund.
2. **Duplicate admin execution**
   - Submit the same UUID idempotency key twice.
   - Expect the original refund result.
3. **Retry with a different key while processing**
   - Expect conflict/reconciliation, never cumulative over-refund.
4. **Partial then final refund**
   - Verify cumulative amount never exceeds captured payment and payment/order status advances correctly.
5. **Failed provider refund**
   - Verify failure reason, retry eligibility, alerting, and no false completed timestamp.
6. **Completed-provider reconciliation**
   - Force local uncertainty, fetch provider state, and verify replay-safe local completion.

## COD drills

1. Complete a COD delivery and verify expected liability and captain earning creation once.
2. Reconcile exact deposit and verify earning/payout eligibility.
3. Record shortage and confirm dispute blocks payout eligibility.
4. Record excess and confirm the immutable reconciliation ledger preserves the difference.
5. Retry reconciliation with the same command identity and verify one effective entry.
6. Attempt payout creation with unresolved COD and expect rejection.

## Required assertions

- Client callbacks never authoritatively complete payments or refunds.
- Provider HTTP calls are not held inside database row locks.
- Duplicate/out-of-order input cannot regress terminal state.
- Inventory is never released twice or driven negative.
- Cumulative refunds never exceed captured amount.
- Settlement deductions consume completed refunds exactly once.
- Unreconciled/disputed COD blocks captain payout.
- All privileged recovery actions produce immutable audit records.

Any violation is a `CRITICAL` defect and forces `NO_GO`.

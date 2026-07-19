# Sprint 11 pilot incident runbooks

Use synthetic or redacted identifiers in evidence. Do not paste secrets, OTPs, private evidence, KYC, access tokens, or full provider payloads into tickets or chat.

## Common incident structure

For every incident:

1. Declare severity and incident owner.
2. Record UTC start time and affected service zone/workflow.
3. Contain new damage before attempting repair.
4. Preserve immutable events, logs, audit records, and provider references.
5. Diagnose using stable identifiers and authoritative database/provider state.
6. Use idempotent recovery commands only.
7. Communicate with affected users and operators through the named owner.
8. Verify invariants and close with a timeline, root cause, and follow-up defect.

## Merchant did not receive an order alert

**Detection:** committed order in `WAITING_FOR_MERCHANT` without timely send/acknowledgement.

**Containment:** keep the order visible in the merchant queue; do not create a duplicate order or alert identity.

**Diagnostics:** inspect order history, outbox event, alert delivery attempts, FCM response, merchant device token/channel permission, app lifecycle, and acknowledgement record.

**Recovery:** retry the same durable alert through the existing worker/recovery path. Contact the merchant manually when the pilot threshold is exceeded. Cancel only through the authoritative order workflow when the merchant cannot fulfil.

**Verification:** one active order, one effective alert identity, no duplicate inventory movement, retry stopped after acknowledgement.

## Payment captured but order not activated

**Detection:** captured provider/payment state with order not in the authoritative paid fulfilment state.

**Containment:** stop manual order recreation and prevent inventory release until payment-event state is understood.

**Diagnostics:** verify signature, durable provider event, event processing status, payment/order IDs, reservation ownership, worker failure, and audit/outbox records.

**Recovery:** retry the verified event using the finance recovery command. Never trust a client callback alone and never insert payment/order state manually.

**Verification:** one captured payment, one activated order, one reservation, one merchant alert, no duplicate refund.

## Refund uncertain, stuck, or failed

**Detection:** refund remains pending/processing beyond threshold, provider request timed out, or local/provider state differs.

**Containment:** prevent a new provider refund with a different merchant refund identity.

**Diagnostics:** inspect refund number/idempotency key, provider refund ID, captured amount, completed cumulative refunds, provider lookup result, failure message, and audit entries.

**Recovery:** reconcile using the existing merchant refund identity. Retry only when the provider state proves no accepted refund exists.

**Verification:** cumulative completed refunds do not exceed captured payment; payment/order/return/settlement states agree; one provider refund exists.

## Accepted order remains unassigned

**Detection:** accepted/ready order without an active delivery assignment beyond threshold.

**Containment:** prevent duplicate manual and automatic assignments from racing.

**Diagnostics:** inspect delivery task, offer expiry, captain availability/location, dispatch attempts, locks, and admin assignment history.

**Recovery:** use the authorized idempotent assignment/reassignment command with a reason. Contact merchant/customer when the service-level threshold is exceeded.

**Verification:** one active captain assignment, superseded offers closed, all parties notified, immutable assignment history present.

## Inventory mismatch or negative-inventory signal

**Detection:** invariant alert, reconciliation mismatch, or stock below zero.

**Containment:** stop new orders for the affected variant/shop and preserve all movements/reservations.

**Diagnostics:** reconstruct balance from immutable inventory movements, reservations, offline sales, cancellations, returns, and order history. Identify the first divergent transaction.

**Recovery:** do not edit balances directly. Use an approved audited inventory correction/forward-fix after root-cause review.

**Verification:** reconstructed balance matches stored balance, no active reservation exceeds availability, affected workflows are rerun.

## COD shortage or dispute

**Detection:** deposited amount differs from expected liability or reconciliation is disputed.

**Containment:** block affected captain payout eligibility; do not alter delivered orders or earnings manually.

**Diagnostics:** inspect completed COD deliveries, expected ledger, deposit record, reconciliation command identity, shortage/excess, and audit history.

**Recovery:** finance resolves through the immutable reconciliation/dispute process. Escalate unresolved shortage to the named operations/finance owner.

**Verification:** liability and deposit totals reconcile or remain explicitly disputed; payout remains blocked until resolution.

## Database or Supabase outage

**Detection:** elevated connection/auth/storage/realtime failures or health-check failure.

**Containment:** stop unsafe writes, disable pilot traffic through the approved control, and avoid repeated non-idempotent client actions.

**Diagnostics:** platform status, database connections/locks/storage, recent deploy/migration, logs, outbox backlog, and dependency health.

**Recovery:** restore service, roll back the application or apply the approved forward-fix, then drain durable queues in bounded batches.

**Verification:** health checks, CI smoke set, critical reads/writes, queue drain, payment event processing, and invariant queries pass.

## Suspected private-data or secret exposure

**Detection:** secret scanner, logs, client bundle, access report, or user complaint indicates exposure.

**Containment:** disable affected release/endpoint, revoke access where authorized, preserve evidence, and restrict incident visibility.

**Diagnostics:** identify data/secret type, exposure window, affected actors, access paths, logs, builds, and downstream systems.

**Recovery:** follow approved secret rotation and privacy-response procedures with explicit authorization. Patch the source path and add a regression guard.

**Verification:** old credential/access is invalid, fixed build is deployed, logs and bundles are clean, affected users/owners are notified as required.

## Mandatory closure evidence

- incident timeline and severity;
- affected stable identifiers;
- containment and recovery commands with secrets redacted;
- before/after authoritative states;
- invariant verification;
- communication record;
- root cause and owned follow-up defect.

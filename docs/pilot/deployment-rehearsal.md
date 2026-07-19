# Sprint 11 staging-to-production deployment rehearsal

This rehearsal proves the process without enabling real pilot traffic. Use approved environments and synthetic accounts only.

## Entry criteria

- candidate commit is immutable and identified by full Git SHA;
- full repository CI is green;
- migrations have passed empty-database and staging-copy validation;
- release notes and known defects are current;
- backup is verified;
- deployment, incident, support, and rollback owners are available;
- required provider credentials/configuration are present in the target secret store, not in source control;
- pilot traffic remains disabled through the approved configuration/feature control.

## Rehearsal procedure

1. Record source branch, candidate commit, UTC start time, operators, and environment.
2. Capture pre-deployment health, database migration head, queue depth, and synthetic smoke identifiers.
3. Create/verify the staging backup and rollback checkpoint.
4. Deploy the exact candidate commit to staging.
5. Apply migrations using the approved deployment mechanism.
6. Verify migration history, database advisors, RLS, and privileged RPC grants.
7. Run smoke flows:
   - authentication and suspended-user denial;
   - nearby shop/product reads;
   - checkout quote and idempotent COD order;
   - online payment initialization and signed webhook processing;
   - merchant alert creation/acknowledgement;
   - merchant accept/pack/ready;
   - captain assignment/pickup/delivery OTP;
   - return/admin decision/refund reconciliation;
   - admin order and finance recovery reads.
8. Verify logs, metrics, dashboards, and synthetic alert routing.
9. Verify private Storage and client-secret checks.
10. Exercise application rollback to the previous compatible release or execute the documented forward-fix path.
11. Re-run smoke and invariant checks after rollback/forward-fix.
12. Redeploy the candidate when required and verify pilot traffic remains disabled.

## Production promotion checklist

Before the real promotion:

- candidate SHA equals the reviewed/rehearsed SHA;
- no critical/high defect is open;
- evidence manifest supports `GO` and contains all sign-offs;
- service zone and pilot actors are approved;
- support and incident channels are staffed;
- rollback owner explicitly accepts responsibility;
- merchant/captain onboarding and contact lists are ready;
- production credentials and webhook endpoints are verified through secret metadata, without printing values;
- first-order monitoring and manual fallback are scheduled.

## Rollback triggers

Immediately pause pilot traffic and invoke rollback/forward-fix when any of these occurs:

- private-data or secret exposure;
- negative inventory or duplicate order;
- double captain assignment;
- captured payment without recoverable order activation;
- duplicate/over-capture refund;
- broken RLS/authorization boundary;
- merchant alerts unavailable for pilot merchants;
- database migration corruption or inability to restore;
- unbounded queue/outbox growth;
- critical observability blind spot.

## Pass criteria

The rehearsal passes only when deployment, migration, smoke, alert routing, rollback/forward-fix, and post-recovery verification complete using documented steps and named owners. Manual database edits or undocumented credentials invalidate the rehearsal.

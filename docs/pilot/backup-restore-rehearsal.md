# Sprint 11 backup, restore, and rollback rehearsal

## Safety boundary

- Use local or staging data only unless an authorized production procedure explicitly exists.
- Never commit backup archives, credentials, customer data, KYC, return evidence, OTPs, payment payloads, or Storage objects.
- Record commands with secrets redacted.
- Do not reset or restore a non-local database without explicit approval and a named operator.

## Preparation

Record:

- source environment and project reference;
- release commit and migration head;
- backup UTC timestamp;
- responsible operator and observer;
- declared recovery point objective and recovery time objective;
- expected critical record counts and stable synthetic identifiers.

## Database restore rehearsal

1. Create an approved backup of the staging PostgreSQL database.
2. Provision a clean isolated restore target.
3. Restore roles/schema/data using the approved Supabase/PostgreSQL procedure.
4. Apply only the migrations required by the release commit.
5. Run migration history verification.
6. Run the complete pgTAP and concurrency suite.
7. Verify synthetic records for:
   - profiles and roles;
   - shops, products, variants, and inventory balances;
   - carts, orders, order items, and reservations;
   - delivery tasks, assignments, and status history;
   - payment events, payments, returns, refunds, settlements, earnings, COD, and payouts;
   - immutable audit/outbox/history tables.
8. Verify RLS remains enabled/forced and privileged RPC execution remains restricted.
9. Record elapsed restore time and any manual intervention.

## Storage recovery rehearsal

For public catalogue media and private KYC/return/Wardrobe media:

1. Verify bucket configuration, privacy, MIME/size restrictions, and signed URL expiry.
2. Restore or recreate a synthetic object set using the approved backup/export procedure.
3. Confirm public assets remain public only where intended.
4. Confirm private object keys are not exposed through client APIs or logs.
5. Confirm removed users/members cannot obtain new signed URLs.

## Rollback and forward-fix decision

Before deployment, classify every migration as:

- safely reversible;
- forward-fix only;
- data backfill requiring a checkpoint;
- operational/configuration-only.

The rollback plan must include:

- decision owner;
- traffic stop/feature-flag action;
- application rollback command;
- schema compatibility window;
- migration/forward-fix command;
- verification queries;
- customer/merchant/captain communication owner;
- criteria to resume traffic.

## Pass criteria

- Clean restore completes within the declared RTO.
- Restored data is within the declared RPO.
- Migrations, pgTAP, concurrency, OpenAPI, and application smoke checks pass.
- RLS, secrets, private Storage, immutable histories, money, inventory, order, and finance invariants remain intact.
- Operators can execute the documented rollback/forward-fix flow without undocumented credentials or manual data edits.

A failed restore, unverifiable backup, missing rollback owner, broken RLS, or corrupted critical record is `CRITICAL` and forces `NO_GO`.

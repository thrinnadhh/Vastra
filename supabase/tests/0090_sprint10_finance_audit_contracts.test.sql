begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select no_plan();

select ok(
  pg_get_constraintdef(
    (
      select oid from pg_constraint
      where conrelid = 'private.admin_audit_log'::regclass
        and conname = 'admin_audit_log_resource_type_check'
    )
  ) like '%RETURN_REQUEST%'
  and pg_get_constraintdef(
    (
      select oid from pg_constraint
      where conrelid = 'private.admin_audit_log'::regclass
        and conname = 'admin_audit_log_resource_type_check'
    )
  ) like '%MERCHANT_SETTLEMENT%',
  'immutable admin audit accepts finance resource types'
);
select ok(
  pg_get_constraintdef(
    (
      select oid from pg_constraint
      where conrelid = 'private.admin_audit_log'::regclass
        and conname = 'admin_audit_log_reason_code_check'
    )
  ) like '%SETTLEMENT_CYCLE%'
  and pg_get_constraintdef(
    (
      select oid from pg_constraint
      where conrelid = 'private.admin_audit_log'::regclass
        and conname = 'admin_audit_log_reason_code_check'
    )
  ) like '%COD_RECONCILIATION%',
  'immutable admin audit accepts frozen finance reason codes'
);
select has_trigger(
  'private',
  'admin_audit_log',
  'prevent_admin_audit_log_mutation',
  'finance audit records remain append-only'
);

select * from finish();
rollback;

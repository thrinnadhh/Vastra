begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select no_plan();

create temporary table sprint9_admin_rpc_contracts (
  signature text primary key,
  mutating boolean not null
) on commit drop;

insert into sprint9_admin_rpc_contracts(signature, mutating) values
  ('public.record_admin_audit(uuid,text,text,uuid,text,text,text,uuid,jsonb,jsonb)', true),
  ('public.list_admin_audit(text,uuid,uuid,integer)', false),
  ('public.get_admin_operations_dashboard()', false),
  ('public.search_admin_operations(text,integer)', false),
  ('public.get_admin_order_investigation(uuid)', false),
  ('public.admin_cancel_order_operation(uuid,uuid,text,text,text,uuid)', true),
  ('public.admin_retry_order_dispatch(uuid,uuid,text,text,text,uuid)', true),
  ('public.admin_release_delivery_operation(uuid,uuid,text,text,text,uuid)', true),
  ('public.admin_reset_delivery_verification(uuid,uuid,text,text,text,text,uuid)', true),
  ('public.get_admin_merchant_operations(uuid)', false),
  ('public.admin_set_merchant_operational_status(uuid,uuid,text,text,text,text,uuid)', true),
  ('public.get_admin_captain_operations(uuid)', false),
  ('public.admin_set_captain_operational_status(uuid,uuid,text,text,text,text,uuid)', true),
  ('public.admin_correct_captain_availability(uuid,uuid,text,text,text,text,uuid)', true),
  ('public.admin_release_captain_assignment(uuid,uuid,text,text,text,uuid)', true),
  ('public.list_admin_operational_settings(text,text)', false),
  ('public.admin_update_operational_setting(uuid,text,jsonb,text,text,integer,text,text,text,uuid)', true),
  ('public.get_admin_case(uuid)', false),
  ('public.list_admin_cases(text,text,uuid,integer)', false),
  ('public.admin_create_case(uuid,text,text,text,text,uuid,uuid,uuid,uuid,uuid,uuid,text,text,uuid)', true),
  ('public.admin_assign_case(uuid,uuid,uuid,text,text,text,text,uuid)', true),
  ('public.admin_add_case_note(uuid,uuid,text,text,text,text,uuid)', true),
  ('public.admin_escalate_case(uuid,uuid,text,text,text,uuid)', true),
  ('public.admin_resolve_case(uuid,uuid,text,text,text,text,uuid)', true),
  ('public.admin_close_case(uuid,uuid,text,text,text,uuid)', true);

select ok(
  to_regprocedure(signature) is not null,
  signature || ' exists'
) from sprint9_admin_rpc_contracts;

select ok(
  has_function_privilege('service_role', signature, 'EXECUTE'),
  signature || ' is executable by service_role'
) from sprint9_admin_rpc_contracts;

select ok(
  not has_function_privilege('anon', signature, 'EXECUTE')
    and not has_function_privilege('authenticated', signature, 'EXECUTE'),
  signature || ' is denied to direct clients'
) from sprint9_admin_rpc_contracts;

select ok(
  p.prosecdef,
  contract.signature || ' is SECURITY DEFINER'
)
from sprint9_admin_rpc_contracts contract
join pg_proc p on p.oid = to_regprocedure(contract.signature);

select ok(
  coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=%',
  contract.signature || ' pins search_path'
)
from sprint9_admin_rpc_contracts contract
join pg_proc p on p.oid = to_regprocedure(contract.signature);

with mutation_definitions as (
  select contract.signature, lower(pg_get_functiondef(to_regprocedure(contract.signature))) as definition
  from sprint9_admin_rpc_contracts contract
  where contract.mutating
)
select ok(
  position('admin_command_receipts' in definition) > 0
    or position('claim_admin_operation' in definition) > 0
    or position('claim_captain_admin_command' in definition) > 0
    or position('claim_admin_case_command' in definition) > 0,
  signature || ' claims an idempotency receipt'
) from mutation_definitions;

with mutation_definitions as (
  select contract.signature, lower(pg_get_functiondef(to_regprocedure(contract.signature))) as definition
  from sprint9_admin_rpc_contracts contract
  where contract.mutating
)
select ok(
  position('admin_audit_log' in definition) > 0
    or position('complete_admin_operation' in definition) > 0
    or position('complete_captain_admin_command' in definition) > 0
    or position('complete_admin_case_command' in definition) > 0,
  signature || ' records immutable audit state'
) from mutation_definitions;

select has_trigger(
  'private',
  'admin_audit_log',
  'prevent_admin_audit_log_mutation',
  'admin audit records are append-only'
);

select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'private'
      and tablename = 'admin_audit_log'
      and indexname = 'admin_audit_command_unique_idx'
  ),
  'one audit record is allowed per actor, action and idempotency key'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'private.admin_command_receipts'::regclass
      and conname = 'admin_command_receipts_audit_id_fkey'
      and contype = 'f'
  ),
  'idempotency receipts reference immutable audit records'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'private.admin_command_receipts'::regclass
      and conname = 'admin_command_receipts_fingerprint_sha256'
      and contype = 'c'
  ),
  'idempotency fingerprints are constrained to SHA-256 hex'
);

select ok(
  not has_table_privilege('service_role', 'private.admin_audit_log', 'UPDATE')
    and not has_table_privilege('service_role', 'private.admin_audit_log', 'DELETE'),
  'service_role cannot rewrite or delete admin audit records'
);

select ok(
  not has_table_privilege('service_role', 'private.admin_case_history', 'UPDATE')
    and not has_table_privilege('service_role', 'private.admin_case_history', 'DELETE'),
  'service_role cannot rewrite or delete case history'
);

select ok(
  not has_table_privilege('service_role', 'private.system_setting_versions', 'UPDATE')
    and not has_table_privilege('service_role', 'private.system_setting_versions', 'DELETE'),
  'service_role cannot rewrite or delete configuration history'
);

select is(
  (
    select count(*)::integer
    from information_schema.columns
    where table_schema = 'private'
      and table_name = 'admin_audit_log'
      and column_name ~ '(token|otp|secret|password|code_hash)'
  ),
  0,
  'admin audit schema has no dedicated secret-bearing columns'
);

select * from finish();
rollback;

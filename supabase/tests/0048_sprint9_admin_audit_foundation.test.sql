begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select no_plan();

select ok(to_regprocedure('public.record_admin_audit(uuid,text,text,uuid,text,text,text,uuid,jsonb,jsonb)') is not null, 'admin audit mutation RPC exists');
select ok(to_regprocedure('public.list_admin_audit(text,uuid,uuid,integer)') is not null, 'admin audit read RPC exists');
select ok(not has_function_privilege('authenticated', 'public.record_admin_audit(uuid,text,text,uuid,text,text,text,uuid,jsonb,jsonb)', 'EXECUTE'), 'clients cannot write audit records directly');
select ok(not has_table_privilege('authenticated', 'private.admin_audit_log', 'SELECT'), 'audit table remains private');
select ok(has_table_privilege('service_role', 'private.admin_audit_log', 'INSERT'), 'service role can append audit records');
select has_column('private', 'admin_audit_log', 'before_state', 'before state is retained');
select has_column('private', 'admin_audit_log', 'after_state', 'after state is retained');
select has_column('private', 'admin_command_receipts', 'request_fingerprint', 'idempotency fingerprint is durable');

select * from finish();
rollback;

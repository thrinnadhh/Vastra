begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select no_plan();

select ok(to_regprocedure('public.get_admin_merchant_operations(uuid)') is not null, 'merchant operations read RPC exists');
select ok(to_regprocedure('public.admin_set_merchant_operational_status(uuid,uuid,text,text,text,text,uuid)') is not null, 'merchant control RPC exists');
select ok(not has_function_privilege('authenticated', 'public.admin_set_merchant_operational_status(uuid,uuid,text,text,text,text,uuid)', 'EXECUTE'), 'clients cannot mutate merchant operations state');
select ok(has_function_privilege('service_role', 'public.admin_set_merchant_operational_status(uuid,uuid,text,text,text,text,uuid)', 'EXECUTE'), 'service role can execute merchant controls');

select * from finish();
rollback;

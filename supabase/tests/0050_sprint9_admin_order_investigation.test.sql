begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select no_plan();

select ok(to_regprocedure('public.get_admin_order_investigation(uuid)') is not null, 'admin order investigation RPC exists');
select ok(not has_function_privilege('authenticated', 'public.get_admin_order_investigation(uuid)', 'EXECUTE'), 'clients cannot read admin order investigations');
select ok(has_function_privilege('service_role', 'public.get_admin_order_investigation(uuid)', 'EXECUTE'), 'service role can read order investigations');

select * from finish();
rollback;

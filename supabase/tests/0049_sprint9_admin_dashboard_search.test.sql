begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select no_plan();

select ok(to_regprocedure('public.get_admin_operations_dashboard()') is not null, 'admin dashboard RPC exists');
select ok(to_regprocedure('public.search_admin_operations(text,integer)') is not null, 'admin global search RPC exists');
select ok(not has_function_privilege('authenticated', 'public.get_admin_operations_dashboard()', 'EXECUTE'), 'clients cannot query operations dashboard directly');
select ok(not has_function_privilege('authenticated', 'public.search_admin_operations(text,integer)', 'EXECUTE'), 'clients cannot invoke global operations search');
select ok(has_function_privilege('service_role', 'public.search_admin_operations(text,integer)', 'EXECUTE'), 'service role can search operational resources');

select * from finish();
rollback;

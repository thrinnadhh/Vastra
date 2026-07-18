begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select no_plan();

select ok(to_regprocedure('public.list_admin_operational_settings(text,text)') is not null, 'configuration list RPC exists');
select ok(to_regprocedure('public.admin_update_operational_setting(uuid,text,jsonb,text,text,integer,text,text,text,uuid)') is not null, 'versioned configuration update RPC exists');
select ok(not has_function_privilege('authenticated', 'public.admin_update_operational_setting(uuid,text,jsonb,text,text,integer,text,text,text,uuid)', 'EXECUTE'), 'clients cannot update operational configuration');
select has_column('private', 'system_setting_versions', 'version', 'configuration history preserves versions');
select ok(has_table_privilege('service_role', 'private.system_setting_versions', 'INSERT'), 'service role can append configuration history');

select * from finish();
rollback;

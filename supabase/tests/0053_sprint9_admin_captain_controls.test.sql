begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select no_plan();

select ok(to_regprocedure('public.get_admin_captain_operations(uuid)') is not null, 'captain operations read exists');
select ok(to_regprocedure('public.admin_set_captain_operational_status(uuid,uuid,text,text,text,text,uuid)') is not null, 'captain suspension and restore exist');
select ok(to_regprocedure('public.admin_correct_captain_availability(uuid,uuid,text,text,text,text,uuid)') is not null, 'guarded availability correction exists');
select ok(to_regprocedure('public.admin_release_captain_assignment(uuid,uuid,text,text,text,uuid)') is not null, 'safe assignment release exists');
select ok(not has_function_privilege('authenticated', 'public.admin_set_captain_operational_status(uuid,uuid,text,text,text,text,uuid)', 'EXECUTE'), 'clients cannot suspend captains');
select ok(not has_function_privilege('authenticated', 'public.admin_correct_captain_availability(uuid,uuid,text,text,text,text,uuid)', 'EXECUTE'), 'clients cannot correct availability');
select ok(has_function_privilege('service_role', 'public.admin_release_captain_assignment(uuid,uuid,text,text,text,uuid)', 'EXECUTE'), 'service role can release pre-pickup assignments');

select * from finish();
rollback;

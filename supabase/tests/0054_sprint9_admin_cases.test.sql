begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select no_plan();

select has_column('public', 'support_tickets', 'merchant_id', 'cases can reference merchants');
select has_column('public', 'support_tickets', 'captain_id', 'cases can reference captains');
select has_column('public', 'support_tickets', 'escalated_at', 'case escalation is durable');
select has_column('public', 'support_tickets', 'version', 'case mutations are versioned');
select ok(to_regprocedure('public.get_admin_case(uuid)') is not null, 'full case history read exists');
select ok(to_regprocedure('public.admin_create_case(uuid,text,text,text,text,uuid,uuid,uuid,uuid,uuid,uuid,text,text,uuid)') is not null, 'case creation exists');
select ok(to_regprocedure('public.admin_assign_case(uuid,uuid,uuid,text,text,text,text,uuid)') is not null, 'case assignment exists');
select ok(to_regprocedure('public.admin_add_case_note(uuid,uuid,text,text,text,text,uuid)') is not null, 'internal notes and evidence exist');
select ok(to_regprocedure('public.admin_escalate_case(uuid,uuid,text,text,text,uuid)') is not null, 'case escalation exists');
select ok(to_regprocedure('public.admin_resolve_case(uuid,uuid,text,text,text,text,uuid)') is not null, 'case resolution exists');
select ok(not has_function_privilege('authenticated', 'public.admin_create_case(uuid,text,text,text,text,uuid,uuid,uuid,uuid,uuid,uuid,text,text,uuid)', 'EXECUTE'), 'clients cannot create admin cases');
select ok(has_function_privilege('service_role', 'public.admin_resolve_case(uuid,uuid,text,text,text,text,uuid)', 'EXECUTE'), 'service role can resolve cases');
select ok(has_table_privilege('service_role', 'private.admin_case_history', 'INSERT'), 'service role can append case history');

select * from finish();
rollback;

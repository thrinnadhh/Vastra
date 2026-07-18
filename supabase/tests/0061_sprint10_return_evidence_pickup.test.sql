begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select no_plan();

select results_eq(
  $$select public from storage.buckets where id = 'return-evidence'$$,
  $$values (false)$$,
  'return evidence bucket is private'
);
select has_column('public', 'return_evidence', 'mime_type', 'evidence MIME type is durable');
select has_column('public', 'return_evidence', 'size_bytes', 'evidence size is durable');
select has_table('private', 'return_evidence_upload_intents', 'private evidence upload intents exist');
select ok(to_regprocedure('public.create_customer_return_evidence_intent(uuid,uuid,uuid,text,text,text,bigint)') is not null, 'evidence intent RPC exists');
select ok(to_regprocedure('public.finalize_customer_return_evidence(uuid,uuid,text,text)') is not null, 'evidence finalization RPC exists');
select ok(to_regprocedure('public.admin_assign_return_pickup(uuid,uuid,timestamptz,text,text,uuid)') is not null, 'reverse pickup command exists');
select ok(not has_function_privilege('authenticated', 'public.finalize_customer_return_evidence(uuid,uuid,text,text)', 'EXECUTE'), 'clients cannot write evidence metadata directly');
select ok(not has_function_privilege('authenticated', 'public.admin_assign_return_pickup(uuid,uuid,timestamptz,text,text,uuid)', 'EXECUTE'), 'clients cannot create reverse pickup tasks');
select ok(has_function_privilege('service_role', 'public.admin_assign_return_pickup(uuid,uuid,timestamptz,text,text,uuid)', 'EXECUTE'), 'service role can schedule reverse pickup');
select has_index('public', 'delivery_tasks', 'delivery_tasks_one_active_return_pickup_idx', 'one active pickup exists per return');

select * from finish();
rollback;

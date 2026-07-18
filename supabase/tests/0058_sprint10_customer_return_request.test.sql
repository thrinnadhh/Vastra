begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select no_plan();

select has_table('private', 'customer_return_request_receipts', 'customer return idempotency receipts exist');
select ok(to_regprocedure('public.get_customer_return_eligibility(uuid,uuid)') is not null, 'customer return eligibility RPC exists');
select ok(to_regprocedure('public.create_customer_return_request(uuid,uuid,jsonb,text,uuid)') is not null, 'customer return request RPC exists');
select ok(to_regprocedure('public.get_customer_return_request(uuid,uuid)') is not null, 'customer return read RPC exists');
select ok(not has_function_privilege('authenticated', 'public.create_customer_return_request(uuid,uuid,jsonb,text,uuid)', 'EXECUTE'), 'clients cannot create return rows directly');
select ok(not has_function_privilege('authenticated', 'public.get_customer_return_request(uuid,uuid)', 'EXECUTE'), 'clients cannot bypass the backend return read boundary');
select ok(has_function_privilege('service_role', 'public.create_customer_return_request(uuid,uuid,jsonb,text,uuid)', 'EXECUTE'), 'service role can create returns');
select ok(has_function_privilege('service_role', 'public.get_customer_return_eligibility(uuid,uuid)', 'EXECUTE'), 'service role can calculate return eligibility');
select ok(has_table_privilege('service_role', 'private.customer_return_request_receipts', 'UPDATE'), 'service role can complete return receipts');
select has_trigger('public', 'return_status_history', 'prevent_return_status_history_mutation', 'return history remains append-only');

select * from finish();
rollback;

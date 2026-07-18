begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select no_plan();

select has_column('public', 'payments', 'provider_reference_id', 'provider reference is durable');
select has_column('public', 'payments', 'provider_session_id', 'payment session is durable');
select has_column('public', 'payments', 'provider_session_expires_at', 'session expiry is durable');
select has_table('private', 'customer_online_payment_requests', 'online checkout idempotency receipts exist');
select ok(to_regprocedure('public.prepare_customer_online_payment(uuid,uuid,uuid,uuid,text,uuid)') is not null, 'online order and payment preparation RPC exists');
select ok(to_regprocedure('public.attach_customer_payment_session(uuid,uuid,text,text,text,bigint,text,timestamptz)') is not null, 'provider session attachment RPC exists');
select ok(to_regprocedure('public.get_customer_latest_payment_session(uuid,uuid)') is not null, 'customer payment session read RPC exists');
select ok(not has_function_privilege('authenticated', 'public.prepare_customer_online_payment(uuid,uuid,uuid,uuid,text,uuid)', 'EXECUTE'), 'clients cannot prepare financial state directly');
select ok(not has_function_privilege('authenticated', 'public.attach_customer_payment_session(uuid,uuid,text,text,text,bigint,text,timestamptz)', 'EXECUTE'), 'clients cannot attach provider sessions');
select ok(has_function_privilege('service_role', 'public.prepare_customer_online_payment(uuid,uuid,uuid,uuid,text,uuid)', 'EXECUTE'), 'service role can prepare online checkout');
select ok(has_function_privilege('service_role', 'public.attach_customer_payment_session(uuid,uuid,text,text,text,bigint,text,timestamptz)', 'EXECUTE'), 'service role can attach verified provider sessions');
select ok(has_table_privilege('service_role', 'private.customer_online_payment_requests', 'UPDATE'), 'service role can complete idempotency receipts');

select * from finish();
rollback;

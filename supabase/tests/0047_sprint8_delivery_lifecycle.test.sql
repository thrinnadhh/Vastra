begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select no_plan();

select ok(to_regprocedure('public.list_captain_delivery_offers(uuid)') is not null, 'captain offer read exists');
select ok(to_regprocedure('public.respond_delivery_offer(uuid,uuid,text,text,uuid)') is not null, 'exclusive offer response exists');
select ok(to_regprocedure('public.verify_delivery_pickup(uuid,uuid,text,uuid)') is not null, 'pickup verification exists');
select ok(to_regprocedure('public.get_customer_delivery_tracking(uuid,uuid)') is not null, 'customer tracking exists');
select ok(to_regprocedure('public.complete_cod_delivery(uuid,uuid,bigint,text,uuid,double precision,double precision,numeric,timestamp with time zone)') is not null, 'atomic COD completion exists');
select ok(to_regprocedure('public.admin_override_cod_delivery(uuid,uuid,bigint,text,uuid)') is not null, 'audited admin OTP override exists');
select ok(to_regprocedure('public.report_delivery_problem(uuid,uuid,text,text,text,uuid,double precision,double precision,numeric,timestamp with time zone)') is not null, 'problem reporting exists');
select ok(to_regprocedure('public.release_delivery_task(uuid,uuid,text,text,boolean,uuid,double precision,double precision,numeric,timestamp with time zone)') is not null, 'pre-pickup release exists');
select ok(to_regprocedure('public.run_delivery_dispatch_cycle(text,integer,integer,integer,integer,integer,integer,integer)') is not null, 'dispatch wave worker exists');


select like(
  pg_get_functiondef(
    'public.run_delivery_dispatch_cycle(text,integer,integer,integer,integer,integer,integer,integer)'::regprocedure
  ),
  '%start_order_dispatch%',
  'dispatch cycle starts READY_FOR_PICKUP orders idempotently'
);
select like(
  pg_get_functiondef(
    'public.run_delivery_dispatch_cycle(text,integer,integer,integer,integer,integer,integer,integer)'::regprocedure
  ),
  '%delivery.offer.expired%',
  'dispatch cycle emits durable offer-expiry events'
);
select like(
  pg_get_functiondef(
    'public.respond_delivery_offer(uuid,uuid,text,text,uuid)'::regprocedure
  ),
  '%availability_status%AVAILABLE%OFFERED%',
  'offered captains remain eligible to accept their own offer'
);
select like(
  pg_get_functiondef(
    'public.release_delivery_task(uuid,uuid,text,text,boolean,uuid,double precision,double precision,numeric,timestamp with time zone)'::regprocedure
  ),
  '%pickup_code_hash%null%',
  'pre-pickup release invalidates the previous merchant handover code'
);

select ok(not has_function_privilege('anon', 'public.respond_delivery_offer(uuid,uuid,text,text,uuid)', 'EXECUTE'), 'anon cannot accept offers');
select ok(not has_function_privilege('authenticated', 'public.complete_cod_delivery(uuid,uuid,bigint,text,uuid,double precision,double precision,numeric,timestamp with time zone)', 'EXECUTE'), 'clients cannot complete delivery directly');
select ok(not has_function_privilege('authenticated', 'public.admin_override_cod_delivery(uuid,uuid,bigint,text,uuid)', 'EXECUTE'), 'clients cannot invoke admin OTP override');
select ok(has_function_privilege('service_role', 'public.admin_override_cod_delivery(uuid,uuid,bigint,text,uuid)', 'EXECUTE'), 'service role can invoke admin OTP override');
select ok(has_function_privilege('service_role', 'public.complete_cod_delivery(uuid,uuid,bigint,text,uuid,double precision,double precision,numeric,timestamp with time zone)', 'EXECUTE'), 'service role can complete delivery');
select ok(not has_table_privilege('authenticated', 'private.delivery_command_receipts', 'SELECT'), 'idempotency receipts remain private');
select ok(has_table_privilege('service_role', 'private.delivery_command_receipts', 'INSERT'), 'service role owns command receipts');

select has_column('public', 'delivery_tasks', 'pickup_code_expires_at', 'pickup code expiry is durable');
select has_column('public', 'delivery_tasks', 'delivery_otp_expires_at', 'delivery OTP expiry is durable');
select has_column('public', 'delivery_tasks', 'pickup_code_attempts', 'pickup failures are bounded durably');
select has_column('public', 'delivery_tasks', 'delivery_otp_attempts', 'OTP failures are bounded durably');
select has_column('public', 'delivery_tasks', 'next_offer_wave_at', 'offer wave scheduling is durable');
select has_column('public', 'delivery_tasks', 'problem_reported_at', 'problem reporting is durable');

select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'delivery_assignments_one_active_captain_idx'
  ),
  'one active accepted assignment per captain is enforced'
);

select * from finish();
rollback;

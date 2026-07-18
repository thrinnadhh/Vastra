begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select no_plan();

select ok(
  to_regprocedure('public.ingest_verified_payment_event(text,text,text,text,bigint,text,timestamptz,jsonb)') is not null,
  'verified payment webhook ingestion RPC exists'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.ingest_verified_payment_event(text,text,text,text,bigint,text,timestamptz,jsonb)',
    'EXECUTE'
  ),
  'clients cannot ingest payment events directly'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.ingest_verified_payment_event(text,text,text,text,bigint,text,timestamptz,jsonb)',
    'EXECUTE'
  ),
  'service role can ingest verified payment events'
);
select col_is_null(
  'public',
  'payment_events',
  'payment_id',
  'unknown but verified provider events may be stored for later investigation'
);
select ok(
  pg_get_functiondef(
    'public.ingest_verified_payment_event(text,text,text,text,bigint,text,timestamptz,jsonb)'::regprocedure
  ) not like '%update public.payments%'
  and pg_get_functiondef(
    'public.ingest_verified_payment_event(text,text,text,text,bigint,text,timestamptz,jsonb)'::regprocedure
  ) not like '%update public.orders%',
  'ingestion does not mutate payment or order state'
);
select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'payment_events'
      and indexdef like '%provider%provider_event_id%'
      and indexdef like 'CREATE UNIQUE INDEX%'
  ),
  'provider event identity is unique'
);

select * from finish();
rollback;

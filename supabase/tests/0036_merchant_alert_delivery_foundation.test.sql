begin;

create extension if not exists pgtap
with schema extensions;

set local search_path = extensions, public;

select plan(17);

select has_type(
  'public',
  'merchant_alert_delivery_attempt_status',
  'merchant alert delivery attempt status exists'
);

select has_table(
  'public',
  'merchant_alert_delivery_attempts',
  'merchant alert delivery attempts table exists'
);

select has_column(
  'public',
  'merchant_alert_delivery_attempts',
  'outbox_event_id',
  'attempts retain the claimed outbox event'
);

select has_column(
  'public',
  'merchant_alert_delivery_attempts',
  'device_id',
  'attempts retain the destination device'
);

select has_column(
  'public',
  'merchant_alert_delivery_attempts',
  'event_attempt_number',
  'attempts retain the bounded event attempt number'
);

select has_column(
  'public',
  'merchant_alert_delivery_attempts',
  'retryable',
  'attempts classify retryability'
);

select ok(
  (
    select relrowsecurity and relforcerowsecurity
    from pg_class
    where oid = 'public.merchant_alert_delivery_attempts'::regclass
  ),
  'delivery attempts enforce row level security'
);

select ok(
  exists (
    select 1
    from pg_policy policy
    join pg_class relation
      on relation.oid = policy.polrelid
    join pg_namespace namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'merchant_alert_delivery_attempts'
      and policy.polname = 'merchant_alert_delivery_attempts_service_role_access'
      and cardinality(policy.polroles) = 1
      and (
        select oid
        from pg_roles
        where rolname = 'service_role'
      ) = any(policy.polroles)
  ),
  'delivery attempts have an explicit service-role-only policy'
);

select ok(
  to_regprocedure('public.claim_merchant_alert_dispatches(text,integer)') is not null,
  'merchant alert claim function exists'
);

select ok(
  to_regprocedure(
    'public.complete_merchant_alert_dispatch(text,uuid,uuid,text,jsonb)'
  ) is not null,
  'merchant alert completion function exists'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.claim_merchant_alert_dispatches(text,integer)',
    'EXECUTE'
  ),
  'authenticated clients cannot claim alert outbox events'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.complete_merchant_alert_dispatch(text,uuid,uuid,text,jsonb)',
    'EXECUTE'
  ),
  'authenticated clients cannot complete alert delivery events'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.claim_merchant_alert_dispatches(text,integer)',
    'EXECUTE'
  ),
  'service role can claim alert outbox events'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.complete_merchant_alert_dispatch(text,uuid,uuid,text,jsonb)',
    'EXECUTE'
  ),
  'service role can complete alert delivery events'
);

select trigger_is(
  'public',
  'merchant_alert_delivery_attempts',
  'prevent_merchant_alert_delivery_attempt_mutation',
  'private',
  'prevent_append_only_mutation',
  'delivery attempts are append-only'
);

select throws_ok(
  $$select * from public.claim_merchant_alert_dispatches('', 10)$$,
  '22023',
  'worker id is required',
  'claim rejects an empty worker id'
);

select throws_ok(
  $$select * from public.claim_merchant_alert_dispatches('test-worker', 0)$$,
  '22023',
  'claim limit must be between 1 and 100',
  'claim rejects an invalid batch size'
);

select * from finish();

rollback;

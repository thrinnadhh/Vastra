begin;

create extension if not exists pgtap
with schema extensions;

set local search_path = extensions, public;

select plan(8);

select ok(
  to_regprocedure('public.get_merchant_alert_delivery_metrics(integer)') is not null,
  'merchant alert metrics function exists'
);

select ok(
  to_regprocedure('public.list_merchant_alert_delivery_activity(integer,timestamptz)') is not null,
  'merchant alert activity function exists'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.get_merchant_alert_delivery_metrics(integer)',
    'EXECUTE'
  ),
  'authenticated clients cannot read alert metrics directly'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.list_merchant_alert_delivery_activity(integer,timestamptz)',
    'EXECUTE'
  ),
  'authenticated clients cannot read alert activity directly'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.get_merchant_alert_delivery_metrics(integer)',
    'EXECUTE'
  ),
  'service role can read alert metrics'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.list_merchant_alert_delivery_activity(integer,timestamptz)',
    'EXECUTE'
  ),
  'service role can read alert activity'
);

select throws_ok(
  $$select public.get_merchant_alert_delivery_metrics(4)$$,
  '22023',
  'metrics window must be between 5 and 10080 minutes',
  'metrics reject a window that is too small'
);

select throws_ok(
  $$select public.get_merchant_alert_delivery_metrics(10081)$$,
  '22023',
  'metrics window must be between 5 and 10080 minutes',
  'metrics reject a window that is too large'
);

select * from finish();

rollback;

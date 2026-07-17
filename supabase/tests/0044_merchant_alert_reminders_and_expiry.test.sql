begin;

create extension if not exists pgtap
with schema extensions;

set local search_path = extensions, public;

select plan(14);

select has_column(
  'public',
  'merchant_order_alerts',
  'reminder_count',
  'merchant alerts retain their durable reminder count'
);

select has_column(
  'public',
  'merchant_order_alerts',
  'last_reminder_at',
  'merchant alerts retain the last reminder time'
);

select has_column(
  'public',
  'merchant_order_alerts',
  'next_reminder_at',
  'merchant alerts retain the next reminder time'
);

select has_column(
  'public',
  'merchant_order_alerts',
  'expired_at',
  'merchant alerts retain durable expiry time'
);

select ok(
  to_regprocedure('public.process_due_merchant_order_alerts(text,integer)') is not null,
  'merchant alert scheduler function exists'
);

select ok(
  exists (
    select 1
    from pg_proc procedure
    join pg_namespace namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = 'process_due_merchant_order_alerts'
      and procedure.prosecdef
      and lower(procedure.prosrc) like '%skip locked%'
  ),
  'scheduler is security definer and uses SKIP LOCKED'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.process_due_merchant_order_alerts(text,integer)',
    'EXECUTE'
  ),
  'authenticated clients cannot schedule merchant alerts'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.process_due_merchant_order_alerts(text,integer)',
    'EXECUTE'
  ),
  'service role can schedule merchant alerts'
);

select trigger_is(
  'public',
  'merchant_order_alerts',
  'initialize_merchant_alert_schedule',
  'private',
  'initialize_merchant_alert_schedule',
  'new merchant alerts initialize their reminder schedule'
);

select trigger_is(
  'public',
  'merchant_order_alerts',
  'synchronize_merchant_alert_schedule',
  'private',
  'initialize_merchant_alert_schedule',
  'terminal alert updates clear their reminder schedule'
);

select ok(
  to_regclass('public.merchant_order_alerts_schedule_idx') is not null,
  'due merchant alerts have a partial scheduler index'
);

select throws_ok(
  $$select public.process_due_merchant_order_alerts('', 50)$$,
  '22023',
  'worker id is required',
  'scheduler rejects an empty worker id'
);

select throws_ok(
  $$select public.process_due_merchant_order_alerts('scheduler-test', 0)$$,
  '22023',
  'schedule limit must be between 1 and 250',
  'scheduler rejects a zero batch size'
);

select throws_ok(
  $$select public.process_due_merchant_order_alerts('scheduler-test', 251)$$,
  '22023',
  'schedule limit must be between 1 and 250',
  'scheduler rejects an excessive batch size'
);

select * from finish();

rollback;

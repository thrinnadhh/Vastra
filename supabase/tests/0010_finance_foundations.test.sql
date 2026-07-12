begin;

create extension if not exists pgtap
with schema extensions;

set local search_path = extensions, public;

select plan(28);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'merchant_settlement_status'
  ),
  'DRAFT,REVIEW,APPROVED,PROCESSING,PAID,FAILED,ON_HOLD',
  'merchant settlement statuses are defined'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'captain_earning_status'
  ),
  'PENDING,AVAILABLE,INCLUDED_IN_PAYOUT,PAID,REVERSED',
  'captain earning statuses are defined'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'captain_payout_status'
  ),
  'DRAFT,REVIEW,APPROVED,PROCESSING,PAID,FAILED,ON_HOLD',
  'captain payout statuses are defined'
);

select ok(to_regclass('public.merchant_settlements') is not null, 'merchant settlements exist');
select ok(to_regclass('public.merchant_settlement_items') is not null, 'merchant settlement items exist');
select ok(to_regclass('public.captain_earnings') is not null, 'captain earnings exist');
select ok(to_regclass('public.captain_payouts') is not null, 'captain payouts exist');
select ok(to_regclass('public.captain_payout_items') is not null, 'captain payout items exist');

select is(
  (
    select count(*)::integer
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'merchant_settlements',
        'merchant_settlement_items',
        'captain_earnings',
        'captain_payouts',
        'captain_payout_items'
      )
      and c.relrowsecurity
      and c.relforcerowsecurity
  ),
  5,
  'all finance tables force RLS'
);

select is(
  (
    select count(*)::integer
    from (
      values
        ('merchant_settlements'),
        ('merchant_settlement_items'),
        ('captain_earnings'),
        ('captain_payouts'),
        ('captain_payout_items')
    ) as t(table_name)
    where has_table_privilege(
      'anon',
      format('public.%I', table_name),
      'SELECT'
    )
  ),
  0,
  'anon table grants match the final RLS surface'
);

select is(
  (
    select count(*)::integer
    from (
      values
        ('merchant_settlements'),
        ('merchant_settlement_items'),
        ('captain_earnings'),
        ('captain_payouts'),
        ('captain_payout_items')
    ) as t(table_name)
    where has_table_privilege(
      'authenticated',
      format('public.%I', table_name),
      'SELECT'
    )
  ),
  5,
  'authenticated table grants match the final RLS surface'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'merchant_settlements_shop_id_fkey'
  ),
  'merchant settlements reference shops'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname =
      'merchant_settlements_bank_account_id_fkey'
  ),
  'merchant settlements reference bank accounts'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname =
      'merchant_settlements_shop_period_key'
      and contype = 'u'
  ),
  'merchant settlement periods are unique per shop'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'merchant_settlements_arithmetic'
      and contype = 'c'
  ),
  'merchant settlement totals are constrained'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid =
      'public.merchant_settlements'::regclass
      and tgname =
        'set_merchant_settlements_updated_at'
      and not tgisinternal
  ),
  'merchant settlements have an updated_at trigger'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname =
      'merchant_settlement_items_reference_shape'
      and contype = 'c'
  ),
  'merchant ledger references match entry type'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'captain_earnings_captain_id_fkey'
  ),
  'captain earnings reference captains'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname =
      'captain_earnings_delivery_task_id_fkey'
  ),
  'captain earnings reference delivery tasks'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname =
      'captain_earnings_delivery_task_key'
      and contype = 'u'
  ),
  'each delivery task has one earning record'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'captain_earnings_arithmetic'
      and contype = 'c'
  ),
  'captain earning totals are constrained'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'captain_payouts_captain_id_fkey'
  ),
  'captain payouts reference captains'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname =
      'captain_payouts_captain_period_key'
      and contype = 'u'
  ),
  'captain payout periods are unique'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'captain_payouts_arithmetic'
      and contype = 'c'
  ),
  'captain payout totals are constrained'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.captain_payouts'::regclass
      and tgname = 'set_captain_payouts_updated_at'
      and not tgisinternal
  ),
  'captain payouts have an updated_at trigger'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'captain_payout_items_payout_id_fkey'
  ),
  'captain payout items reference payouts'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname =
      'captain_payout_items_captain_earning_id_fkey'
  ),
  'captain payout items may reference earnings'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname =
      'captain_payout_items_earning_reference'
      and contype = 'c'
  ),
  'earning entries require an earning reference'
);

select * from finish();

rollback;

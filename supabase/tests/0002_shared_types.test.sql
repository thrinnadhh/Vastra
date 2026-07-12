begin;

create extension if not exists pgtap
with schema extensions;

set local search_path = extensions, public;

select plan(20);

select ok(
  exists (
    select 1
    from pg_extension
    where extname = 'postgis'
  ),
  'PostGIS extension is installed'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'account_type'
  ),
  'CUSTOMER,MERCHANT,CAPTAIN,ADMIN',
  'account_type contains the supported application account types'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'order_status'
  ),
  'PAYMENT_PENDING,WAITING_FOR_MERCHANT,MERCHANT_ACCEPTED,PACKING,READY_FOR_PICKUP,CAPTAIN_SEARCHING,CAPTAIN_ASSIGNED,CAPTAIN_AT_STORE,PICKED_UP,OUT_FOR_DELIVERY,CAPTAIN_AT_CUSTOMER,DELIVERED,COMPLETED,PROBLEM_REPORTED,CANCELLED',
  'order_status matches the frozen order state machine'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'merchant_order_rejection_reason'
  ),
  'OUT_OF_STOCK,SIZE_UNAVAILABLE,COLOUR_UNAVAILABLE,DAMAGED_ITEM,INVENTORY_MISMATCH,ITEM_NOT_FOUND,SHOP_BUSY,SHOP_CLOSING,OTHER',
  'merchant rejection reasons match the frozen business rules'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'wardrobe_item_status'
  ),
  'ACTIVE,DELETED',
  'wardrobe item statuses are defined'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'saved_look_item_type'
  ),
  'WARDROBE_ITEM,PRODUCT_VARIANT',
  'saved look item types are defined'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'group_room_status'
  ),
  'OPEN,CLOSED',
  'group room statuses are defined'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'group_room_member_role'
  ),
  'OWNER,PARTICIPANT',
  'group room member roles are defined'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'group_room_member_status'
  ),
  'ACTIVE,REMOVED',
  'group room member statuses are defined'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'group_room_share_type'
  ),
  'PRODUCT_VARIANT,SAVED_LOOK',
  'group room share types are defined'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'group_room_vote'
  ),
  'LOVE,MAYBE,SKIP',
  'group room vote values are defined'
);

select ok(
  to_regtype('public.money_paise') is not null,
  'money_paise domain exists'
);

select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_type t on t.oid = c.contypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'money_paise'
      and c.contype = 'c'
  ),
  'money_paise has a check constraint'
);

select ok(
  to_regtype('public.non_negative_quantity') is not null,
  'non_negative_quantity domain exists'
);

select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_type t on t.oid = c.contypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'non_negative_quantity'
      and c.contype = 'c'
  ),
  'non_negative_quantity has a check constraint'
);

select ok(
  to_regtype('public.positive_quantity') is not null,
  'positive_quantity domain exists'
);

select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_type t on t.oid = c.contypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'positive_quantity'
      and c.contype = 'c'
  ),
  'positive_quantity has a check constraint'
);

select ok(
  to_regtype('public.rating_value') is not null,
  'rating_value domain exists'
);

select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_type t on t.oid = c.contypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'rating_value'
      and c.contype = 'c'
  ),
  'rating_value has a check constraint'
);

select ok(
  to_regprocedure('public.set_updated_at()') is not null,
  'set_updated_at trigger function exists'
);

select * from finish();

rollback;

begin;

create extension if not exists pgtap
with schema extensions;

set local search_path = extensions, public;

select plan(50);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'inventory_movement_type'
  ),
  'STOCK_RECEIVED,OFFLINE_SALE,ONLINE_ORDER_RESERVED,ONLINE_ORDER_RELEASED,ONLINE_ORDER_COMPLETED,RETURN_TO_STOCK,MARKED_DAMAGED,STOCK_CORRECTION,STOCK_AUDIT',
  'inventory movement types are defined'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'inventory_source_method'
  ),
  'BARCODE,PHOTO_MATCH,MANUAL_SEARCH,SYSTEM,ADMIN',
  'inventory source methods are defined'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'inventory_reservation_status'
  ),
  'ACTIVE,CONVERTED,RELEASED,EXPIRED',
  'inventory reservation statuses are defined'
);

select ok(
  to_regclass('public.inventory_balances') is not null,
  'inventory_balances table exists'
);

select ok(
  to_regclass('public.inventory_movements') is not null,
  'inventory_movements table exists'
);

select ok(
  to_regclass('public.inventory_reservations') is not null,
  'inventory_reservations table exists'
);

select is(
  (
    select count(*)::integer
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'inventory_balances',
        'inventory_movements',
        'inventory_reservations'
      )
      and c.relrowsecurity
      and c.relforcerowsecurity
  ),
  3,
  'all inventory tables force row-level security'
);

select is(
  (
    select count(*)::integer
    from (
      values
        ('inventory_balances'),
        ('inventory_movements'),
        ('inventory_reservations')
    ) as secured_tables(table_name)
    where has_table_privilege(
      'anon',
      format('public.%I', table_name),
      'SELECT'
    )
  ),
  0,
  'anonymous clients have no inventory grants'
);

select is(
  (
    select count(*)::integer
    from (
      values
        ('inventory_balances'),
        ('inventory_movements'),
        ('inventory_reservations')
    ) as secured_tables(table_name)
    where has_table_privilege(
      'authenticated',
      format('public.%I', table_name),
      'SELECT'
    )
  ),
  0,
  'authenticated clients have no inventory grants'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'inventory_balances_shop_id_fkey'
      and conrelid = 'public.inventory_balances'::regclass
      and confrelid = 'public.shops'::regclass
  ),
  'inventory balances reference shops'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'inventory_balances_variant_shop_fkey'
      and conrelid = 'public.inventory_balances'::regclass
      and confrelid = 'public.product_variants'::regclass
  ),
  'inventory balances require a matching variant and shop'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'inventory_balances_shop_variant_key'
      and conrelid = 'public.inventory_balances'::regclass
      and contype = 'u'
  ),
  'each shop variant has one authoritative balance'
);

select ok(
  exists (
    select 1
    from pg_attribute
    where attrelid = 'public.inventory_balances'::regclass
      and attname = 'stock_on_hand'
      and atttypid = 'public.non_negative_quantity'::regtype
      and not attisdropped
  ),
  'stock on hand is non-negative'
);

select ok(
  exists (
    select 1
    from pg_attribute
    where attrelid = 'public.inventory_balances'::regclass
      and attname = 'reserved_quantity'
      and atttypid = 'public.non_negative_quantity'::regtype
      and not attisdropped
  ),
  'reserved quantity is non-negative'
);

select ok(
  exists (
    select 1
    from pg_attribute
    where attrelid = 'public.inventory_balances'::regclass
      and attname = 'damaged_quantity'
      and atttypid = 'public.non_negative_quantity'::regtype
      and not attisdropped
  ),
  'damaged quantity is non-negative'
);

select ok(
  exists (
    select 1
    from pg_attribute
    where attrelid = 'public.inventory_balances'::regclass
      and attname = 'reorder_level'
      and atttypid = 'public.non_negative_quantity'::regtype
      and not attisdropped
  ),
  'reorder level is non-negative'
);

select ok(
  exists (
    select 1
    from pg_attribute
    where attrelid = 'public.inventory_balances'::regclass
      and attname = 'version'
      and atttypid = 'public.positive_quantity'::regtype
      and not attisdropped
  ),
  'inventory version remains positive'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'inventory_balances_available_quantity_check'
      and conrelid = 'public.inventory_balances'::regclass
      and contype = 'c'
  ),
  'reserved and damaged quantities cannot exceed stock'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.inventory_balances'::regclass
      and tgname = 'set_inventory_balances_updated_at'
      and not tgisinternal
  ),
  'inventory balances have an updated_at trigger'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'inventory_movements_shop_id_fkey'
      and conrelid = 'public.inventory_movements'::regclass
      and confrelid = 'public.shops'::regclass
  ),
  'inventory movements reference shops'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'inventory_movements_variant_shop_fkey'
      and conrelid = 'public.inventory_movements'::regclass
      and confrelid = 'public.product_variants'::regclass
  ),
  'inventory movements require a matching variant and shop'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'inventory_movements_performed_by_fkey'
      and conrelid = 'public.inventory_movements'::regclass
      and confrelid = 'public.profiles'::regclass
  ),
  'inventory movement actors reference profiles'
);

select ok(
  exists (
    select 1
    from pg_attribute
    where attrelid = 'public.inventory_movements'::regclass
      and attname = 'movement_type'
      and atttypid = 'public.inventory_movement_type'::regtype
      and not attisdropped
  ),
  'inventory movements use movement types'
);

select ok(
  exists (
    select 1
    from pg_attribute
    where attrelid = 'public.inventory_movements'::regclass
      and attname = 'source_method'
      and atttypid = 'public.inventory_source_method'::regtype
      and not attisdropped
  ),
  'inventory movements use source methods'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'inventory_movements_stock_arithmetic_check'
      and conrelid = 'public.inventory_movements'::regclass
      and contype = 'c'
  ),
  'stock movement arithmetic is constrained'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'inventory_movements_reserved_arithmetic_check'
      and conrelid = 'public.inventory_movements'::regclass
      and contype = 'c'
  ),
  'reserved movement arithmetic is constrained'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'inventory_movements_damaged_arithmetic_check'
      and conrelid = 'public.inventory_movements'::regclass
      and contype = 'c'
  ),
  'damaged movement arithmetic is constrained'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'inventory_movements_before_available_check'
      and conrelid = 'public.inventory_movements'::regclass
      and contype = 'c'
  ),
  'movement before-state must be valid'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'inventory_movements_after_available_check'
      and conrelid = 'public.inventory_movements'::regclass
      and contype = 'c'
  ),
  'movement after-state must be valid'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.inventory_movements'::regclass
      and tgname = 'prevent_inventory_movement_mutation'
      and not tgisinternal
  ),
  'inventory movements are protected by an immutability trigger'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'inventory_reservations_shop_id_fkey'
      and conrelid = 'public.inventory_reservations'::regclass
      and confrelid = 'public.shops'::regclass
  ),
  'inventory reservations reference shops'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'inventory_reservations_variant_shop_fkey'
      and conrelid = 'public.inventory_reservations'::regclass
      and confrelid = 'public.product_variants'::regclass
  ),
  'inventory reservations require a matching variant and shop'
);

select ok(
  exists (
    select 1
    from pg_attribute
    where attrelid = 'public.inventory_reservations'::regclass
      and attname = 'quantity'
      and atttypid = 'public.positive_quantity'::regtype
      and not attisdropped
  ),
  'reservation quantity is positive'
);

select ok(
  exists (
    select 1
    from pg_attribute
    where attrelid = 'public.inventory_reservations'::regclass
      and attname = 'status'
      and atttypid = 'public.inventory_reservation_status'::regtype
      and not attisdropped
  ),
  'inventory reservations use reservation statuses'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'inventory_reservations_reference_check'
      and conrelid = 'public.inventory_reservations'::regclass
      and contype = 'c'
  ),
  'reservations require a cart or order reference'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'inventory_reservations_lifecycle_check'
      and conrelid = 'public.inventory_reservations'::regclass
      and contype = 'c'
  ),
  'reservation release timestamps follow lifecycle state'
);

select ok(
  to_regclass(
    'public.inventory_reservations_active_cart_variant_idx'
  ) is not null,
  'active cart reservations are unique by variant'
);

select ok(
  to_regclass(
    'public.inventory_reservations_active_order_variant_idx'
  ) is not null,
  'active order reservations are unique by variant'
);

select ok(
  to_regprocedure(
    'private.apply_inventory_delta(uuid,uuid,integer,integer,integer,public.inventory_movement_type,public.inventory_source_method,text,uuid,text,uuid)'
  ) is not null,
  'trusted inventory delta function exists'
);

select ok(
  to_regprocedure(
    'private.reserve_inventory(uuid,uuid,integer,timestamptz,uuid,uuid,uuid)'
  ) is not null,
  'concurrency-safe inventory reservation function exists'
);

select ok(
  to_regprocedure(
    'private.release_inventory_reservation(uuid,public.inventory_reservation_status,text,uuid)'
  ) is not null,
  'inventory reservation release function exists'
);

select ok(
  not has_schema_privilege('anon', 'private', 'USAGE'),
  'anonymous clients cannot use the private schema'
);

select ok(
  not has_schema_privilege(
    'authenticated',
    'private',
    'USAGE'
  ),
  'authenticated clients cannot use the private schema'
);

select is(
  (
    select count(*)::integer
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname in (
        'apply_inventory_delta',
        'reserve_inventory',
        'release_inventory_reservation'
      )
      and has_function_privilege(
        'anon',
        p.oid,
        'EXECUTE'
      )
  ),
  0,
  'anonymous clients cannot execute inventory functions'
);

select is(
  (
    select count(*)::integer
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname in (
        'apply_inventory_delta',
        'reserve_inventory',
        'release_inventory_reservation'
      )
      and has_function_privilege(
        'authenticated',
        p.oid,
        'EXECUTE'
      )
  ),
  0,
  'authenticated clients cannot execute inventory functions'
);

select ok(
  has_schema_privilege(
    'service_role',
    'private',
    'USAGE'
  ),
  'service role can use the private inventory schema'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'apply_inventory_delta'
      and has_function_privilege(
        'service_role',
        p.oid,
        'EXECUTE'
      )
  ),
  'service role can execute inventory deltas'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'reserve_inventory'
      and has_function_privilege(
        'service_role',
        p.oid,
        'EXECUTE'
      )
  ),
  'service role can reserve inventory'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'release_inventory_reservation'
      and has_function_privilege(
        'service_role',
        p.oid,
        'EXECUTE'
      )
  ),
  'service role can release inventory reservations'
);

select ok(
  exists (
    select 1
    from pg_attribute
    where attrelid = 'public.inventory_movements'::regclass
      and attname = 'id'
      and attidentity = 'a'
      and not attisdropped
  ),
  'inventory movement IDs use an identity sequence'
);

select * from finish();

rollback;

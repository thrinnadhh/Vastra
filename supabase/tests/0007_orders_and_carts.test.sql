begin;

create extension if not exists pgtap
with schema extensions;

set local search_path = extensions, public;

select plan(78);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'cart_status'
  ),
  'ACTIVE,CONVERTED,ABANDONED,EXPIRED',
  'cart statuses are defined'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'order_payment_status'
  ),
  'PENDING,AUTHORIZED,CAPTURED,FAILED,PARTIALLY_REFUNDED,REFUNDED,COD_PENDING,COD_COLLECTED',
  'order payment statuses are defined'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'order_fulfilment_type'
  ),
  'DELIVERY,CUSTOMER_PICKUP',
  'order fulfilment types are defined'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'order_item_fulfilment_status'
  ),
  'PENDING,VERIFIED,PACKED,HANDED_OVER,RETURNED,CANCELLED',
  'order item fulfilment statuses are defined'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'order_actor_role'
  ),
  'SYSTEM,CUSTOMER,MERCHANT,CAPTAIN,ADMIN',
  'order actor roles are defined'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'merchant_alert_status'
  ),
  'PENDING,SENT,DELIVERED,ACKNOWLEDGED,EXPIRED,FAILED',
  'merchant alert statuses are defined'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'merchant_issue_resolution_status'
  ),
  'OPEN,ACCEPTED,RESOLVED,REJECTED',
  'merchant issue resolution statuses are defined'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'order_item_verification_method'
  ),
  'BARCODE,MANUAL',
  'MVP verification methods exclude photo matching'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'order_item_verification_result'
  ),
  'MATCH,MISMATCH,OVERRIDDEN',
  'verification results are defined'
);

select ok(to_regclass('public.carts') is not null, 'carts exist');
select ok(to_regclass('public.cart_items') is not null, 'cart items exist');
select ok(to_regclass('public.orders') is not null, 'orders exist');
select ok(to_regclass('public.order_items') is not null, 'order items exist');
select ok(to_regclass('public.order_status_history') is not null, 'order history exists');
select ok(to_regclass('public.merchant_order_alerts') is not null, 'merchant alerts exist');
select ok(to_regclass('public.merchant_order_issues') is not null, 'merchant issues exist');
select ok(to_regclass('public.order_item_verifications') is not null, 'item verifications exist');

select is(
  (
    select count(*)::integer
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'carts',
        'cart_items',
        'orders',
        'order_items',
        'order_status_history',
        'merchant_order_alerts',
        'merchant_order_issues',
        'order_item_verifications'
      )
      and c.relrowsecurity
      and c.relforcerowsecurity
  ),
  8,
  'all order tables force RLS'
);

select is(
  (
    select count(*)::integer
    from (
      values
        ('carts'),
        ('cart_items'),
        ('orders'),
        ('order_items'),
        ('order_status_history'),
        ('merchant_order_alerts'),
        ('merchant_order_issues'),
        ('order_item_verifications')
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
        ('carts'),
        ('cart_items'),
        ('orders'),
        ('order_items'),
        ('order_status_history'),
        ('merchant_order_alerts'),
        ('merchant_order_issues'),
        ('order_item_verifications')
    ) as t(table_name)
    where has_table_privilege(
      'authenticated',
      format('public.%I', table_name),
      'SELECT'
    )
  ),
  8,
  'authenticated table grants match the final RLS surface'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'carts_customer_id_fkey'
  ),
  'carts reference customers'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'carts_shop_id_fkey'
  ),
  'carts reference shops'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'carts_id_customer_shop_key'
      and contype = 'u'
  ),
  'carts expose a customer-shop composite key'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'carts_id_shop_id_key'
      and contype = 'u'
  ),
  'carts expose a cart-shop composite key'
);

select ok(
  to_regclass('public.carts_one_active_per_customer_idx')
    is not null,
  'customers have at most one active cart'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.carts'::regclass
      and tgname = 'set_carts_updated_at'
      and not tgisinternal
  ),
  'carts have an updated_at trigger'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'cart_items_cart_shop_fkey'
  ),
  'cart items belong to their cart shop'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'cart_items_variant_shop_fkey'
  ),
  'cart variants belong to their cart shop'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'cart_items_cart_variant_key'
      and contype = 'u'
  ),
  'cart variants are unique per cart'
);

select ok(
  exists (
    select 1 from pg_attribute
    where attrelid = 'public.cart_items'::regclass
      and attname = 'quantity'
      and atttypid = 'public.positive_quantity'::regtype
      and not attisdropped
  ),
  'cart quantities are positive'
);

select ok(
  exists (
    select 1 from pg_attribute
    where attrelid = 'public.cart_items'::regclass
      and attname = 'unit_price_snapshot_paise'
      and atttypid = 'public.money_paise'::regtype
      and not attisdropped
  ),
  'cart price snapshots use paise'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.cart_items'::regclass
      and tgname = 'set_cart_items_updated_at'
      and not tgisinternal
  ),
  'cart items have an updated_at trigger'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'addresses_id_user_id_key'
      and contype = 'u'
  ),
  'addresses expose an owner composite key'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'orders_customer_id_fkey'
  ),
  'orders reference customers'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'orders_shop_id_fkey'
  ),
  'orders reference shops'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'orders_cart_customer_shop_fkey'
  ),
  'orders require a matching customer cart and shop'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'orders_delivery_address_customer_fkey'
  ),
  'delivery addresses must belong to the customer'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'orders_order_number_key'
      and contype = 'u'
  ),
  'order numbers are unique'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'orders_id_shop_id_key'
      and contype = 'u'
  ),
  'orders expose an order-shop composite key'
);

select ok(
  to_regclass('public.orders_customer_idempotency_key_idx')
    is not null,
  'order placement is protected by idempotency'
);

select ok(
  exists (
    select 1 from pg_attribute
    where attrelid = 'public.orders'::regclass
      and attname = 'status'
      and atttypid = 'public.order_status'::regtype
      and not attisdropped
  ),
  'orders use the frozen order status enum'
);

select ok(
  exists (
    select 1 from pg_attribute
    where attrelid = 'public.orders'::regclass
      and attname = 'payment_status'
      and atttypid = 'public.order_payment_status'::regtype
      and not attisdropped
  ),
  'orders use payment statuses'
);

select ok(
  exists (
    select 1 from pg_attribute
    where attrelid = 'public.orders'::regclass
      and attname = 'fulfilment_type'
      and atttypid = 'public.order_fulfilment_type'::regtype
      and not attisdropped
  ),
  'orders use fulfilment types'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'orders_total_arithmetic'
      and contype = 'c'
  ),
  'order totals are arithmetically constrained'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'orders_address_snapshot_object'
      and contype = 'c'
  ),
  'order address snapshots must be JSON objects'
);

select ok(
  exists (
    select 1 from pg_attribute
    where attrelid = 'public.orders'::regclass
      and attname = 'version'
      and atttypid = 'public.positive_quantity'::regtype
      and not attisdropped
  ),
  'order versions remain positive'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.orders'::regclass
      and tgname = 'set_orders_updated_at'
      and not tgisinternal
  ),
  'orders have an updated_at trigger'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.orders'::regclass
      and tgname = 'guard_order_status_update'
      and not tgisinternal
  ),
  'direct order status changes are guarded'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.orders'::regclass
      and tgname = 'record_initial_order_status'
      and not tgisinternal
  ),
  'initial order status is recorded'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'order_items_order_shop_fkey'
  ),
  'order items belong to their order shop'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'order_items_product_shop_fkey'
  ),
  'order products belong to their order shop'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'order_items_variant_product_fkey'
  ),
  'ordered variants belong to their product'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'order_items_order_variant_key'
      and contype = 'u'
  ),
  'variants are unique per order'
);

select ok(
  exists (
    select 1 from pg_attribute
    where attrelid = 'public.order_items'::regclass
      and attname = 'quantity'
      and atttypid = 'public.positive_quantity'::regtype
      and not attisdropped
  ),
  'ordered quantities are positive'
);

select ok(
  exists (
    select 1 from pg_attribute
    where attrelid = 'public.order_items'::regclass
      and attname = 'unit_mrp_paise'
      and atttypid = 'public.money_paise'::regtype
      and not attisdropped
  ),
  'ordered MRP uses paise'
);

select ok(
  exists (
    select 1 from pg_attribute
    where attrelid = 'public.order_items'::regclass
      and attname = 'unit_selling_price_paise'
      and atttypid = 'public.money_paise'::regtype
      and not attisdropped
  ),
  'ordered selling prices use paise'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'order_items_total_arithmetic'
      and contype = 'c'
  ),
  'order item totals are constrained'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'order_status_history_order_id_fkey'
  ),
  'order history references orders'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname =
      'order_status_history_changed_by_user_id_fkey'
  ),
  'order history actors reference profiles'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.order_status_history'::regclass
      and tgname = 'prevent_order_status_history_mutation'
      and not tgisinternal
  ),
  'order status history is append-only'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'merchant_order_alerts_order_id_fkey'
  ),
  'merchant alerts reference orders'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'merchant_order_alerts_shop_id_fkey'
  ),
  'merchant alerts reference shops'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'merchant_order_alerts_lifecycle_check'
      and contype = 'c'
  ),
  'merchant alert lifecycle is constrained'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'merchant_order_issues_order_id_fkey'
  ),
  'merchant issues reference orders'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'merchant_order_issues_order_item_id_fkey'
  ),
  'merchant issues may reference an order item'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'merchant_order_issues_issue_type_check'
      and contype = 'c'
  ),
  'merchant issues use frozen MVP reasons'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname =
      'merchant_order_issues_resolution_consistency'
      and contype = 'c'
  ),
  'merchant issue resolution state is constrained'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname =
      'order_item_verifications_order_item_id_fkey'
  ),
  'verifications reference order items'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname =
      'order_item_verifications_verified_variant_id_fkey'
  ),
  'verified variants reference catalogue variants'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'order_item_verifications_method_shape'
      and contype = 'c'
  ),
  'verification method payloads are constrained'
);

select ok(
  to_regprocedure(
    'private.is_order_transition_allowed(public.order_status,public.order_status)'
  ) is not null,
  'order transition predicate exists'
);

select ok(
  to_regprocedure(
    'private.transition_order_state(uuid,public.order_status,uuid,public.order_actor_role,text,text)'
  ) is not null,
  'locked order transition function exists'
);

select ok(
  not has_function_privilege(
    'anon',
    'private.transition_order_state(uuid,public.order_status,uuid,public.order_actor_role,text,text)',
    'EXECUTE'
  ),
  'anonymous clients cannot transition orders'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.transition_order_state(uuid,public.order_status,uuid,public.order_actor_role,text,text)',
    'EXECUTE'
  ),
  'authenticated clients cannot transition orders directly'
);

select ok(
  has_function_privilege(
    'service_role',
    'private.transition_order_state(uuid,public.order_status,uuid,public.order_actor_role,text,text)',
    'EXECUTE'
  ),
  'service role can transition orders'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'inventory_reservations_cart_id_fkey'
  ),
  'inventory reservations reference carts'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'inventory_reservations_order_id_fkey'
  ),
  'inventory reservations reference orders'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname =
      'inventory_reservations_exactly_one_reference'
      and contype = 'c'
  ),
  'inventory reservations use exactly one owner reference'
);

select * from finish();

rollback;

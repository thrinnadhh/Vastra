begin;

select plan(13);

select ok(
  to_regclass('public.merchant_low_stock_inventory') is not null,
  'merchant low-stock read model exists'
);

select ok(
  to_regclass('public.inventory_balances_low_stock_read_idx') is not null,
  'low-stock partial ordering index exists'
);

select ok(
  has_table_privilege(
    'authenticated',
    'public.merchant_low_stock_inventory',
    'SELECT'
  ),
  'authenticated merchants can query the read model through RLS'
);

select ok(
  not has_table_privilege(
    'anon',
    'public.merchant_low_stock_inventory',
    'SELECT'
  ),
  'anonymous users cannot query merchant low-stock inventory'
);

select ok(
  exists (
    select 1
    from pg_class relation
    where relation.oid =
      'public.merchant_low_stock_inventory'::regclass
      and 'security_invoker=true' = any(relation.reloptions)
  ),
  'low-stock view executes with invoker permissions'
);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    'a1100000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'low-stock-merchant-one@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    'a1100000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'low-stock-merchant-two@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.profiles (
  id,
  account_type,
  full_name,
  status
)
values
  (
    'a1100000-0000-4000-8000-000000000001',
    'MERCHANT',
    'Low Stock Merchant One',
    'ACTIVE'
  ),
  (
    'a1100000-0000-4000-8000-000000000002',
    'MERCHANT',
    'Low Stock Merchant Two',
    'ACTIVE'
  );

insert into public.merchant_profiles (
  user_id,
  legal_name
)
values
  (
    'a1100000-0000-4000-8000-000000000001',
    'Low Stock Merchant One Legal'
  ),
  (
    'a1100000-0000-4000-8000-000000000002',
    'Low Stock Merchant Two Legal'
  );

insert into public.addresses (
  id,
  user_id,
  label,
  recipient_name,
  phone_number,
  line1,
  area,
  city,
  state,
  postal_code,
  country_code,
  location
)
values
  (
    'a1200000-0000-4000-8000-000000000001',
    'a1100000-0000-4000-8000-000000000001',
    'Shop',
    'Low Stock Merchant One',
    '9000000031',
    'Low Stock Street One',
    'Tirupati',
    'Tirupati',
    'Andhra Pradesh',
    '517501',
    'IN',
    'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography
  ),
  (
    'a1200000-0000-4000-8000-000000000002',
    'a1100000-0000-4000-8000-000000000002',
    'Shop',
    'Low Stock Merchant Two',
    '9000000032',
    'Low Stock Street Two',
    'Tirupati',
    'Tirupati',
    'Andhra Pradesh',
    '517501',
    'IN',
    'SRID=4326;POINT(79.4200 13.6290)'::extensions.geography
  );

insert into public.shops (
  id,
  merchant_id,
  address_id,
  shop_code,
  name,
  slug,
  phone_number,
  location,
  verification_status,
  operational_status,
  accepts_online_orders
)
values
  (
    'a1300000-0000-4000-8000-000000000001',
    'a1100000-0000-4000-8000-000000000001',
    'a1200000-0000-4000-8000-000000000001',
    'LOW-STOCK-ONE',
    'Low Stock Shop One',
    'low-stock-shop-one',
    '9000000033',
    'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography,
    'VERIFIED',
    'OPEN',
    true
  ),
  (
    'a1300000-0000-4000-8000-000000000002',
    'a1100000-0000-4000-8000-000000000002',
    'a1200000-0000-4000-8000-000000000002',
    'LOW-STOCK-TWO',
    'Low Stock Shop Two',
    'low-stock-shop-two',
    '9000000034',
    'SRID=4326;POINT(79.4200 13.6290)'::extensions.geography,
    'VERIFIED',
    'OPEN',
    true
  );

insert into public.products (
  id,
  shop_id,
  category_id,
  name,
  slug,
  brand,
  moderation_status,
  is_active
)
values
  (
    'a1400000-0000-4000-8000-000000000001',
    'a1300000-0000-4000-8000-000000000001',
    '30000000-0000-0000-0000-000000000002',
    'Active Low Stock Kurta',
    'active-low-stock-kurta',
    'Vastra',
    'APPROVED',
    true
  ),
  (
    'a1400000-0000-4000-8000-000000000002',
    'a1300000-0000-4000-8000-000000000001',
    '30000000-0000-0000-0000-000000000002',
    'Inactive Low Stock Kurta',
    'inactive-low-stock-kurta',
    'Vastra',
    'APPROVED',
    false
  ),
  (
    'a1400000-0000-4000-8000-000000000003',
    'a1300000-0000-4000-8000-000000000002',
    '30000000-0000-0000-0000-000000000002',
    'Other Merchant Kurta',
    'other-merchant-kurta',
    'Vastra',
    'APPROVED',
    true
  );

insert into public.product_variants (
  id,
  product_id,
  shop_id,
  sku,
  colour_name,
  size_label,
  mrp_paise,
  selling_price_paise,
  is_active
)
values
  (
    'a1500000-0000-4000-8000-000000000001',
    'a1400000-0000-4000-8000-000000000001',
    'a1300000-0000-4000-8000-000000000001',
    'LOW-ACTIVE',
    'Blue',
    'M',
    100000,
    90000,
    true
  ),
  (
    'a1500000-0000-4000-8000-000000000002',
    'a1400000-0000-4000-8000-000000000001',
    'a1300000-0000-4000-8000-000000000001',
    'HEALTHY-ACTIVE',
    'Blue',
    'L',
    100000,
    90000,
    true
  ),
  (
    'a1500000-0000-4000-8000-000000000003',
    'a1400000-0000-4000-8000-000000000001',
    'a1300000-0000-4000-8000-000000000001',
    'STOCKOUT-ACTIVE',
    'Black',
    'M',
    100000,
    90000,
    true
  ),
  (
    'a1500000-0000-4000-8000-000000000004',
    'a1400000-0000-4000-8000-000000000002',
    'a1300000-0000-4000-8000-000000000001',
    'LOW-INACTIVE',
    'Red',
    'M',
    100000,
    90000,
    true
  ),
  (
    'a1500000-0000-4000-8000-000000000005',
    'a1400000-0000-4000-8000-000000000003',
    'a1300000-0000-4000-8000-000000000002',
    'OTHER-MERCHANT-LOW',
    'Green',
    'M',
    100000,
    90000,
    true
  );

insert into public.inventory_balances (
  shop_id,
  variant_id,
  stock_on_hand,
  reserved_quantity,
  damaged_quantity,
  reorder_level
)
values
  (
    'a1300000-0000-4000-8000-000000000001',
    'a1500000-0000-4000-8000-000000000001',
    4,
    1,
    1,
    3
  ),
  (
    'a1300000-0000-4000-8000-000000000001',
    'a1500000-0000-4000-8000-000000000002',
    10,
    1,
    0,
    3
  ),
  (
    'a1300000-0000-4000-8000-000000000001',
    'a1500000-0000-4000-8000-000000000003',
    0,
    0,
    0,
    0
  ),
  (
    'a1300000-0000-4000-8000-000000000001',
    'a1500000-0000-4000-8000-000000000004',
    1,
    0,
    0,
    2
  ),
  (
    'a1300000-0000-4000-8000-000000000002',
    'a1500000-0000-4000-8000-000000000005',
    1,
    0,
    0,
    2
  );

select is(
  (
    select count(*)::integer
    from public.merchant_low_stock_inventory
  ),
  4,
  'view contains low-stock rows from all shops for privileged tests'
);

select is(
  (
    select count(*)::integer
    from public.merchant_low_stock_inventory
    where variant_id =
      'a1500000-0000-4000-8000-000000000002'
  ),
  0,
  'healthy inventory is excluded'
);

select is(
  (
    select inventory_state
    from public.merchant_low_stock_inventory
    where variant_id =
      'a1500000-0000-4000-8000-000000000003'
  ),
  'OUT_OF_STOCK',
  'zero available inventory is classified as out of stock'
);

select is(
  (
    select inventory_state
    from public.merchant_low_stock_inventory
    where variant_id =
      'a1500000-0000-4000-8000-000000000001'
  ),
  'LOW_STOCK',
  'positive inventory at or below threshold is classified as low stock'
);

select is(
  (
    select count(*)::integer
    from public.merchant_low_stock_inventory
    where not product_is_active
      or not variant_is_active
  ),
  1,
  'read model retains inactive rows for explicit merchant inspection'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'a1100000-0000-4000-8000-000000000001',
  true
);

select is(
  (
    select count(*)::integer
    from public.merchant_low_stock_inventory
  ),
  3,
  'merchant RLS exposes only low-stock rows from owned shops'
);

select is(
  (
    select count(*)::integer
    from public.merchant_low_stock_inventory
    where shop_id =
      'a1300000-0000-4000-8000-000000000002'
  ),
  0,
  'merchant RLS hides another merchant shop'
);

select is(
  (
    select count(*)::integer
    from public.merchant_low_stock_inventory
    where product_is_active
      and variant_is_active
  ),
  2,
  'default endpoint filter can select active low-stock rows only'
);

select * from finish();

rollback;

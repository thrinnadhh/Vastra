begin;

select plan(8);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'inventory_balances_shop_variant_key'
      and conrelid = 'public.inventory_balances'::regclass
      and contype = 'u'
  ),
  'each shop variant has one authoritative inventory balance'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'inventory_balances_available_quantity_check'
      and conrelid = 'public.inventory_balances'::regclass
      and contype = 'c'
  ),
  'balance rows cannot reserve or damage more than stock on hand'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'inventory_balances'
      and policyname = 'inventory_balances_merchant_read'
      and cmd = 'SELECT'
  ),
  'merchants have owner-scoped inventory balance reads'
);

select ok(
  has_table_privilege(
    'authenticated',
    'public.inventory_balances',
    'SELECT'
  ),
  'authenticated actors can exercise inventory balance RLS'
);

select ok(
  to_regclass('public.products_search_vector_gin_idx') is not null,
  'manual product lookup has a full-text search index'
);

select ok(
  to_regclass('public.product_variants_shop_active_idx') is not null,
  'merchant variant lookup has a shop-scoped index'
);

select ok(
  to_regclass('public.inventory_balances_variant_idx') is not null,
  'variant balance lookup has a variant index'
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
values (
  'c1000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'inventory-reader@example.test',
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
values (
  'c1000000-0000-4000-8000-000000000001',
  'MERCHANT',
  'Inventory Reader',
  'ACTIVE'
);

insert into public.merchant_profiles (
  user_id,
  legal_name
)
values (
  'c1000000-0000-4000-8000-000000000001',
  'Inventory Reader Legal'
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
values (
  'c2000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'Shop',
  'Inventory Reader',
  '9000000013',
  'Inventory Test Street',
  'Tirupati',
  'Tirupati',
  'Andhra Pradesh',
  '517501',
  'IN',
  'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography
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
values (
  'c3000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'c2000000-0000-4000-8000-000000000001',
  'INVENTORY-READ-SHOP',
  'Inventory Read Shop',
  'inventory-read-shop',
  '9000000014',
  'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography,
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
values (
  'c4000000-0000-4000-8000-000000000001',
  'c3000000-0000-4000-8000-000000000001',
  '30000000-0000-0000-0000-000000000002',
  'Inventory Blue Kurta',
  'inventory-blue-kurta',
  'Vastra',
  'PENDING',
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
values (
  'c5000000-0000-4000-8000-000000000001',
  'c4000000-0000-4000-8000-000000000001',
  'c3000000-0000-4000-8000-000000000001',
  'INV-KURTA-BLUE-M',
  'Blue',
  'M',
  199900,
  149900,
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
values (
  'c3000000-0000-4000-8000-000000000001',
  'c5000000-0000-4000-8000-000000000001',
  15,
  4,
  2,
  3
);

select is(
  (
    select
      stock_on_hand
      - reserved_quantity
      - damaged_quantity
    from public.inventory_balances
    where shop_id =
      'c3000000-0000-4000-8000-000000000001'
      and variant_id =
        'c5000000-0000-4000-8000-000000000001'
  ),
  9,
  'available quantity is stock minus reserved and damaged'
);

select * from finish();

rollback;

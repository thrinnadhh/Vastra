begin;

select plan(8);

select ok(
  to_regclass('public.variant_barcodes') is not null,
  'variant barcode mapping table exists'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'variant_barcodes_barcode_value_key'
      and conrelid = 'public.variant_barcodes'::regclass
      and contype = 'u'
  ),
  'barcode values are globally unique for exact lookup'
);

select ok(
  to_regclass('public.variant_barcodes_one_primary_idx') is not null,
  'each variant has at most one primary barcode'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'variant_barcodes'
      and policyname = 'variant_barcodes_merchant_read'
      and cmd = 'SELECT'
  ),
  'merchant barcode reads are owner scoped by RLS'
);

select ok(
  has_table_privilege(
    'authenticated',
    'public.variant_barcodes',
    'SELECT'
  ),
  'authenticated merchants can exercise barcode RLS'
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
  'd1000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'barcode-reader@example.test',
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
  'd1000000-0000-4000-8000-000000000001',
  'MERCHANT',
  'Barcode Reader',
  'ACTIVE'
);

insert into public.merchant_profiles (
  user_id,
  legal_name
)
values (
  'd1000000-0000-4000-8000-000000000001',
  'Barcode Reader Legal'
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
  'd2000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  'Shop',
  'Barcode Reader',
  '9000000018',
  'Barcode Test Street',
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
  'd3000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  'd2000000-0000-4000-8000-000000000001',
  'BARCODE-READ-SHOP',
  'Barcode Read Shop',
  'barcode-read-shop',
  '9000000019',
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
  'd4000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000001',
  '30000000-0000-0000-0000-000000000002',
  'Barcode Blue Kurta',
  'barcode-blue-kurta',
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
  'd5000000-0000-4000-8000-000000000001',
  'd4000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000001',
  'BAR-KURTA-BLUE-M',
  'Blue',
  'M',
  199900,
  149900,
  true
);

insert into public.variant_barcodes (
  id,
  variant_id,
  barcode_value,
  barcode_type,
  source,
  is_primary,
  created_by
)
values (
  'd6000000-0000-4000-8000-000000000001',
  'd5000000-0000-4000-8000-000000000001',
  '8901234567890',
  'EAN13',
  'MANUFACTURER',
  true,
  'd1000000-0000-4000-8000-000000000001'
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
  'd3000000-0000-4000-8000-000000000001',
  'd5000000-0000-4000-8000-000000000001',
  10,
  2,
  1,
  3
);

select is(
  (
    select pv.id::text
    from public.variant_barcodes vb
    join public.product_variants pv
      on pv.id = vb.variant_id
    where vb.barcode_value = '8901234567890'
      and pv.shop_id = 'd3000000-0000-4000-8000-000000000001'
  ),
  'd5000000-0000-4000-8000-000000000001',
  'exact barcode resolves to the expected owned variant'
);

select is(
  (
    select (
      ib.stock_on_hand
      - ib.reserved_quantity
      - ib.damaged_quantity
    )::integer
    from public.variant_barcodes vb
    join public.inventory_balances ib
      on ib.variant_id = vb.variant_id
    where vb.barcode_value = '8901234567890'
  ),
  7,
  'barcode lookup can derive available inventory'
);

select is(
  (
    select count(*)::integer
    from public.variant_barcodes
    where barcode_value = '8901234567890'
  ),
  1,
  'exact barcode lookup returns one mapping'
);

select * from finish();

rollback;
